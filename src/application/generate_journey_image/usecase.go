package generatejourneyimage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

var (
	// ErrInvalidConfig はユースケースの実行設定が不正なことを表す。
	ErrInvalidConfig = errors.New("invalid generate journey image config")
)

// Input は画像生成対象を表す。
type Input struct {
	ImageID string
}

// Config は画像生成ユースケースの実行設定を表す。
// 値は運用設定（infrastructure/config）から注入し、ここでは既定値を持たない。
type Config struct {
	// GenerationTimeout は1枚の生成に許す時間。
	GenerationTimeout time.Duration
	// LeaseDuration は claim から解放までの時間。GenerationTimeout より長くなければならない。
	LeaseDuration time.Duration
	// Now は現在時刻を返す。nil のときは time.Now を使う。
	Now func() time.Time
}

// Validate は設定の整合性を検証する。
func (c Config) Validate() error {
	if c.GenerationTimeout <= 0 {
		return fmt.Errorf("%w: generation timeout must be positive", ErrInvalidConfig)
	}
	if c.LeaseDuration <= c.GenerationTimeout {
		return fmt.Errorf("%w: lease duration must be longer than generation timeout", ErrInvalidConfig)
	}
	return nil
}

// UseCase は画像を1枚生成するユースケースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) error
}

// NewUseCase は画像生成ユースケースを生成する。設定が不正なときはエラーを返す。
func NewUseCase(
	imageRepo repository.JourneyImageRepository,
	requestRepo repository.JourneyRequestRepository,
	generator domainservice.ImageGenerator,
	storage domainservice.ImageStorage,
	config Config,
) (UseCase, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	if config.Now == nil {
		config.Now = time.Now
	}

	return &useCase{
		imageRepo:   imageRepo,
		requestRepo: requestRepo,
		generator:   generator,
		storage:     storage,
		config:      config,
	}, nil
}

type useCase struct {
	imageRepo   repository.JourneyImageRepository
	requestRepo repository.JourneyRequestRepository
	generator   domainservice.ImageGenerator
	storage     domainservice.ImageStorage
	config      Config
}

func (uc *useCase) Execute(ctx context.Context, input Input) error {
	imageID, err := value_object.NewIDFromString(input.ImageID)
	if err != nil {
		return fmt.Errorf("%w: image id: %w", application.ErrInvalidInput, err)
	}

	leaseUntil := uc.config.Now().Add(uc.config.LeaseDuration)
	image, claimed, err := uc.imageRepo.Claim(ctx, imageID, leaseUntil)
	if err != nil {
		return fmt.Errorf("claim journey image: %w", err)
	}
	if !claimed {
		return nil
	}

	return uc.generate(ctx, image)
}

func (uc *useCase) generate(ctx context.Context, image entity.JourneyImage) error {
	request, err := uc.requestRepo.FindByID(ctx, image.RequestID())
	if err != nil {
		return uc.failAndSave(
			ctx,
			image,
			value_object.ImageFailureCodeInternalError,
			fmt.Errorf("find journey request: %w", err),
		)
	}

	style, err := domainservice.VisualStyleForSlot(image.ID(), image.Slot())
	if err != nil {
		return uc.failAndSave(
			ctx,
			image,
			value_object.ImageFailureCodeInternalError,
			fmt.Errorf("select image visual style: %w", err),
		)
	}

	brief, err := domainservice.NewImageBrief(
		request.Destination(),
		request.Period(),
		image.Slot(),
		style,
	)
	if err != nil {
		return uc.failAndSave(
			ctx,
			image,
			value_object.ImageFailureCodeInternalError,
			fmt.Errorf("create image brief: %w", err),
		)
	}

	generationContext, cancel := context.WithTimeout(ctx, uc.config.GenerationTimeout)
	generatedImage, generateErr := uc.generator.Generate(generationContext, brief)
	timedOut := errors.Is(generationContext.Err(), context.DeadlineExceeded)
	cancel()

	if ctx.Err() != nil {
		return ctx.Err()
	}
	if generateErr != nil {
		return uc.failAndSave(
			ctx,
			image,
			domainservice.ClassifyImageGenerationFailure(generateErr, timedOut),
			fmt.Errorf("generate image: %w", generateErr),
		)
	}
	if timedOut {
		return uc.failAndSave(
			ctx,
			image,
			value_object.ImageFailureCodeProviderTimeout,
			context.DeadlineExceeded,
		)
	}

	assetReference, err := uc.storage.Save(ctx, image.ID(), generatedImage)
	if err != nil {
		return uc.failAndSave(
			ctx,
			image,
			domainservice.ClassifyImageStorageFailure(err),
			fmt.Errorf("save image: %w", err),
		)
	}

	processingImage := image
	if err := image.Complete(assetReference, brief.Style()); err != nil {
		return uc.compensateAndFail(
			ctx,
			processingImage,
			assetReference,
			value_object.ImageFailureCodeInternalError,
			fmt.Errorf("complete journey image: %w", err),
		)
	}
	if err := uc.imageRepo.Save(ctx, image); err != nil {
		return uc.compensateAndFail(
			ctx,
			processingImage,
			assetReference,
			value_object.ImageFailureCodeInternalError,
			fmt.Errorf("save completed journey image: %w", err),
		)
	}

	return nil
}

func (uc *useCase) failAndSave(
	ctx context.Context,
	image entity.JourneyImage,
	failureCode value_object.ImageFailureCode,
	cause error,
) error {
	if err := image.Fail(failureCode); err != nil {
		return errors.Join(cause, fmt.Errorf("mark journey image failed: %w", err))
	}
	if err := uc.imageRepo.Save(ctx, image); err != nil {
		return errors.Join(cause, fmt.Errorf("save failed journey image: %w", err))
	}

	return cause
}

func (uc *useCase) compensateAndFail(
	ctx context.Context,
	image entity.JourneyImage,
	assetReference value_object.ImageAssetReference,
	failureCode value_object.ImageFailureCode,
	cause error,
) error {
	deleteErr := uc.storage.Delete(ctx, assetReference)
	failureErr := uc.failAndSave(ctx, image, failureCode, cause)
	if deleteErr != nil {
		return errors.Join(
			failureErr,
			fmt.Errorf(
				"delete compensating image %s (%q): %w",
				image.ID().String(),
				assetReference.StorageKey(),
				deleteErr,
			),
		)
	}

	return failureErr
}

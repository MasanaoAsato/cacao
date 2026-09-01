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

const (
	defaultGenerationTimeout = 180 * time.Second
	defaultLeaseDuration     = 240 * time.Second
)

// Input は画像生成対象を表す。
type Input struct {
	ImageID string
}

// Config は画像生成ユースケースの実行設定を表す。
type Config struct {
	GenerationTimeout time.Duration
	LeaseDuration     time.Duration
	Now               func() time.Time
}

// UseCase は画像を1枚生成するユースケースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) error
}

// TimeoutAwareUseCase はworkerから生成timeoutを明示できるユースケースである。
type TimeoutAwareUseCase interface {
	UseCase
	ExecuteWithTimeout(
		ctx context.Context,
		input Input,
		timeout time.Duration,
	) error
}

// LeaseAwareUseCase はworkerから生成timeoutとclaim leaseを明示できるユースケースである。
type LeaseAwareUseCase interface {
	TimeoutAwareUseCase
	ExecuteWithTimeoutAndLease(
		ctx context.Context,
		input Input,
		generationTimeout time.Duration,
		leaseDuration time.Duration,
	) error
}

// NewUseCase は画像生成ユースケースを生成する。
func NewUseCase(
	imageRepo repository.JourneyImageRepository,
	requestRepo repository.JourneyRequestRepository,
	generator domainservice.ImageGenerator,
	storage domainservice.ImageStorage,
	configs ...Config,
) UseCase {
	config := defaultConfig()
	if len(configs) > 0 {
		config = normalizeConfig(configs[0])
	}

	return &useCase{
		imageRepo:   imageRepo,
		requestRepo: requestRepo,
		generator:   generator,
		storage:     storage,
		config:      config,
	}
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

func (uc *useCase) ExecuteWithTimeout(
	ctx context.Context,
	input Input,
	timeout time.Duration,
) error {
	return uc.ExecuteWithTimeoutAndLease(ctx, input, timeout, uc.config.LeaseDuration)
}

func (uc *useCase) ExecuteWithTimeoutAndLease(
	ctx context.Context,
	input Input,
	generationTimeout time.Duration,
	leaseDuration time.Duration,
) error {
	configured := *uc
	configured.config.GenerationTimeout = generationTimeout
	configured.config.LeaseDuration = leaseDuration
	return configured.Execute(ctx, input)
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

	style := value_object.ImageVisualStyleNone
	if image.Slot().Purpose() == value_object.ImagePurposeCover {
		style, err = selectCoverStyle(image.ID())
		if err != nil {
			return uc.failAndSave(
				ctx,
				image,
				value_object.ImageFailureCodeInternalError,
				fmt.Errorf("select cover image visual style: %w", err),
			)
		}
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
			classifyGenerationFailure(generateErr, timedOut),
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
			classifyStorageFailure(err),
			fmt.Errorf("save image: %w", err),
		)
	}

	processingImage := image
	if err := image.Complete(assetReference); err != nil {
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

func classifyGenerationFailure(err error, timedOut bool) value_object.ImageFailureCode {
	switch {
	case timedOut || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, domainservice.ErrImageGeneratorTimeout):
		return value_object.ImageFailureCodeProviderTimeout
	case errors.Is(err, domainservice.ErrImageGeneratorUnavailable):
		return value_object.ImageFailureCodeProviderUnavailable
	case errors.Is(err, domainservice.ErrImageGenerationRejected):
		return value_object.ImageFailureCodeGenerationRejected
	case errors.Is(err, domainservice.ErrGeneratedImageInvalid):
		return value_object.ImageFailureCodeOutputInvalid
	default:
		return value_object.ImageFailureCodeInternalError
	}
}

func classifyStorageFailure(err error) value_object.ImageFailureCode {
	if errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
		return value_object.ImageFailureCodeOutputInvalid
	}

	return value_object.ImageFailureCodeStorageFailed
}

func defaultConfig() Config {
	return Config{
		GenerationTimeout: defaultGenerationTimeout,
		LeaseDuration:     defaultLeaseDuration,
		Now:               time.Now,
	}
}

func normalizeConfig(config Config) Config {
	defaults := defaultConfig()
	if config.GenerationTimeout <= 0 {
		config.GenerationTimeout = defaults.GenerationTimeout
	}
	if config.LeaseDuration <= 0 {
		config.LeaseDuration = defaults.LeaseDuration
	}
	if config.Now == nil {
		config.Now = defaults.Now
	}

	return config
}

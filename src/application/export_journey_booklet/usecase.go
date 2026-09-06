package exportjourneybooklet

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/repository"
	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

// UseCase は旅のしおりPDFを出力するユースケースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は旅程・表紙と挿絵画像・レンダラーを使うユースケースを生成する。
func NewUseCase(
	journeyRepo repository.JourneyRepository,
	imageRepo repository.JourneyImageRepository,
	renderer domainservice.BookletRenderer,
) UseCase {
	return &useCase{
		imageRepo:   imageRepo,
		journeyRepo: journeyRepo,
		renderer:    renderer,
	}
}

type useCase struct {
	imageRepo   repository.JourneyImageRepository
	journeyRepo repository.JourneyRepository
	renderer    domainservice.BookletRenderer
}

// Execute は表紙と挿絵が描画可能であることを確認してからPDFを生成する。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	journeyID, err := value_object.NewIDFromString(input.JourneyID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid journey id: %w", application.ErrInvalidInput, err)
	}

	var seed *value_object.ThemeSeed
	if input.Seed != "" {
		parsedSeed, parseErr := value_object.NewThemeSeed(input.Seed)
		if parseErr != nil {
			return Output{}, fmt.Errorf("%w: invalid theme seed: %w", application.ErrInvalidInput, parseErr)
		}
		seed = &parsedSeed
	}

	journey, err := uc.journeyRepo.FindByID(ctx, journeyID)
	if err != nil {
		if errors.Is(err, repository.ErrJourneyNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrJourneyNotFound, err)
		}
		return Output{}, fmt.Errorf("find journey: %w", err)
	}

	coverSlot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		return Output{}, fmt.Errorf("create cover image slot: %w", err)
	}
	coverImage, err := uc.imageRepo.FindBySlot(ctx, journey.RequestID(), coverSlot)
	if err != nil {
		if errors.Is(err, repository.ErrJourneyImageNotFound) {
			return Output{}, fmt.Errorf("%w: cover image is missing", application.ErrJourneyImageNotReady)
		}
		return Output{}, fmt.Errorf("find cover image: %w", err)
	}
	if coverImage.Status() != value_object.ImageStatusReady {
		return Output{}, fmt.Errorf(
			"%w: cover image status is %q",
			application.ErrJourneyImageNotReady,
			coverImage.Status(),
		)
	}

	images, err := uc.imageRepo.FindByRequestID(ctx, journey.RequestID())
	if err != nil {
		return Output{}, fmt.Errorf("find journey images: %w", err)
	}
	for _, image := range images {
		if image.Slot().Purpose() != value_object.ImagePurposeIllustration {
			continue
		}
		switch image.Status() {
		case value_object.ImageStatusPending, value_object.ImageStatusProcessing:
			return Output{}, fmt.Errorf(
				"%w: illustration image status is %q",
				application.ErrJourneyImageNotReady,
				image.Status(),
			)
		}
	}

	request, err := domainservice.NewBookletRenderRequest(journeyID, seed)
	if err != nil {
		return Output{}, fmt.Errorf("%w: render request: %w", application.ErrInvalidInput, err)
	}
	rendered, err := uc.renderer.Render(ctx, request)
	if err != nil {
		if errors.Is(err, domainservice.ErrBookletRendererBusy) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrBookletRendererBusy, err)
		}
		return Output{}, fmt.Errorf("%w: %w", application.ErrBookletRenderFailed, err)
	}

	return Output{
		Content:   append([]byte(nil), rendered.Content...),
		FileName:  "journey-booklet-" + journeyID.String() + ".pdf",
		MediaType: rendered.MediaType,
	}, nil
}

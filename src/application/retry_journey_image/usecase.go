package retryjourneyimage

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/application/readmodel"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は RetryJourneyImage ユースケースのインターフェースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は RetryJourneyImage ユースケースの実装を生成する。
func NewUseCase(imageRepo repository.JourneyImageRepository) UseCase {
	return &useCase{imageRepo: imageRepo}
}

type useCase struct {
	imageRepo repository.JourneyImageRepository
}

// Execute はfailed状態の画像をpending状態へ戻して保存する。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	imageID, err := value_object.NewIDFromString(input.ImageID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: image id: %w", application.ErrInvalidInput, err)
	}

	image, err := uc.imageRepo.FindByID(ctx, imageID)
	if err != nil {
		if errors.Is(err, repository.ErrJourneyImageNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrJourneyImageNotFound, err)
		}

		return Output{}, fmt.Errorf("find journey image: %w", err)
	}
	if err := image.Retry(); err != nil {
		if errors.Is(err, entity.ErrInvalidImageTransition) || errors.Is(err, entity.ErrImageRetryNotAllowed) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrJourneyImageRetryNotAllowed, err)
		}

		return Output{}, fmt.Errorf("retry journey image: %w", err)
	}

	if err := uc.imageRepo.Save(ctx, image); err != nil {
		return Output{}, fmt.Errorf("save journey image: %w", err)
	}

	return Output{Image: readmodel.NewJourneyImageDTO(image)}, nil
}

package getjourneyimage

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は GetJourneyImage ユースケースのインターフェースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は GetJourneyImage ユースケースの実装を生成する。
func NewUseCase(imageRepo repository.JourneyImageRepository) UseCase {
	return &useCase{imageRepo: imageRepo}
}

type useCase struct {
	imageRepo repository.JourneyImageRepository
}

// Execute は画像IDに対応する画像の状態を返す。
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

	return Output{Image: toJourneyImageDTO(image)}, nil
}

func toJourneyImageDTO(image entity.JourneyImage) JourneyImageDTO {
	dto := JourneyImageDTO{
		ID: image.ID().String(),
		Slot: SlotDTO{
			Purpose: image.Slot().Purpose().String(),
			Ordinal: image.Slot().Ordinal(),
		},
		Status:       image.Status().String(),
		AttemptCount: image.AttemptCount(),
	}
	if assetReference, ok := image.AssetReference(); ok {
		dto.HasContent = true
		dto.MediaType = assetReference.MediaType()
		dto.Width = assetReference.Width()
		dto.Height = assetReference.Height()
	}
	if failureCode, ok := image.FailureCode(); ok {
		dto.HasFailureCode = true
		dto.FailureCode = failureCode.String()
	}

	return dto
}

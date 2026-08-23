package listjourneyimages

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は ListJourneyImages ユースケースのインターフェースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は ListJourneyImages ユースケースの実装を生成する。
func NewUseCase(
	requestRepo repository.JourneyRequestRepository,
	imageRepo repository.JourneyImageRepository,
) UseCase {
	return &useCase{
		requestRepo: requestRepo,
		imageRepo:   imageRepo,
	}
}

type useCase struct {
	requestRepo repository.JourneyRequestRepository
	imageRepo   repository.JourneyImageRepository
}

// Execute は旅程リクエストに紐づく画像をslot順で返す。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	requestID, err := value_object.NewIDFromString(input.RequestID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: request id: %w", application.ErrInvalidInput, err)
	}

	if _, err := uc.requestRepo.FindByID(ctx, requestID); err != nil {
		if errors.Is(err, repository.ErrJourneyRequestNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrRequestNotFound, err)
		}

		return Output{}, fmt.Errorf("find journey request: %w", err)
	}

	images, err := uc.imageRepo.FindByRequestID(ctx, requestID)
	if err != nil {
		return Output{}, fmt.Errorf("find journey images: %w", err)
	}

	imageDTOs := make([]JourneyImageDTO, 0, len(images))
	for _, image := range images {
		imageDTOs = append(imageDTOs, toJourneyImageDTO(image))
	}

	return Output{
		JourneyRequestID: requestID.String(),
		Images:           imageDTOs,
	}, nil
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

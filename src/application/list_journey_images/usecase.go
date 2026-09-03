package listjourneyimages

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/application/readmodel"
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

	return Output{
		JourneyRequestID: requestID.String(),
		Images:           readmodel.NewJourneyImageDTOs(images),
	}, nil
}

package getjourneyimage

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/application/readmodel"
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

	return Output{Image: readmodel.NewJourneyImageDTO(image)}, nil
}

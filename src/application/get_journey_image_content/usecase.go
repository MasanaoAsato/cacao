package getjourneyimagecontent

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/repository"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

// UseCase は GetJourneyImageContent ユースケースのインターフェースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は GetJourneyImageContent ユースケースの実装を生成する。
func NewUseCase(
	imageRepo repository.JourneyImageRepository,
	storage service.ImageStorage,
) UseCase {
	return &useCase{
		imageRepo: imageRepo,
		storage:   storage,
	}
}

type useCase struct {
	imageRepo repository.JourneyImageRepository
	storage   service.ImageStorage
}

// Execute はready状態の画像バイナリを開いて返す。
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
	if image.Status() != value_object.ImageStatusReady {
		return Output{}, fmt.Errorf("%w: status is %q", application.ErrJourneyImageNotReady, image.Status())
	}

	assetReference, ok := image.AssetReference()
	if !ok {
		return Output{}, fmt.Errorf("ready journey image has no asset reference")
	}
	content, err := uc.storage.Open(ctx, assetReference)
	if err != nil {
		return Output{}, fmt.Errorf("open journey image content: %w", err)
	}

	return Output{
		Content:   content,
		MediaType: assetReference.MediaType(),
		ETag:      fmt.Sprintf("%q", image.ID().String()),
	}, nil
}

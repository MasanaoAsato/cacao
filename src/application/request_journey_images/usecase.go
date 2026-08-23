package requestjourneyimages

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は RequestJourneyImages ユースケースのインターフェースである。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は RequestJourneyImages ユースケースの実装を生成する。
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

// Execute は指定されたスロットの画像を冪等に要求する。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	requestID, err := value_object.NewIDFromString(input.RequestID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: request id: %w", application.ErrInvalidInput, err)
	}

	slots, err := toImageSlots(input.Slots)
	if err != nil {
		return Output{}, err
	}

	if _, err := uc.requestRepo.FindByID(ctx, requestID); err != nil {
		if errors.Is(err, repository.ErrJourneyRequestNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrRequestNotFound, err)
		}

		return Output{}, fmt.Errorf("find journey request: %w", err)
	}

	images := make([]entity.JourneyImage, 0, len(slots))
	for _, slot := range slots {
		image, err := uc.findOrCreate(ctx, requestID, slot)
		if err != nil {
			return Output{}, err
		}

		images = append(images, image)
	}
	sort.Slice(images, func(i, j int) bool {
		return images[i].Slot().Less(images[j].Slot())
	})

	imageDTOs := make([]JourneyImageDTO, 0, len(images))
	for _, image := range images {
		imageDTOs = append(imageDTOs, toJourneyImageDTO(image))
	}

	return Output{
		JourneyRequestID: requestID.String(),
		Images:           imageDTOs,
	}, nil
}

func toImageSlots(inputs []SlotInput) ([]value_object.ImageSlot, error) {
	if len(inputs) < 1 || len(inputs) > 4 {
		return nil, fmt.Errorf("%w: slots must contain between 1 and 4 entries", application.ErrInvalidInput)
	}

	slots := make([]value_object.ImageSlot, 0, len(inputs))
	seen := make(map[value_object.ImageSlot]struct{}, len(inputs))
	for _, input := range inputs {
		purpose, err := value_object.NewImagePurpose(input.Purpose)
		if err != nil {
			return nil, fmt.Errorf("%w: image purpose: %w", application.ErrInvalidInput, err)
		}
		slot, err := value_object.NewImageSlot(purpose, input.Ordinal)
		if err != nil {
			return nil, fmt.Errorf("%w: image slot: %w", application.ErrInvalidInput, err)
		}
		if _, exists := seen[slot]; exists {
			return nil, fmt.Errorf("%w: duplicate image slot", application.ErrInvalidInput)
		}

		seen[slot] = struct{}{}
		slots = append(slots, slot)
	}
	sort.Slice(slots, func(i, j int) bool {
		return slots[i].Less(slots[j])
	})

	return slots, nil
}

func (uc *useCase) findOrCreate(
	ctx context.Context,
	requestID value_object.ID,
	slot value_object.ImageSlot,
) (entity.JourneyImage, error) {
	image, err := uc.imageRepo.FindBySlot(ctx, requestID, slot)
	if err == nil {
		return image, nil
	}
	if !errors.Is(err, repository.ErrJourneyImageNotFound) {
		return entity.JourneyImage{}, fmt.Errorf("find journey image by slot: %w", err)
	}

	image, err = entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		return entity.JourneyImage{}, fmt.Errorf("%w: create journey image: %w", application.ErrInvalidInput, err)
	}
	if err := uc.imageRepo.Save(ctx, image); err == nil {
		return image, nil
	} else if !errors.Is(err, repository.ErrJourneyImageSlotAlreadyExists) {
		return entity.JourneyImage{}, fmt.Errorf("save journey image: %w", err)
	}

	image, err = uc.imageRepo.FindBySlot(ctx, requestID, slot)
	if err != nil {
		return entity.JourneyImage{}, fmt.Errorf("find concurrently created journey image: %w", err)
	}

	return image, nil
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

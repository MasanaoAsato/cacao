package readmodel

import "cacao/src/domain/entity"

// JourneyImageDTO は画像集約の読み取り専用表現である。
type JourneyImageDTO struct {
	ID             string
	Slot           SlotDTO
	Status         string
	AttemptCount   int
	HasContent     bool
	MediaType      string
	Width          int
	Height         int
	HasFailureCode bool
	FailureCode    string
}

// SlotDTO は画像スロットの読み取り専用表現である。
type SlotDTO struct {
	Purpose string
	Ordinal int
}

// NewJourneyImageDTO は JourneyImage を DTO に変換する。
func NewJourneyImageDTO(image entity.JourneyImage) JourneyImageDTO {
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

// NewJourneyImageDTOs は JourneyImage のスライスを DTO のスライスに変換する。
func NewJourneyImageDTOs(images []entity.JourneyImage) []JourneyImageDTO {
	dtos := make([]JourneyImageDTO, 0, len(images))
	for _, image := range images {
		dtos = append(dtos, NewJourneyImageDTO(image))
	}
	return dtos
}

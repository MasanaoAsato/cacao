package service

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/domain/value_object"
)

var (
	ErrImageGeneratorUnavailable = errors.New("image generator unavailable")
	ErrImageGeneratorTimeout     = errors.New("image generator timeout")
	ErrImageGenerationRejected   = errors.New("image generation rejected")
	ErrGeneratedImageInvalid     = errors.New("generated image invalid")
)

// ImageBrief は画像生成に必要なプロバイダー中立の条件を表す。
type ImageBrief struct {
	destination value_object.Destination
	period      value_object.Period
	slot        value_object.ImageSlot
}

// NewImageBrief は有効な画像生成条件を作成する。
func NewImageBrief(
	destination value_object.Destination,
	period value_object.Period,
	slot value_object.ImageSlot,
) (ImageBrief, error) {
	if destination.City() == "" {
		return ImageBrief{}, fmt.Errorf("invalid image brief: destination city must not be empty")
	}

	startDate := period.StartDate()
	if startDate.IsZero() {
		return ImageBrief{}, fmt.Errorf("invalid image brief: period start date must not be zero")
	}
	endDate := period.EndDate()
	if endDate.IsZero() {
		return ImageBrief{}, fmt.Errorf("invalid image brief: period end date must not be zero")
	}
	if endDate.Before(startDate) {
		return ImageBrief{}, fmt.Errorf("invalid image brief: period end date must not be before start date")
	}

	if err := slot.Validate(); err != nil {
		return ImageBrief{}, fmt.Errorf("invalid image brief: invalid slot: %w", err)
	}

	return ImageBrief{
		destination: destination,
		period:      period,
		slot:        slot,
	}, nil
}

// Destination は画像生成先を返す。
func (b ImageBrief) Destination() value_object.Destination {
	return b.destination
}

// Period は画像生成の対象期間を返す。
func (b ImageBrief) Period() value_object.Period {
	return b.period
}

// Slot は画像生成先のスロットを返す。
func (b ImageBrief) Slot() value_object.ImageSlot {
	return b.slot
}

// GeneratedImage は画像生成器が返す未保存の画像である。
type GeneratedImage struct {
	Content   []byte
	MediaType string
	Width     int
	Height    int
}

// ImageGenerator は画像ブリーフから未保存の画像を生成するportである。
type ImageGenerator interface {
	Generate(ctx context.Context, brief ImageBrief) (GeneratedImage, error)
}

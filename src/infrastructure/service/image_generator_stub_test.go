package service

import (
	"bytes"
	"context"
	"errors"
	"image"
	"testing"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

func TestImageGeneratorStubGenerate(t *testing.T) {
	stub := NewImageGeneratorStub()
	brief := newTestImageBrief(t)

	generated, err := stub.Generate(context.Background(), brief)
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if generated.MediaType != "image/png" {
		t.Errorf("Generate().MediaType = %q, want image/png", generated.MediaType)
	}
	if generated.Width != 2 || generated.Height != 2 {
		t.Errorf("Generate() dimensions = %dx%d, want 2x2", generated.Width, generated.Height)
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(generated.Content))
	if err != nil {
		t.Fatalf("DecodeConfig() error = %v", err)
	}
	if config.Width != generated.Width || config.Height != generated.Height {
		t.Errorf("decoded dimensions = %dx%d, want %dx%d", config.Width, config.Height, generated.Width, generated.Height)
	}
}

func TestImageGeneratorStubRejectsInvalidBriefAndInjectedError(t *testing.T) {
	t.Run("invalid brief", func(t *testing.T) {
		stub := NewImageGeneratorStub()
		_, err := stub.Generate(context.Background(), domainservice.ImageBrief{})
		if !errors.Is(err, domainservice.ErrImageGenerationRejected) {
			t.Errorf("Generate() error = %v, want ErrImageGenerationRejected", err)
		}
	})

	t.Run("injected error", func(t *testing.T) {
		wantErr := errors.New("stub failure")
		stub := NewImageGeneratorStub(WithImageGeneratorStubError(wantErr))
		_, err := stub.Generate(context.Background(), newTestImageBrief(t))
		if !errors.Is(err, wantErr) {
			t.Errorf("Generate() error = %v, want injected error", err)
		}
	})
}

func TestImageGeneratorStubRejectsCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := NewImageGeneratorStub().Generate(ctx, newTestImageBrief(t))
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Generate() error = %v, want context.Canceled", err)
	}
}

func newTestImageBrief(t *testing.T) domainservice.ImageBrief {
	t.Helper()
	destination, err := value_object.NewDestination("Kyoto", "Japan")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	period, err := value_object.NewPeriod(
		time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.April, 2, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	slot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	brief, err := domainservice.NewImageBrief(
		destination,
		period,
		slot,
		value_object.ImageVisualStyleEditorialPhotograph,
	)
	if err != nil {
		t.Fatalf("NewImageBrief() error = %v", err)
	}

	return brief
}

package retryjourneyimage

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

type mockImageRepo struct {
	image      entity.JourneyImage
	findErr    error
	saveErr    error
	savedImage entity.JourneyImage
	saveCalls  int
}

func (m *mockImageRepo) Save(_ context.Context, image entity.JourneyImage) error {
	m.saveCalls++
	if m.saveErr != nil {
		return m.saveErr
	}

	m.savedImage = image
	return nil
}

func (m *mockImageRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyImage, error) {
	if m.findErr != nil {
		return entity.JourneyImage{}, m.findErr
	}

	return m.image, nil
}

func (m *mockImageRepo) FindByRequestID(
	_ context.Context,
	_ value_object.ID,
) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (m *mockImageRepo) FindBySlot(
	_ context.Context,
	_ value_object.ID,
	_ value_object.ImageSlot,
) (entity.JourneyImage, error) {
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (m *mockImageRepo) FindPending(_ context.Context, _ int) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (m *mockImageRepo) FindExpiredProcessing(
	_ context.Context,
	_ time.Time,
	_ int,
) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (m *mockImageRepo) Claim(
	_ context.Context,
	_ value_object.ID,
	_ time.Time,
) (entity.JourneyImage, bool, error) {
	return entity.JourneyImage{}, false, repository.ErrJourneyImageNotFound
}

func (m *mockImageRepo) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

func TestUseCaseExecute(t *testing.T) {
	failedImage := mustNewFailedImage(t)
	pendingImage := mustNewPendingImage(t)
	failedImageAtLimit := mustNewFailedImageAtLimit(t)

	tests := []struct {
		name     string
		input    Input
		image    entity.JourneyImage
		findErr  error
		saveErr  error
		wantErr  error
		wantSave int
	}{
		{
			name:     "正常系: failed画像をpendingへ戻して保存する",
			input:    Input{ImageID: failedImage.ID().String()},
			image:    failedImage,
			wantSave: 1,
		},
		{
			name:    "異常系: pending画像はretryできない",
			input:   Input{ImageID: pendingImage.ID().String()},
			image:   pendingImage,
			wantErr: application.ErrJourneyImageRetryNotAllowed,
		},
		{
			name:    "異常系: image idが不正",
			input:   Input{ImageID: "invalid-id"},
			wantErr: application.ErrInvalidInput,
		},
		{
			name:    "異常系: 画像が存在しない",
			input:   Input{ImageID: failedImage.ID().String()},
			findErr: repository.ErrJourneyImageNotFound,
			wantErr: application.ErrJourneyImageNotFound,
		},
		{
			name:    "境界値系: 3回失敗した画像はretryできない",
			input:   Input{ImageID: failedImageAtLimit.ID().String()},
			image:   failedImageAtLimit,
			wantErr: application.ErrJourneyImageRetryNotAllowed,
		},
		{
			name:     "異常系: 保存に失敗する",
			input:    Input{ImageID: failedImage.ID().String()},
			image:    failedImage,
			saveErr:  errors.New("database unavailable"),
			wantSave: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &mockImageRepo{
				image:   tt.image,
				findErr: tt.findErr,
				saveErr: tt.saveErr,
			}
			uc := NewUseCase(repo)

			output, err := uc.Execute(context.Background(), tt.input)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Execute() error = %v, want errors.Is(_, %v)", err, tt.wantErr)
				}
			} else if tt.saveErr != nil {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
			} else if err != nil {
				t.Fatalf("Execute() error = %v", err)
			} else {
				if output.Image.Status != value_object.ImageStatusPending.String() {
					t.Errorf("Image.Status = %q, want %q", output.Image.Status, value_object.ImageStatusPending)
				}
				if output.Image.AttemptCount != 1 {
					t.Errorf("Image.AttemptCount = %d, want 1", output.Image.AttemptCount)
				}
				if output.Image.HasFailureCode {
					t.Error("Image.HasFailureCode = true, want false")
				}
			}

			if repo.saveCalls != tt.wantSave {
				t.Errorf("Save() calls = %d, want %d", repo.saveCalls, tt.wantSave)
			}
			if tt.wantSave == 1 && tt.saveErr == nil && repo.savedImage.Status() != value_object.ImageStatusPending {
				t.Errorf("saved image status = %q, want %q", repo.savedImage.Status(), value_object.ImageStatusPending)
			}
		})
	}
}

func mustNewPendingImage(t *testing.T) entity.JourneyImage {
	t.Helper()

	slot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), value_object.NewID(), slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}

	return image
}

func mustNewFailedImage(t *testing.T) entity.JourneyImage {
	t.Helper()

	image := mustNewPendingImage(t)
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	failureCode, err := value_object.NewImageFailureCode("provider_timeout")
	if err != nil {
		t.Fatalf("NewImageFailureCode() error = %v", err)
	}
	if err := image.Fail(failureCode); err != nil {
		t.Fatalf("Fail() error = %v", err)
	}

	return image
}

func mustNewFailedImageAtLimit(t *testing.T) entity.JourneyImage {
	t.Helper()

	image := mustNewPendingImage(t)
	failureCode, err := value_object.NewImageFailureCode("provider_timeout")
	if err != nil {
		t.Fatalf("NewImageFailureCode() error = %v", err)
	}
	for attempt := 1; attempt <= entity.MaxImageGenerationAttempts; attempt++ {
		if err := image.Start(); err != nil {
			t.Fatalf("Start() error = %v", err)
		}
		if err := image.Fail(failureCode); err != nil {
			t.Fatalf("Fail() error = %v", err)
		}
		if attempt == entity.MaxImageGenerationAttempts {
			continue
		}
		if err := image.Retry(); err != nil {
			t.Fatalf("Retry() error = %v", err)
		}
	}

	return image
}

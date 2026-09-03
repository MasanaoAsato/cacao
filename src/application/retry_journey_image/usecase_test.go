package retryjourneyimage

import (
	"context"
	"errors"
	"testing"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestUseCaseExecute(t *testing.T) {
	failedImage := testkit.MustNewFailedImage(t)
	pendingImage := testkit.MustNewPendingImage(t)
	failedImageAtLimit := testkit.MustNewFailedImageAtLimit(t)

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
			// 3枚はそれぞれ別の requestID を持つため、同じ cover/1 スロットでも共存できる
			repo := fakes.NewJourneyImageRepositoryWith(t, failedImage, pendingImage, failedImageAtLimit)
			if tt.findErr != nil {
				repo.FindByIDFn = func(context.Context, value_object.ID) (entity.JourneyImage, error) {
					return entity.JourneyImage{}, tt.findErr
				}
			}
			saveCalls := 0
			repo.SaveFn = func(ctx context.Context, image entity.JourneyImage) error {
				saveCalls++
				if tt.saveErr != nil {
					return tt.saveErr
				}
				return repo.JourneyImageRepositoryMemory.Save(ctx, image)
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

			if saveCalls != tt.wantSave {
				t.Errorf("Save() calls = %d, want %d", saveCalls, tt.wantSave)
			}
			if tt.wantSave == 1 && tt.saveErr == nil {
				// 保存された状態はインメモリ実装から読み戻して検証する
				saved, err := repo.JourneyImageRepositoryMemory.FindByID(context.Background(), tt.image.ID())
				if err != nil {
					t.Fatalf("FindByID() error = %v", err)
				}
				if saved.Status() != value_object.ImageStatusPending {
					t.Errorf("saved image status = %q, want %q", saved.Status(), value_object.ImageStatusPending)
				}
			}
		})
	}
}

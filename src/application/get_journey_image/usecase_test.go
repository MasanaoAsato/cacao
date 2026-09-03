package getjourneyimage

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
	image := testkit.MustNewReadyImage(t)

	tests := []struct {
		name    string
		input   Input
		repoErr error
		wantErr error
	}{
		{
			name:  "正常系: ready画像をDTOへ変換する",
			input: Input{ImageID: image.ID().String()},
		},
		{
			name:    "異常系: image idが不正",
			input:   Input{ImageID: "invalid-id"},
			wantErr: application.ErrInvalidInput,
		},
		{
			name:    "異常系: 画像が存在しない",
			input:   Input{ImageID: image.ID().String()},
			repoErr: repository.ErrJourneyImageNotFound,
			wantErr: application.ErrJourneyImageNotFound,
		},
		{
			name:    "境界値系: repositoryの予期しない失敗は公開errorへ変換しない",
			input:   Input{ImageID: image.ID().String()},
			repoErr: errors.New("database unavailable"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
			if tt.repoErr != nil {
				imageRepo.FindByIDFn = func(context.Context, value_object.ID) (entity.JourneyImage, error) {
					return entity.JourneyImage{}, tt.repoErr
				}
			}
			uc := NewUseCase(imageRepo)

			output, err := uc.Execute(context.Background(), tt.input)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Execute() error = %v, want errors.Is(_, %v)", err, tt.wantErr)
				}
				return
			}
			if tt.repoErr != nil {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
				return
			}
			if err != nil {
				t.Fatalf("Execute() error = %v", err)
			}

			if output.Image.ID != image.ID().String() {
				t.Errorf("Image.ID = %q, want %q", output.Image.ID, image.ID().String())
			}
			if output.Image.Status != value_object.ImageStatusReady.String() {
				t.Errorf("Image.Status = %q, want %q", output.Image.Status, value_object.ImageStatusReady)
			}
			if !output.Image.HasContent {
				t.Error("Image.HasContent = false, want true")
			}
			if output.Image.MediaType != "image/jpeg" {
				t.Errorf("Image.MediaType = %q, want image/jpeg", output.Image.MediaType)
			}
		})
	}
}

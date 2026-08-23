package getjourneyimage

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
	image entity.JourneyImage
	err   error
}

func (m *mockImageRepo) Save(_ context.Context, _ entity.JourneyImage) error {
	return nil
}

func (m *mockImageRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyImage, error) {
	if m.err != nil {
		return entity.JourneyImage{}, m.err
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
	image := mustNewReadyImage(t)

	tests := []struct {
		name    string
		input   Input
		image   entity.JourneyImage
		repoErr error
		wantErr error
	}{
		{
			name:  "正常系: ready画像をDTOへ変換する",
			input: Input{ImageID: image.ID().String()},
			image: image,
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
			uc := NewUseCase(&mockImageRepo{image: tt.image, err: tt.repoErr})

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

func mustNewReadyImage(t *testing.T) entity.JourneyImage {
	t.Helper()

	slot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), value_object.NewID(), slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	assetReference, err := value_object.NewImageAssetReference("images/test.jpg", "image/jpeg", 1600, 900)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	if err := image.Complete(assetReference); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}

	return image
}

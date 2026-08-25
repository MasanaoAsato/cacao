package getjourneyimagecontent

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/service"
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

type mockStorage struct {
	content   io.ReadCloser
	openErr   error
	openCalls int
}

func (m *mockStorage) Save(
	_ context.Context,
	_ value_object.ID,
	_ service.GeneratedImage,
) (value_object.ImageAssetReference, error) {
	return value_object.ImageAssetReference{}, nil
}

func (m *mockStorage) Open(
	_ context.Context,
	_ value_object.ImageAssetReference,
) (io.ReadCloser, error) {
	m.openCalls++
	if m.openErr != nil {
		return nil, m.openErr
	}

	return m.content, nil
}

func (m *mockStorage) Delete(_ context.Context, _ value_object.ImageAssetReference) error {
	return nil
}

type trackingReadCloser struct {
	*bytes.Reader
	closed bool
}

func (r *trackingReadCloser) Close() error {
	r.closed = true
	return nil
}

func TestUseCaseExecute(t *testing.T) {
	readyImage := mustNewReadyImage(t)
	pendingImage := mustNewPendingImage(t)

	tests := []struct {
		name       string
		input      Input
		image      entity.JourneyImage
		repoErr    error
		storageErr error
		wantErr    error
		wantOpen   int
	}{
		{
			name:     "正常系: ready画像のcontentを開く",
			input:    Input{ImageID: readyImage.ID().String()},
			image:    readyImage,
			wantOpen: 1,
		},
		{
			name:    "異常系: pending画像ではstorageを呼ばない",
			input:   Input{ImageID: pendingImage.ID().String()},
			image:   pendingImage,
			wantErr: application.ErrJourneyImageNotReady,
		},
		{
			name:    "異常系: image idが不正",
			input:   Input{ImageID: "invalid-id"},
			wantErr: application.ErrInvalidInput,
		},
		{
			name:    "異常系: 画像が存在しない",
			input:   Input{ImageID: readyImage.ID().String()},
			repoErr: repository.ErrJourneyImageNotFound,
			wantErr: application.ErrJourneyImageNotFound,
		},
		{
			name:       "異常系: storageの失敗を返す",
			input:      Input{ImageID: readyImage.ID().String()},
			image:      readyImage,
			storageErr: errors.New("storage unavailable"),
			wantOpen:   1,
		},
		{
			name:     "正常系: ETagは画像idを返す",
			input:    Input{ImageID: readyImage.ID().String()},
			image:    readyImage,
			wantOpen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := &trackingReadCloser{Reader: bytes.NewReader([]byte("image bytes"))}
			storage := &mockStorage{content: reader, openErr: tt.storageErr}
			uc := NewUseCase(&mockImageRepo{image: tt.image, err: tt.repoErr}, storage)

			output, err := uc.Execute(context.Background(), tt.input)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Execute() error = %v, want errors.Is(_, %v)", err, tt.wantErr)
				}
			} else if tt.storageErr != nil {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
			} else if err != nil {
				t.Fatalf("Execute() error = %v", err)
			} else {
				if output.Content == nil {
					t.Fatal("Content = nil, want reader")
				}
				if reader.closed {
					t.Fatal("Content was closed by use case")
				}
				if output.MediaType != "image/png" {
					t.Errorf("MediaType = %q, want image/png", output.MediaType)
				}
				if output.ETag != readyImage.ID().String() {
					t.Errorf("ETag = %q, want image id", output.ETag)
				}
				if closeErr := output.Content.Close(); closeErr != nil {
					t.Errorf("Content.Close() error = %v", closeErr)
				}
			}

			if storage.openCalls != tt.wantOpen {
				t.Errorf("Open() calls = %d, want %d", storage.openCalls, tt.wantOpen)
			}
		})
	}
}

func mustNewReadyImage(t *testing.T) entity.JourneyImage {
	t.Helper()

	image := mustNewPendingImage(t)
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	assetReference, err := value_object.NewImageAssetReference("images/test.png", "image/png", 1200, 800)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	if err := image.Complete(assetReference); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}

	return image
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

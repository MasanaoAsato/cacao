package getjourneyimagecontent

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

// mockStorage は Open の呼び出し回数と返す内容を制御する service.ImageStorage のスタブ。
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
	readyImage := testkit.MustNewReadyImage(t)
	pendingImage := testkit.MustNewPendingImage(t)

	tests := []struct {
		name       string
		input      Input
		repoErr    error
		storageErr error
		wantErr    error
		wantOpen   int
	}{
		{
			name:     "正常系: ready画像のcontentを開く",
			input:    Input{ImageID: readyImage.ID().String()},
			wantOpen: 1,
		},
		{
			name:    "異常系: pending画像ではstorageを呼ばない",
			input:   Input{ImageID: pendingImage.ID().String()},
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
			storageErr: errors.New("storage unavailable"),
			wantOpen:   1,
		},
		{
			name:     "正常系: ETagは画像idを返す",
			input:    Input{ImageID: readyImage.ID().String()},
			wantOpen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := &trackingReadCloser{Reader: bytes.NewReader([]byte("image bytes"))}
			storage := &mockStorage{content: reader, openErr: tt.storageErr}
			imageRepo := fakes.NewJourneyImageRepositoryWith(t, readyImage, pendingImage)
			if tt.repoErr != nil {
				imageRepo.FindByIDFn = func(context.Context, value_object.ID) (entity.JourneyImage, error) {
					return entity.JourneyImage{}, tt.repoErr
				}
			}
			uc := NewUseCase(imageRepo, storage)

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
				if output.MediaType != "image/jpeg" {
					t.Errorf("MediaType = %q, want image/jpeg", output.MediaType)
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

package listjourneyimages

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
	request := testkit.MustNewJourneyRequest(t)
	readyImage := mustNewReadyImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
	failedImage := mustNewFailedImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeIllustration, 1))

	tests := []struct {
		name       string
		input      Input
		requestErr error
		images     []entity.JourneyImage
		imageErr   error
		wantErr    error
		wantCount  int
	}{
		{
			name:      "正常系: 画像をDTOへ変換する",
			input:     Input{RequestID: request.ID().String()},
			images:    []entity.JourneyImage{readyImage, failedImage},
			wantCount: 2,
		},
		{
			name:   "境界値系: 画像が0件でも空sliceを返す",
			input:  Input{RequestID: request.ID().String()},
			images: []entity.JourneyImage{},
		},
		{
			name:    "異常系: request idが不正",
			input:   Input{RequestID: "invalid-id"},
			wantErr: application.ErrInvalidInput,
		},
		{
			name:       "異常系: journey requestが存在しない",
			input:      Input{RequestID: request.ID().String()},
			requestErr: repository.ErrJourneyRequestNotFound,
			wantErr:    application.ErrRequestNotFound,
		},
		{
			name:     "異常系: repositoryの取得に失敗する",
			input:    Input{RequestID: request.ID().String()},
			imageErr: errors.New("database unavailable"),
			wantErr:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestRepo := fakes.NewJourneyRequestRepositoryWith(t, request)
			if tt.requestErr != nil {
				requestRepo.FindByIDFn = func(context.Context, value_object.ID) (entity.JourneyRequest, error) {
					return entity.JourneyRequest{}, tt.requestErr
				}
			}
			imageRepo := fakes.NewJourneyImageRepositoryWith(t, tt.images...)
			if tt.imageErr != nil {
				imageRepo.FindByRequestIDFn = func(context.Context, value_object.ID) ([]entity.JourneyImage, error) {
					return nil, tt.imageErr
				}
			}
			uc := NewUseCase(requestRepo, imageRepo)

			output, err := uc.Execute(context.Background(), tt.input)
			if tt.imageErr != nil {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
				return
			}
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Execute() error = %v, want errors.Is(_, %v)", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Execute() error = %v", err)
			}

			if output.JourneyRequestID != request.ID().String() {
				t.Errorf("JourneyRequestID = %q, want %q", output.JourneyRequestID, request.ID().String())
			}
			if output.Images == nil {
				t.Error("Images = nil, want empty slice or populated slice")
			}
			if len(output.Images) != tt.wantCount {
				t.Fatalf("len(Images) = %d, want %d", len(output.Images), tt.wantCount)
			}
			if tt.wantCount == 0 {
				return
			}

			if !output.Images[0].HasContent {
				t.Error("ready image HasContent = false, want true")
			}
			if output.Images[0].MediaType != "image/jpeg" {
				t.Errorf("MediaType = %q, want image/jpeg", output.Images[0].MediaType)
			}
			if !output.Images[1].HasFailureCode {
				t.Error("failed image HasFailureCode = false, want true")
			}
			if output.Images[1].FailureCode != "provider_timeout" {
				t.Errorf("FailureCode = %q, want provider_timeout", output.Images[1].FailureCode)
			}
		})
	}
}

// mustNewReadyImageFor は requestID とスロットを指定して ready 画像を作る。
// testkit の ready ビルダーは requestID を新規発行するため、同一リクエストに属する画像はここで組み立てる。
func mustNewReadyImageFor(t *testing.T, requestID value_object.ID, slot value_object.ImageSlot) entity.JourneyImage {
	t.Helper()

	image := testkit.MustNewPendingImageFor(t, requestID, slot)
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	visualStyle := value_object.ImageVisualStyleEditorialPhotograph
	if slot.Purpose() == value_object.ImagePurposeIllustration {
		visualStyle = value_object.ImageVisualStyleNone
	}
	if err := image.Complete(testkit.MustNewAssetReference(t), visualStyle); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}

	return image
}

// mustNewFailedImageFor は requestID とスロットを指定して provider_timeout で failed になった画像を作る。
func mustNewFailedImageFor(t *testing.T, requestID value_object.ID, slot value_object.ImageSlot) entity.JourneyImage {
	t.Helper()

	image := testkit.MustNewPendingImageFor(t, requestID, slot)
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

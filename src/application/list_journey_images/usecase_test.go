package listjourneyimages

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

type mockRequestRepo struct {
	request entity.JourneyRequest
	err     error
}

func (m *mockRequestRepo) Save(_ context.Context, _ entity.JourneyRequest) error {
	return nil
}

func (m *mockRequestRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyRequest, error) {
	if m.err != nil {
		return entity.JourneyRequest{}, m.err
	}

	return m.request, nil
}

func (m *mockRequestRepo) FindAll(_ context.Context) ([]entity.JourneyRequest, error) {
	return []entity.JourneyRequest{}, nil
}

func (m *mockRequestRepo) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

type mockImageRepo struct {
	images []entity.JourneyImage
	err    error
}

func (m *mockImageRepo) Save(_ context.Context, _ entity.JourneyImage) error {
	return nil
}

func (m *mockImageRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyImage, error) {
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (m *mockImageRepo) FindByRequestID(
	_ context.Context,
	_ value_object.ID,
) ([]entity.JourneyImage, error) {
	if m.err != nil {
		return nil, m.err
	}

	return m.images, nil
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
	request := mustNewJourneyRequest(t)
	readyImage := mustNewReadyImage(t, request.ID(), value_object.ImagePurposeCover, 1)
	failedImage := mustNewFailedImage(t, request.ID(), value_object.ImagePurposeIllustration, 1)

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
			uc := NewUseCase(
				&mockRequestRepo{request: request, err: tt.requestErr},
				&mockImageRepo{images: tt.images, err: tt.imageErr},
			)

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
			if output.Images[0].MediaType != "image/png" {
				t.Errorf("MediaType = %q, want image/png", output.Images[0].MediaType)
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

func mustNewJourneyRequest(t *testing.T) entity.JourneyRequest {
	t.Helper()

	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("NewDeparture() error = %v", err)
	}
	destination, err := value_object.NewDestination("大阪", "日本")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	period, err := value_object.NewPeriod(
		time.Date(2026, time.July, 7, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.July, 9, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("NewCurrency() error = %v", err)
	}
	budget, err := value_object.NewMoney(50000, currency)
	if err != nil {
		t.Fatalf("NewMoney() error = %v", err)
	}
	request, err := entity.NewJourneyRequest(
		value_object.NewID(),
		departure,
		destination,
		period,
		budget,
	)
	if err != nil {
		t.Fatalf("NewJourneyRequest() error = %v", err)
	}

	return request
}

func mustNewReadyImage(
	t *testing.T,
	requestID value_object.ID,
	purpose value_object.ImagePurpose,
	ordinal int,
) entity.JourneyImage {
	t.Helper()

	slot, err := value_object.NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
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

func mustNewFailedImage(
	t *testing.T,
	requestID value_object.ID,
	purpose value_object.ImagePurpose,
	ordinal int,
) entity.JourneyImage {
	t.Helper()

	slot, err := value_object.NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
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

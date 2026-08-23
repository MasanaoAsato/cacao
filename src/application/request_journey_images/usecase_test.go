package requestjourneyimages

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
	images           map[value_object.ImageSlot]entity.JourneyImage
	concurrentImages map[value_object.ImageSlot]entity.JourneyImage
	findBySlotCalls  map[value_object.ImageSlot]int
	saveErr          error
	saveCalls        int
	findByRequestErr error
	findBySlotErr    error
}

func newMockImageRepo() *mockImageRepo {
	return &mockImageRepo{
		images:           map[value_object.ImageSlot]entity.JourneyImage{},
		concurrentImages: map[value_object.ImageSlot]entity.JourneyImage{},
		findBySlotCalls:  map[value_object.ImageSlot]int{},
	}
}

func (m *mockImageRepo) Save(_ context.Context, image entity.JourneyImage) error {
	m.saveCalls++
	if m.saveErr != nil {
		return m.saveErr
	}

	m.images[image.Slot()] = image
	return nil
}

func (m *mockImageRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyImage, error) {
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (m *mockImageRepo) FindByRequestID(
	_ context.Context,
	_ value_object.ID,
) ([]entity.JourneyImage, error) {
	if m.findByRequestErr != nil {
		return nil, m.findByRequestErr
	}

	return []entity.JourneyImage{}, nil
}

func (m *mockImageRepo) FindBySlot(
	_ context.Context,
	_ value_object.ID,
	slot value_object.ImageSlot,
) (entity.JourneyImage, error) {
	if m.findBySlotErr != nil {
		return entity.JourneyImage{}, m.findBySlotErr
	}

	m.findBySlotCalls[slot]++
	if image, ok := m.images[slot]; ok {
		return image, nil
	}
	if image, ok := m.concurrentImages[slot]; ok && m.findBySlotCalls[slot] > 1 {
		return image, nil
	}

	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (m *mockImageRepo) FindPending(
	_ context.Context,
	_ int,
) ([]entity.JourneyImage, error) {
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
	coverSlot := mustNewSlot(t, value_object.ImagePurposeCover, 1)
	illustrationThree := mustNewSlot(t, value_object.ImagePurposeIllustration, 3)

	tests := []struct {
		name           string
		input          Input
		requestErr     error
		setupImageRepo func(*mockImageRepo)
		wantErr        error
		wantImageCount int
		wantSaveCalls  int
		wantFirstSlot  value_object.ImageSlot
		wantLastSlot   value_object.ImageSlot
	}{
		{
			name: "正常系: 4slotをslot順に要求する",
			input: Input{
				RequestID: request.ID().String(),
				Slots: []SlotInput{
					{Purpose: "illustration", Ordinal: 3},
					{Purpose: "cover", Ordinal: 1},
					{Purpose: "illustration", Ordinal: 1},
					{Purpose: "illustration", Ordinal: 2},
				},
			},
			wantImageCount: 4,
			wantSaveCalls:  4,
			wantFirstSlot:  coverSlot,
			wantLastSlot:   illustrationThree,
		},
		{
			name: "境界値系: 1slotを要求する",
			input: Input{
				RequestID: request.ID().String(),
				Slots:     []SlotInput{{Purpose: "cover", Ordinal: 1}},
			},
			wantImageCount: 1,
			wantSaveCalls:  1,
			wantFirstSlot:  coverSlot,
			wantLastSlot:   coverSlot,
		},
		{
			name: "正常系: 同じslotの再送で既存画像を返す",
			input: Input{
				RequestID: request.ID().String(),
				Slots:     []SlotInput{{Purpose: "cover", Ordinal: 1}},
			},
			setupImageRepo: func(imageRepo *mockImageRepo) {
				imageRepo.images[coverSlot] = mustNewImage(t, request.ID(), coverSlot)
			},
			wantImageCount: 1,
			wantFirstSlot:  coverSlot,
			wantLastSlot:   coverSlot,
		},
		{
			name: "境界値系: 一意制約競合時に既存画像を返す",
			input: Input{
				RequestID: request.ID().String(),
				Slots:     []SlotInput{{Purpose: "cover", Ordinal: 1}},
			},
			setupImageRepo: func(imageRepo *mockImageRepo) {
				imageRepo.saveErr = repository.ErrJourneyImageSlotAlreadyExists
				imageRepo.concurrentImages[coverSlot] = mustNewImage(t, request.ID(), coverSlot)
			},
			wantImageCount: 1,
			wantSaveCalls:  1,
			wantFirstSlot:  coverSlot,
			wantLastSlot:   coverSlot,
		},
		{
			name: "異常系: request idが不正",
			input: Input{
				RequestID: "invalid-id",
				Slots:     []SlotInput{{Purpose: "cover", Ordinal: 1}},
			},
			wantErr: application.ErrInvalidInput,
		},
		{
			name: "異常系: slotsが空",
			input: Input{
				RequestID: request.ID().String(),
				Slots:     []SlotInput{},
			},
			wantErr: application.ErrInvalidInput,
		},
		{
			name: "異常系: slotsが5件",
			input: Input{
				RequestID: request.ID().String(),
				Slots: []SlotInput{
					{Purpose: "cover", Ordinal: 1},
					{Purpose: "illustration", Ordinal: 1},
					{Purpose: "illustration", Ordinal: 2},
					{Purpose: "illustration", Ordinal: 3},
					{Purpose: "cover", Ordinal: 1},
				},
			},
			wantErr: application.ErrInvalidInput,
		},
		{
			name: "異常系: 同じslotが重複",
			input: Input{
				RequestID: request.ID().String(),
				Slots: []SlotInput{
					{Purpose: "cover", Ordinal: 1},
					{Purpose: "cover", Ordinal: 1},
				},
			},
			wantErr: application.ErrInvalidInput,
		},
		{
			name: "異常系: illustrationのordinalが不正",
			input: Input{
				RequestID: request.ID().String(),
				Slots:     []SlotInput{{Purpose: "illustration", Ordinal: 4}},
			},
			wantErr: application.ErrInvalidInput,
		},
		{
			name: "異常系: journey requestが存在しない",
			input: Input{
				RequestID: request.ID().String(),
				Slots:     []SlotInput{{Purpose: "cover", Ordinal: 1}},
			},
			requestErr: repository.ErrJourneyRequestNotFound,
			wantErr:    application.ErrRequestNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			imageRepo := newMockImageRepo()
			if tt.setupImageRepo != nil {
				tt.setupImageRepo(imageRepo)
			}
			uc := NewUseCase(
				&mockRequestRepo{request: request, err: tt.requestErr},
				imageRepo,
			)

			output, err := uc.Execute(context.Background(), tt.input)
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
			if len(output.Images) != tt.wantImageCount {
				t.Fatalf("len(Images) = %d, want %d", len(output.Images), tt.wantImageCount)
			}
			if imageRepo.saveCalls != tt.wantSaveCalls {
				t.Errorf("Save() calls = %d, want %d", imageRepo.saveCalls, tt.wantSaveCalls)
			}
			if output.Images[0].Slot != slotDTO(tt.wantFirstSlot) {
				t.Errorf("first slot = %+v, want %+v", output.Images[0].Slot, slotDTO(tt.wantFirstSlot))
			}
			if output.Images[len(output.Images)-1].Slot != slotDTO(tt.wantLastSlot) {
				t.Errorf("last slot = %+v, want %+v", output.Images[len(output.Images)-1].Slot, slotDTO(tt.wantLastSlot))
			}
			for _, image := range output.Images {
				if image.Status != value_object.ImageStatusPending.String() {
					t.Errorf("Status = %q, want %q", image.Status, value_object.ImageStatusPending)
				}
				if image.AttemptCount != 0 {
					t.Errorf("AttemptCount = %d, want 0", image.AttemptCount)
				}
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

func mustNewSlot(t *testing.T, purpose value_object.ImagePurpose, ordinal int) value_object.ImageSlot {
	t.Helper()

	slot, err := value_object.NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}

	return slot
}

func mustNewImage(
	t *testing.T,
	requestID value_object.ID,
	slot value_object.ImageSlot,
) entity.JourneyImage {
	t.Helper()

	image, err := entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}

	return image
}

func slotDTO(slot value_object.ImageSlot) SlotDTO {
	return SlotDTO{
		Purpose: slot.Purpose().String(),
		Ordinal: slot.Ordinal(),
	}
}

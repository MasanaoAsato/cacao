package requestjourneyimages

import (
	"context"
	"errors"
	"testing"

	"cacao/src/application"
	"cacao/src/application/readmodel"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestUseCaseExecute(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)
	coverSlot := testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1)
	illustrationThree := testkit.MustNewImageSlot(t, value_object.ImagePurposeIllustration, 3)

	tests := []struct {
		name             string
		input            Input
		requestErr       error
		setupImageRepo   func(*fakes.FakeJourneyImageRepository)
		wantErr          error
		wantImageCount   int
		wantSaveCalls    int
		wantFirstSlot    value_object.ImageSlot
		wantLastSlot     value_object.ImageSlot
		maxIllustrations int
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
			setupImageRepo: func(imageRepo *fakes.FakeJourneyImageRepository) {
				// 埋め込みのインメモリ実装へ直接保存し、ユースケースの Save 呼び出し回数には含めない
				existing := testkit.MustNewPendingImageFor(t, request.ID(), coverSlot)
				if err := imageRepo.JourneyImageRepositoryMemory.Save(context.Background(), existing); err != nil {
					t.Fatalf("seed existing image: %v", err)
				}
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
			setupImageRepo: func(imageRepo *fakes.FakeJourneyImageRepository) {
				// Save の直前に別プロセスが同じ slot を作成した競合を再現する:
				// 1回目の FindBySlot は not found、Save は一意制約違反、2回目の FindBySlot で既存画像が見つかる
				concurrent := testkit.MustNewPendingImageFor(t, request.ID(), coverSlot)
				imageRepo.SaveFn = func(ctx context.Context, _ entity.JourneyImage) error {
					if err := imageRepo.JourneyImageRepositoryMemory.Save(ctx, concurrent); err != nil {
						t.Fatalf("save concurrent image: %v", err)
					}
					return repository.ErrJourneyImageSlotAlreadyExists
				}
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
			name: "境界値系: 設定した上限を超える挿絵を生成しない",
			input: Input{
				RequestID: request.ID().String(),
				Slots: []SlotInput{
					{Purpose: "cover", Ordinal: 1},
					{Purpose: "illustration", Ordinal: 1},
					{Purpose: "illustration", Ordinal: 2},
					{Purpose: "illustration", Ordinal: 3},
				},
			},
			wantImageCount: 2,
			wantSaveCalls:  2,
			wantFirstSlot:  coverSlot,
			wantLastSlot: testkit.MustNewImageSlot(
				t,
				value_object.ImagePurposeIllustration,
				1,
			),
			maxIllustrations: 1,
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
			requestRepo := fakes.NewJourneyRequestRepositoryWith(t, request)
			if tt.requestErr != nil {
				requestRepo.FindByIDFn = func(context.Context, value_object.ID) (entity.JourneyRequest, error) {
					return entity.JourneyRequest{}, tt.requestErr
				}
			}

			imageRepo := fakes.NewJourneyImageRepository()
			if tt.setupImageRepo != nil {
				tt.setupImageRepo(imageRepo)
			}
			// ユースケース経由の Save 呼び出しを数える。setup が差し替えた SaveFn があればそれへ委譲する。
			saveCalls := 0
			innerSave := imageRepo.SaveFn
			imageRepo.SaveFn = func(ctx context.Context, image entity.JourneyImage) error {
				saveCalls++
				if innerSave != nil {
					return innerSave(ctx, image)
				}
				return imageRepo.JourneyImageRepositoryMemory.Save(ctx, image)
			}
			maxIllustrations := tt.maxIllustrations
			if maxIllustrations == 0 {
				maxIllustrations = 3
			}
			uc := NewUseCase(requestRepo, imageRepo, maxIllustrations)

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
			if saveCalls != tt.wantSaveCalls {
				t.Errorf("Save() calls = %d, want %d", saveCalls, tt.wantSaveCalls)
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

func slotDTO(slot value_object.ImageSlot) readmodel.SlotDTO {
	return readmodel.SlotDTO{
		Purpose: slot.Purpose().String(),
		Ordinal: slot.Ordinal(),
	}
}

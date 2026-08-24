package postgres

import (
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

func TestJourneyImageModelConverter(t *testing.T) {
	requestID := value_object.NewID()
	completedAt := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	leaseUntil := completedAt.Add(time.Minute)

	tests := []struct {
		name  string
		image entity.JourneyImage
		model func(JourneyImageModel) JourneyImageModel
	}{
		{
			name: "正常系: pending",
			image: mustNewJourneyImageForConverter(
				t,
				requestID,
				value_object.ImagePurposeCover,
				1,
				0,
			),
			model: func(model JourneyImageModel) JourneyImageModel { return model },
		},
		{
			name: "正常系: processing",
			image: mustNewJourneyImageForConverter(
				t,
				requestID,
				value_object.ImagePurposeIllustration,
				1,
				1,
			),
			model: func(model JourneyImageModel) JourneyImageModel {
				model.LeaseUntil = pointer(leaseUntil)
				return model
			},
		},
		{
			name: "正常系: ready",
			image: mustNewJourneyImageForConverter(
				t,
				requestID,
				value_object.ImagePurposeIllustration,
				2,
				2,
			),
			model: func(model JourneyImageModel) JourneyImageModel {
				model.CompletedAt = pointer(completedAt)
				return model
			},
		},
		{
			name: "正常系: failed",
			image: mustNewJourneyImageForConverter(
				t,
				requestID,
				value_object.ImagePurposeIllustration,
				3,
				3,
			),
			model: func(model JourneyImageModel) JourneyImageModel { return model },
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			model, err := journeyImageToModel(testCase.image)
			if err != nil {
				t.Fatalf("journeyImageToModel() error = %v", err)
			}
			model = testCase.model(model)

			got, err := modelToJourneyImage(model)
			if err != nil {
				t.Fatalf("modelToJourneyImage() error = %v", err)
			}
			if !got.ID().Equals(testCase.image.ID()) {
				t.Errorf("ID() = %s, want %s", got.ID(), testCase.image.ID())
			}
			if !got.RequestID().Equals(testCase.image.RequestID()) {
				t.Errorf("RequestID() = %s, want %s", got.RequestID(), testCase.image.RequestID())
			}
			if got.Slot() != testCase.image.Slot() {
				t.Errorf("Slot() = %#v, want %#v", got.Slot(), testCase.image.Slot())
			}
			if got.Status() != testCase.image.Status() {
				t.Errorf("Status() = %q, want %q", got.Status(), testCase.image.Status())
			}
			if got.AttemptCount() != testCase.image.AttemptCount() {
				t.Errorf(
					"AttemptCount() = %d, want %d",
					got.AttemptCount(),
					testCase.image.AttemptCount(),
				)
			}
			assertJourneyImagePayloadEqual(t, got, testCase.image)
		})
	}
}

func TestJourneyImageModelConverterRejectsInvalidRow(t *testing.T) {
	readyImage := mustNewJourneyImageForConverter(
		t,
		value_object.NewID(),
		value_object.ImagePurposeCover,
		1,
		2,
	)
	readyModel, err := journeyImageToModel(readyImage)
	if err != nil {
		t.Fatalf("journeyImageToModel() error = %v", err)
	}
	readyModel.CompletedAt = pointer(time.Now().UTC())

	processingImage := mustNewJourneyImageForConverter(
		t,
		value_object.NewID(),
		value_object.ImagePurposeCover,
		1,
		0,
	)
	if err := processingImage.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	processingModel, err := journeyImageToModel(processingImage)
	if err != nil {
		t.Fatalf("journeyImageToModel() error = %v", err)
	}

	tests := []struct {
		name  string
		model JourneyImageModel
	}{
		{
			name: "異常系: ready に completed_at がない",
			model: func() JourneyImageModel {
				model := readyModel
				model.CompletedAt = nil
				return model
			}(),
		},
		{
			name:  "異常系: processing に lease_until がない",
			model: processingModel,
		},
		{
			name: "異常系: asset の列が部分的にしかない",
			model: func() JourneyImageModel {
				model := readyModel
				model.StorageKey = nil
				return model
			}(),
		},
		{
			name: "境界値系: attempt_count が3を1超える",
			model: func() JourneyImageModel {
				model := readyModel
				model.AttemptCount = entity.MaxImageGenerationAttempts + 1
				return model
			}(),
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := modelToJourneyImage(testCase.model)
			if err == nil {
				t.Fatal("modelToJourneyImage() error = nil, want error")
			}
		})
	}
}

func mustNewJourneyImageForConverter(
	t *testing.T,
	requestID value_object.ID,
	purpose value_object.ImagePurpose,
	ordinal int,
	state int,
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

	for attempt := 1; attempt <= state; attempt++ {
		if err := image.Start(); err != nil {
			t.Fatalf("Start() error = %v", err)
		}
		if attempt == state {
			break
		}
		if err := image.Fail(value_object.ImageFailureCodeInternalError); err != nil {
			t.Fatalf("Fail() error = %v", err)
		}
		if err := image.Retry(); err != nil {
			t.Fatalf("Retry() error = %v", err)
		}
	}

	switch state {
	case 0:
		return image
	case 1:
		return image
	case 2:
		assetReference, err := value_object.NewImageAssetReference(
			"ab/cover.png",
			"image/png",
			100,
			200,
		)
		if err != nil {
			t.Fatalf("NewImageAssetReference() error = %v", err)
		}
		if err := image.Complete(assetReference); err != nil {
			t.Fatalf("Complete() error = %v", err)
		}
		return image
	case 3:
		if err := image.Fail(value_object.ImageFailureCodeInternalError); err != nil {
			t.Fatalf("Fail() error = %v", err)
		}
		return image
	default:
		t.Fatalf("unsupported state: %d", state)
		return entity.JourneyImage{}
	}
}

func assertJourneyImagePayloadEqual(
	t *testing.T,
	got entity.JourneyImage,
	want entity.JourneyImage,
) {
	t.Helper()

	gotAssetReference, gotHasAssetReference := got.AssetReference()
	wantAssetReference, wantHasAssetReference := want.AssetReference()
	if gotHasAssetReference != wantHasAssetReference ||
		gotAssetReference != wantAssetReference {
		t.Errorf(
			"AssetReference() = (%#v, %t), want (%#v, %t)",
			gotAssetReference,
			gotHasAssetReference,
			wantAssetReference,
			wantHasAssetReference,
		)
	}

	gotFailureCode, gotHasFailureCode := got.FailureCode()
	wantFailureCode, wantHasFailureCode := want.FailureCode()
	if gotHasFailureCode != wantHasFailureCode || gotFailureCode != wantFailureCode {
		t.Errorf(
			"FailureCode() = (%q, %t), want (%q, %t)",
			gotFailureCode,
			gotHasFailureCode,
			wantFailureCode,
			wantHasFailureCode,
		)
	}
}

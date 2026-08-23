package entity

import (
	"errors"
	"testing"

	"cacao/src/domain/value_object"
)

func TestNewJourneyImage(t *testing.T) {
	validID := value_object.NewID()
	validRequestID := value_object.NewID()
	validSlot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}

	tests := []struct {
		name      string
		id        value_object.ID
		requestID value_object.ID
		slot      value_object.ImageSlot
		wantErr   bool
	}{
		{
			name:      "正常系 : 生成直後はpendingかつassetとfailureがない",
			id:        validID,
			requestID: validRequestID,
			slot:      validSlot,
		},
		{
			name:      "異常系 : IDが空",
			id:        value_object.ID{},
			requestID: validRequestID,
			slot:      validSlot,
			wantErr:   true,
		},
		{
			name:      "異常系 : requestIDが空",
			id:        validID,
			requestID: value_object.ID{},
			slot:      validSlot,
			wantErr:   true,
		},
		{
			name:      "異常系 : slotが不正",
			id:        validID,
			requestID: validRequestID,
			slot:      value_object.ImageSlot{},
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			image, err := NewJourneyImage(tt.id, tt.requestID, tt.slot)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NewJourneyImage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}

			if !image.ID().Equals(tt.id) {
				t.Errorf("ID() = %v, want %v", image.ID(), tt.id)
			}
			if !image.RequestID().Equals(tt.requestID) {
				t.Errorf("RequestID() = %v, want %v", image.RequestID(), tt.requestID)
			}
			if image.Slot() != tt.slot {
				t.Errorf("Slot() = %v, want %v", image.Slot(), tt.slot)
			}
			if image.Status() != value_object.ImageStatusPending {
				t.Errorf("Status() = %q, want %q", image.Status(), value_object.ImageStatusPending)
			}
			if image.AttemptCount() != 0 {
				t.Errorf("AttemptCount() = %d, want 0", image.AttemptCount())
			}
			if _, ok := image.AssetReference(); ok {
				t.Fatal("AssetReference() has a value, want no asset")
			}
			if _, ok := image.FailureCode(); ok {
				t.Fatal("FailureCode() has a value, want no failure code")
			}
		})
	}
}

func TestJourneyImageStateTransitions(t *testing.T) {
	validID := value_object.NewID()
	validRequestID := value_object.NewID()
	validSlot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	validAssetReference, err := value_object.NewImageAssetReference(
		"journey-images/example.png",
		"image/png",
		1200,
		800,
	)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	validFailureCode, err := value_object.NewImageFailureCode("provider_timeout")
	if err != nil {
		t.Fatalf("NewImageFailureCode() error = %v", err)
	}

	newImage := func(t *testing.T) JourneyImage {
		t.Helper()

		image, err := NewJourneyImage(validID, validRequestID, validSlot)
		if err != nil {
			t.Fatalf("NewJourneyImage() error = %v", err)
		}

		return image
	}
	startImage := func(t *testing.T) JourneyImage {
		t.Helper()

		image := newImage(t)
		if err := image.Start(); err != nil {
			t.Fatalf("Start() error = %v", err)
		}

		return image
	}
	failedImage := func(t *testing.T) JourneyImage {
		t.Helper()

		image := startImage(t)
		if err := image.Fail(validFailureCode); err != nil {
			t.Fatalf("Fail() error = %v", err)
		}

		return image
	}
	failedImageAtLimit := func(t *testing.T) JourneyImage {
		t.Helper()

		image := newImage(t)
		for attempt := 1; attempt <= MaxImageGenerationAttempts; attempt++ {
			if err := image.Start(); err != nil {
				t.Fatalf("Start() error = %v", err)
			}
			if err := image.Fail(validFailureCode); err != nil {
				t.Fatalf("Fail() error = %v", err)
			}
			if attempt == MaxImageGenerationAttempts {
				continue
			}
			if err := image.Retry(); err != nil {
				t.Fatalf("Retry() error = %v", err)
			}
		}

		return image
	}

	tests := []struct {
		name        string
		prepare     func(t *testing.T) JourneyImage
		transition  func(image *JourneyImage) error
		wantErr     error
		wantStatus  value_object.ImageStatus
		wantAttempt int
		wantAsset   bool
		wantFailure bool
	}{
		{
			name:    "正常系: startからcomplete",
			prepare: newImage,
			transition: func(image *JourneyImage) error {
				if err := image.Start(); err != nil {
					return err
				}

				return image.Complete(validAssetReference)
			},
			wantStatus:  value_object.ImageStatusReady,
			wantAttempt: 1,
			wantAsset:   true,
		},
		{
			name:    "正常系: startからfail",
			prepare: newImage,
			transition: func(image *JourneyImage) error {
				if err := image.Start(); err != nil {
					return err
				}

				return image.Fail(validFailureCode)
			},
			wantStatus:  value_object.ImageStatusFailed,
			wantAttempt: 1,
			wantFailure: true,
		},
		{
			name:    "正常系: failからretry",
			prepare: failedImage,
			transition: func(image *JourneyImage) error {
				return image.Retry()
			},
			wantStatus:  value_object.ImageStatusPending,
			wantAttempt: 1,
		},
		{
			name:    "異常系: pendingからcomplete",
			prepare: newImage,
			transition: func(image *JourneyImage) error {
				return image.Complete(validAssetReference)
			},
			wantErr:     ErrInvalidImageTransition,
			wantStatus:  value_object.ImageStatusPending,
			wantAttempt: 0,
		},
		{
			name:    "異常系: processingからstart",
			prepare: startImage,
			transition: func(image *JourneyImage) error {
				return image.Start()
			},
			wantErr:     ErrInvalidImageTransition,
			wantStatus:  value_object.ImageStatusProcessing,
			wantAttempt: 1,
		},
		{
			name:    "異常系: processingで無効なasset reference",
			prepare: startImage,
			transition: func(image *JourneyImage) error {
				return image.Complete(value_object.ImageAssetReference{})
			},
			wantErr:     ErrInvalidJourneyImage,
			wantStatus:  value_object.ImageStatusProcessing,
			wantAttempt: 1,
		},
		{
			name:    "異常系: processingで無効なfailure code",
			prepare: startImage,
			transition: func(image *JourneyImage) error {
				return image.Fail(value_object.ImageFailureCode(""))
			},
			wantErr:     ErrInvalidJourneyImage,
			wantStatus:  value_object.ImageStatusProcessing,
			wantAttempt: 1,
		},
		{
			name: "境界値系: 2回失敗後の3回目start",
			prepare: func(t *testing.T) JourneyImage {
				t.Helper()

				image := newImage(t)
				for range 2 {
					if err := image.Start(); err != nil {
						t.Fatalf("Start() error = %v", err)
					}
					if err := image.Fail(validFailureCode); err != nil {
						t.Fatalf("Fail() error = %v", err)
					}
					if err := image.Retry(); err != nil {
						t.Fatalf("Retry() error = %v", err)
					}
				}

				return image
			},
			transition: func(image *JourneyImage) error {
				return image.Start()
			},
			wantStatus:  value_object.ImageStatusProcessing,
			wantAttempt: 3,
		},
		{
			name:    "境界値系: 3回目失敗後のretry",
			prepare: failedImageAtLimit,
			transition: func(image *JourneyImage) error {
				return image.Retry()
			},
			wantErr:     ErrImageRetryNotAllowed,
			wantStatus:  value_object.ImageStatusFailed,
			wantAttempt: MaxImageGenerationAttempts,
			wantFailure: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			image := tt.prepare(t)

			err := tt.transition(&image)
			if tt.wantErr == nil && err != nil {
				t.Fatalf("transition() error = %v", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("transition() error = %v, want errors.Is(_, %v)", err, tt.wantErr)
			}

			if image.Status() != tt.wantStatus {
				t.Errorf("Status() = %q, want %q", image.Status(), tt.wantStatus)
			}
			if image.AttemptCount() != tt.wantAttempt {
				t.Errorf("AttemptCount() = %d, want %d", image.AttemptCount(), tt.wantAttempt)
			}

			assetReference, hasAssetReference := image.AssetReference()
			if hasAssetReference != tt.wantAsset {
				t.Errorf("AssetReference() has value = %v, want %v", hasAssetReference, tt.wantAsset)
			}
			if hasAssetReference && assetReference != validAssetReference {
				t.Errorf("AssetReference() = %v, want %v", assetReference, validAssetReference)
			}

			failureCode, hasFailureCode := image.FailureCode()
			if hasFailureCode != tt.wantFailure {
				t.Errorf("FailureCode() has value = %v, want %v", hasFailureCode, tt.wantFailure)
			}
			if hasFailureCode && failureCode != validFailureCode {
				t.Errorf("FailureCode() = %q, want %q", failureCode, validFailureCode)
			}
		})
	}
}

func TestRestoreJourneyImage(t *testing.T) {
	validID := value_object.NewID()
	validRequestID := value_object.NewID()
	validSlot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	validAssetRef, err := value_object.NewImageAssetReference(
		"journey-images/example.png",
		"image/png",
		1200,
		800,
	)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	validFailureCode, err := value_object.NewImageFailureCode("provider_timeout")
	if err != nil {
		t.Fatalf("NewImageFailureCode() error = %v", err)
	}

	tests := []struct {
		name         string
		id           value_object.ID
		requestID    value_object.ID
		slot         value_object.ImageSlot
		status       value_object.ImageStatus
		assetRef     value_object.ImageAssetReference
		failureCode  value_object.ImageFailureCode
		attemptCount int
		wantAsset    bool
		wantFailure  bool
		wantErr      bool
	}{
		{
			name:         "正常系 : pendingをattemptCount 0で復元",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusPending,
			attemptCount: 0,
		},
		{
			name:         "正常系 : processingをattemptCount 1で復元",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusProcessing,
			attemptCount: 1,
		},
		{
			name:         "正常系 : readyをasset付きで復元",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusReady,
			assetRef:     validAssetRef,
			attemptCount: 1,
			wantAsset:    true,
		},
		{
			name:         "正常系 : failedをfailure code付きで復元",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusFailed,
			failureCode:  validFailureCode,
			attemptCount: 1,
			wantFailure:  true,
		},
		{
			name:         "境界値系 : pendingをattemptCount 2で復元",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusPending,
			attemptCount: 2,
		},
		{
			name:         "境界値系 : processingをattemptCount 3で復元",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusProcessing,
			attemptCount: 3,
		},
		{
			name:         "異常系 : pendingにassetがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusPending,
			assetRef:     validAssetRef,
			attemptCount: 0,
			wantErr:      true,
		},
		{
			name:         "異常系 : pendingにfailure codeがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusPending,
			failureCode:  validFailureCode,
			attemptCount: 0,
			wantErr:      true,
		},
		{
			name:         "異常系 : processingにassetがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusProcessing,
			assetRef:     validAssetRef,
			attemptCount: 1,
			wantErr:      true,
		},
		{
			name:         "異常系 : processingにfailure codeがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusProcessing,
			failureCode:  validFailureCode,
			attemptCount: 1,
			wantErr:      true,
		},
		{
			name:      "異常系 : IDが空",
			id:        value_object.ID{},
			requestID: validRequestID,
			slot:      validSlot,
			status:    value_object.ImageStatusPending,
			wantErr:   true,
		},
		{
			name:      "異常系 : requestIDが空",
			id:        validID,
			requestID: value_object.ID{},
			slot:      validSlot,
			status:    value_object.ImageStatusPending,
			wantErr:   true,
		},
		{
			name:      "異常系 : slotが不正",
			id:        validID,
			requestID: validRequestID,
			slot:      value_object.ImageSlot{},
			status:    value_object.ImageStatusPending,
			wantErr:   true,
		},
		{
			name:      "異常系 : statusが未知",
			id:        validID,
			requestID: validRequestID,
			slot:      validSlot,
			status:    value_object.ImageStatus("unknown"),
			wantErr:   true,
		},
		{
			name:         "境界値系 : pendingのattemptCountが負数",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusPending,
			attemptCount: -1,
			wantErr:      true,
		},
		{
			name:         "境界値系 : pendingのattemptCountが上限超過",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusPending,
			attemptCount: 3,
			wantErr:      true,
		},
		{
			name:         "境界値系 : processingのattemptCountが0",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusProcessing,
			attemptCount: 0,
			wantErr:      true,
		},
		{
			name:         "境界値系 : readyのattemptCountが上限超過",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusReady,
			assetRef:     validAssetRef,
			attemptCount: 4,
			wantErr:      true,
		},
		{
			name:         "異常系 : readyにassetがない",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusReady,
			attemptCount: 1,
			wantErr:      true,
		},
		{
			name:         "異常系 : readyにfailure codeがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusReady,
			assetRef:     validAssetRef,
			failureCode:  validFailureCode,
			attemptCount: 1,
			wantErr:      true,
		},
		{
			name:         "異常系 : failedにfailure codeがない",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusFailed,
			attemptCount: 1,
			wantErr:      true,
		},
		{
			name:         "異常系 : failedに未知のfailure codeがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusFailed,
			failureCode:  value_object.ImageFailureCode("unknown"),
			attemptCount: 1,
			wantErr:      true,
		},
		{
			name:         "異常系 : failedにassetがある",
			id:           validID,
			requestID:    validRequestID,
			slot:         validSlot,
			status:       value_object.ImageStatusFailed,
			assetRef:     validAssetRef,
			failureCode:  validFailureCode,
			attemptCount: 1,
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			image, err := RestoreJourneyImage(
				tt.id,
				tt.requestID,
				tt.slot,
				tt.status,
				tt.assetRef,
				tt.failureCode,
				tt.attemptCount,
			)
			if (err != nil) != tt.wantErr {
				t.Fatalf("RestoreJourneyImage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				if !errors.Is(err, ErrInvalidJourneyImage) {
					t.Fatalf("RestoreJourneyImage() error = %v, want ErrInvalidJourneyImage", err)
				}
				return
			}

			if !image.ID().Equals(tt.id) {
				t.Errorf("ID() = %v, want %v", image.ID(), tt.id)
			}
			if !image.RequestID().Equals(tt.requestID) {
				t.Errorf("RequestID() = %v, want %v", image.RequestID(), tt.requestID)
			}
			if image.Slot() != tt.slot {
				t.Errorf("Slot() = %v, want %v", image.Slot(), tt.slot)
			}
			if image.Status() != tt.status {
				t.Errorf("Status() = %q, want %q", image.Status(), tt.status)
			}
			if image.AttemptCount() != tt.attemptCount {
				t.Errorf("AttemptCount() = %d, want %d", image.AttemptCount(), tt.attemptCount)
			}

			gotAsset, hasAsset := image.AssetReference()
			if hasAsset != tt.wantAsset {
				t.Errorf("AssetReference() has value = %v, want %v", hasAsset, tt.wantAsset)
			}
			if hasAsset && gotAsset != tt.assetRef {
				t.Errorf("AssetReference() = %v, want %v", gotAsset, tt.assetRef)
			}

			gotFailureCode, hasFailureCode := image.FailureCode()
			if hasFailureCode != tt.wantFailure {
				t.Errorf("FailureCode() has value = %v, want %v", hasFailureCode, tt.wantFailure)
			}
			if hasFailureCode && gotFailureCode != tt.failureCode {
				t.Errorf("FailureCode() = %q, want %q", gotFailureCode, tt.failureCode)
			}
		})
	}
}

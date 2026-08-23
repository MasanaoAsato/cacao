package entity

import (
	"errors"
	"fmt"

	"cacao/src/domain/value_object"
)

// MaxImageGenerationAttempts は画像生成を開始できる最大回数を表す。
const MaxImageGenerationAttempts = 3

var (
	ErrInvalidImageTransition = errors.New("invalid image transition")
	ErrImageRetryNotAllowed   = errors.New("image retry not allowed")
	ErrInvalidJourneyImage    = errors.New("invalid journey image")
)

// JourneyImage は旅程に使用する1枚の画像を表す集約ルート。
type JourneyImage struct {
	id           value_object.ID
	requestID    value_object.ID
	slot         value_object.ImageSlot
	assetRef     value_object.ImageAssetReference
	status       value_object.ImageStatus
	failureCode  value_object.ImageFailureCode
	attemptCount int // Start成功回数
}

// NewJourneyImage は pending 状態の JourneyImage を生成する。
// 生成直後は asset と failure code を持たず、attemptCount は 0 になる。
func NewJourneyImage(id, requestID value_object.ID, slot value_object.ImageSlot) (JourneyImage, error) {
	if id.IsEmpty() {
		return JourneyImage{}, fmt.Errorf("%w: id must not be empty", ErrInvalidJourneyImage)
	}
	if requestID.IsEmpty() {
		return JourneyImage{}, fmt.Errorf("%w: request id must not be empty", ErrInvalidJourneyImage)
	}
	if err := slot.Validate(); err != nil {
		return JourneyImage{}, fmt.Errorf("%w: invalid slot: %w", ErrInvalidJourneyImage, err)
	}

	return JourneyImage{
		id:           id,
		requestID:    requestID,
		slot:         slot,
		status:       value_object.ImageStatusPending,
		assetRef:     value_object.ImageAssetReference{},
		failureCode:  value_object.ImageFailureCode(""),
		attemptCount: 0,
	}, nil
}

// RestoreJourneyImage は永続化された JourneyImage を復元する。
// 復元時は、状態とasset、failure code、試行回数の整合性を検証する。
func RestoreJourneyImage(
	id value_object.ID,
	requestID value_object.ID,
	slot value_object.ImageSlot,
	status value_object.ImageStatus,
	assetRef value_object.ImageAssetReference,
	failureCode value_object.ImageFailureCode,
	attemptCount int,
) (JourneyImage, error) {
	if id.IsEmpty() {
		return JourneyImage{}, fmt.Errorf("%w: id must not be empty", ErrInvalidJourneyImage)
	}
	if requestID.IsEmpty() {
		return JourneyImage{}, fmt.Errorf("%w: request id must not be empty", ErrInvalidJourneyImage)
	}
	if err := slot.Validate(); err != nil {
		return JourneyImage{}, fmt.Errorf("%w: invalid slot: %w", ErrInvalidJourneyImage, err)
	}
	if err := status.Validate(); err != nil {
		return JourneyImage{}, fmt.Errorf("%w: invalid status: %w", ErrInvalidJourneyImage, err)
	}

	if err := validateJourneyImageState(status, assetRef, failureCode, attemptCount); err != nil {
		return JourneyImage{}, err
	}

	return JourneyImage{
		id:           id,
		requestID:    requestID,
		slot:         slot,
		status:       status,
		assetRef:     assetRef,
		failureCode:  failureCode,
		attemptCount: attemptCount,
	}, nil
}

func validateJourneyImageState(
	status value_object.ImageStatus,
	assetRef value_object.ImageAssetReference,
	failureCode value_object.ImageFailureCode,
	attemptCount int,
) error {
	switch status {
	case value_object.ImageStatusPending:
		if attemptCount < 0 || attemptCount >= MaxImageGenerationAttempts {
			return fmt.Errorf(
				"%w: pending attempt count must be between 0 and %d, got %d",
				ErrInvalidJourneyImage,
				MaxImageGenerationAttempts-1,
				attemptCount,
			)
		}
		if assetRef != (value_object.ImageAssetReference{}) {
			return fmt.Errorf("%w: pending image must not have an asset reference", ErrInvalidJourneyImage)
		}
		if failureCode != "" {
			return fmt.Errorf("%w: pending image must not have a failure code", ErrInvalidJourneyImage)
		}
	case value_object.ImageStatusProcessing:
		if err := validateStartedImageAttemptCount(attemptCount); err != nil {
			return err
		}
		if assetRef != (value_object.ImageAssetReference{}) {
			return fmt.Errorf("%w: processing image must not have an asset reference", ErrInvalidJourneyImage)
		}
		if failureCode != "" {
			return fmt.Errorf("%w: processing image must not have a failure code", ErrInvalidJourneyImage)
		}
	case value_object.ImageStatusReady:
		if err := validateStartedImageAttemptCount(attemptCount); err != nil {
			return err
		}
		if err := assetRef.Validate(); err != nil {
			return fmt.Errorf("%w: invalid asset reference: %w", ErrInvalidJourneyImage, err)
		}
		if failureCode != "" {
			return fmt.Errorf("%w: ready image must not have a failure code", ErrInvalidJourneyImage)
		}
	case value_object.ImageStatusFailed:
		if err := validateStartedImageAttemptCount(attemptCount); err != nil {
			return err
		}
		if assetRef != (value_object.ImageAssetReference{}) {
			return fmt.Errorf("%w: failed image must not have an asset reference", ErrInvalidJourneyImage)
		}
		if err := failureCode.Validate(); err != nil {
			return fmt.Errorf("%w: invalid failure code: %w", ErrInvalidJourneyImage, err)
		}
	}

	return nil
}

func validateStartedImageAttemptCount(attemptCount int) error {
	if attemptCount < 1 || attemptCount > MaxImageGenerationAttempts {
		return fmt.Errorf(
			"%w: started image attempt count must be between 1 and %d, got %d",
			ErrInvalidJourneyImage,
			MaxImageGenerationAttempts,
			attemptCount,
		)
	}

	return nil
}

// ID は画像の識別子を返す。
func (i JourneyImage) ID() value_object.ID {
	return i.id
}

// RequestID は画像が属する旅程リクエストの識別子を返す。
func (i JourneyImage) RequestID() value_object.ID {
	return i.requestID
}

// Slot は画像のスロットを返す。
func (i JourneyImage) Slot() value_object.ImageSlot {
	return i.slot
}

// Status は画像の生成状態を返す。
func (i JourneyImage) Status() value_object.ImageStatus {
	return i.status
}

// AttemptCount は画像生成の開始成功回数を返す。
func (i JourneyImage) AttemptCount() int {
	return i.attemptCount
}

// AssetReference はready状態の有効なassetがあれば返す。
func (i JourneyImage) AssetReference() (value_object.ImageAssetReference, bool) {
	if i.status != value_object.ImageStatusReady {
		return value_object.ImageAssetReference{}, false
	}
	if err := i.assetRef.Validate(); err != nil {
		return value_object.ImageAssetReference{}, false
	}

	return i.assetRef, true
}

// FailureCode はfailed状態の有効なfailure codeがあれば返す。
func (i JourneyImage) FailureCode() (value_object.ImageFailureCode, bool) {
	if i.status != value_object.ImageStatusFailed {
		return value_object.ImageFailureCode(""), false
	}
	if err := i.failureCode.Validate(); err != nil {
		return value_object.ImageFailureCode(""), false
	}

	return i.failureCode, true
}

func (i *JourneyImage) Start() error {
	if i.status != value_object.ImageStatusPending {
		return fmt.Errorf(
			"%w: cannot start from status %q",
			ErrInvalidImageTransition,
			i.status,
		)
	}

	if i.attemptCount >= MaxImageGenerationAttempts {
		return fmt.Errorf(
			"%w: image generation attempt limit reached",
			ErrInvalidImageTransition,
		)
	}

	i.attemptCount++
	i.status = value_object.ImageStatusProcessing

	return nil
}

func (i *JourneyImage) Complete(assetRef value_object.ImageAssetReference) error {
	if i.status != value_object.ImageStatusProcessing {
		return fmt.Errorf(
			"%w: cannot complete from status %q",
			ErrInvalidImageTransition,
			i.status,
		)
	}

	if err := assetRef.Validate(); err != nil {
		return fmt.Errorf("%w: invalid asset reference: %w", ErrInvalidJourneyImage, err)
	}

	i.status = value_object.ImageStatusReady
	i.assetRef = assetRef
	i.failureCode = value_object.ImageFailureCode("")

	return nil
}

// Fail は processing 状態の画像を failed 状態へ遷移させる。
func (i *JourneyImage) Fail(failureCode value_object.ImageFailureCode) error {
	if i.status != value_object.ImageStatusProcessing {
		return fmt.Errorf(
			"%w: cannot fail from status %q",
			ErrInvalidImageTransition,
			i.status,
		)
	}
	if err := failureCode.Validate(); err != nil {
		return fmt.Errorf("%w: invalid failure code: %w", ErrInvalidJourneyImage, err)
	}

	i.status = value_object.ImageStatusFailed
	i.assetRef = value_object.ImageAssetReference{}
	i.failureCode = failureCode

	return nil
}

// Retry は failed 状態の画像を pending 状態へ戻す。
func (i *JourneyImage) Retry() error {
	if i.status != value_object.ImageStatusFailed {
		return fmt.Errorf(
			"%w: cannot retry from status %q",
			ErrInvalidImageTransition,
			i.status,
		)
	}
	if i.attemptCount >= MaxImageGenerationAttempts {
		return fmt.Errorf(
			"%w: image generation attempt limit reached",
			ErrImageRetryNotAllowed,
		)
	}

	i.status = value_object.ImageStatusPending
	i.assetRef = value_object.ImageAssetReference{}
	i.failureCode = value_object.ImageFailureCode("")

	return nil
}

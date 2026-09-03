package service

import (
	"context"
	"errors"

	"cacao/src/domain/value_object"
)

// ClassifyImageGenerationFailure は画像生成器（ImageGenerator）が返したエラーを
// 永続化する失敗コードへ写す。timedOut は呼び出し側が設けた生成タイムアウトの超過を表す。
func ClassifyImageGenerationFailure(err error, timedOut bool) value_object.ImageFailureCode {
	switch {
	case timedOut || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, ErrImageGeneratorTimeout):
		return value_object.ImageFailureCodeProviderTimeout
	case errors.Is(err, ErrImageGeneratorUnavailable):
		return value_object.ImageFailureCodeProviderUnavailable
	case errors.Is(err, ErrImageGenerationRejected):
		return value_object.ImageFailureCodeGenerationRejected
	case errors.Is(err, ErrGeneratedImageInvalid):
		return value_object.ImageFailureCodeOutputInvalid
	default:
		return value_object.ImageFailureCodeInternalError
	}
}

// ClassifyImageStorageFailure は画像ストレージ（ImageStorage）の保存エラーを失敗コードへ写す。
// 生成画像そのものが不正な場合は output_invalid、それ以外は storage_failed とする。
func ClassifyImageStorageFailure(err error) value_object.ImageFailureCode {
	if errors.Is(err, ErrGeneratedImageInvalid) {
		return value_object.ImageFailureCodeOutputInvalid
	}

	return value_object.ImageFailureCodeStorageFailed
}

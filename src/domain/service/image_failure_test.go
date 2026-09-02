package service

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"cacao/src/domain/value_object"
)

func TestClassifyImageGenerationFailure(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		err      error
		timedOut bool
		want     value_object.ImageFailureCode
	}{
		{
			name: "正常系: タイムアウト sentinel は provider_timeout",
			err:  fmt.Errorf("wrap: %w", ErrImageGeneratorTimeout),
			want: value_object.ImageFailureCodeProviderTimeout,
		},
		{
			name: "正常系: context.DeadlineExceeded は provider_timeout",
			err:  context.DeadlineExceeded,
			want: value_object.ImageFailureCodeProviderTimeout,
		},
		{
			name:     "境界値系: timedOut フラグはエラー種別より優先される",
			err:      ErrImageGeneratorUnavailable,
			timedOut: true,
			want:     value_object.ImageFailureCodeProviderTimeout,
		},
		{
			name: "正常系: unavailable は provider_unavailable",
			err:  ErrImageGeneratorUnavailable,
			want: value_object.ImageFailureCodeProviderUnavailable,
		},
		{
			name: "正常系: rejected は generation_rejected",
			err:  ErrImageGenerationRejected,
			want: value_object.ImageFailureCodeGenerationRejected,
		},
		{
			name: "正常系: invalid は output_invalid",
			err:  ErrGeneratedImageInvalid,
			want: value_object.ImageFailureCodeOutputInvalid,
		},
		{
			name: "異常系: 未知のエラーは internal_error",
			err:  errors.New("boom"),
			want: value_object.ImageFailureCodeInternalError,
		},
		{
			name: "境界値系: nil エラーでも internal_error を返す",
			err:  nil,
			want: value_object.ImageFailureCodeInternalError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyImageGenerationFailure(tt.err, tt.timedOut); got != tt.want {
				t.Errorf("ClassifyImageGenerationFailure() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestClassifyImageStorageFailure(t *testing.T) {
	t.Parallel()

	if got := ClassifyImageStorageFailure(fmt.Errorf("x: %w", ErrGeneratedImageInvalid)); got != value_object.ImageFailureCodeOutputInvalid {
		t.Errorf("invalid image = %q, want output_invalid", got)
	}
	if got := ClassifyImageStorageFailure(errors.New("disk full")); got != value_object.ImageFailureCodeStorageFailed {
		t.Errorf("other error = %q, want storage_failed", got)
	}
	if got := ClassifyImageStorageFailure(nil); got != value_object.ImageFailureCodeStorageFailed {
		t.Errorf("nil error = %q, want storage_failed", got)
	}
}

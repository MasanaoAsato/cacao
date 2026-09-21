package observability

import (
	"errors"
	"testing"
)

func TestOllamaAndSearXNGErrorDetailsAreSafe(t *testing.T) {
	details := []ErrorDetailCode{
		ErrorDetailSearXNGRequestFailed,
		ErrorDetailSearXNGResponseInvalid,
		ErrorDetailSearXNGNoResults,
		ErrorDetailOllamaRequestFailed,
		ErrorDetailOllamaResponseInvalid,
	}
	for _, detail := range details {
		t.Run(string(detail), func(t *testing.T) {
			err := WithErrorDetail(detail, errors.New("provider body with secret"))
			if got := ErrorDetail(err); got != string(detail) {
				t.Errorf("ErrorDetail() = %q, want %q", got, detail)
			}
		})
	}
}

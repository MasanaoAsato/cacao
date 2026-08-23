package value_object

import "fmt"

type ImageFailureCode string

const (
	ImageFailureCodeProviderUnavailable ImageFailureCode = "provider_unavailable"
	ImageFailureCodeProviderTimeout     ImageFailureCode = "provider_timeout"
	ImageFailureCodeGenerationRejected  ImageFailureCode = "generation_rejected"
	ImageFailureCodeOutputInvalid       ImageFailureCode = "output_invalid"
	ImageFailureCodeStorageFailed       ImageFailureCode = "storage_failed"
	ImageFailureCodeInternalError       ImageFailureCode = "internal_error"
)

var validImageFailureCodes = map[ImageFailureCode]struct{}{
	ImageFailureCodeProviderUnavailable: {},
	ImageFailureCodeProviderTimeout:     {},
	ImageFailureCodeGenerationRejected:  {},
	ImageFailureCodeOutputInvalid:       {},
	ImageFailureCodeStorageFailed:       {},
	ImageFailureCodeInternalError:       {},
}

func NewImageFailureCode(s string) (ImageFailureCode, error) {
	code := ImageFailureCode(s)
	if _, ok := validImageFailureCodes[code]; !ok {
		return "", fmt.Errorf("invalid image failure code: %q", s)
	}

	return code, nil
}

func (c ImageFailureCode) String() string {
	return string(c)
}

func (c ImageFailureCode) Validate() error {
	_, err := NewImageFailureCode(c.String())
	return err
}

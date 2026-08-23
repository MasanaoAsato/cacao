package value_object

import "fmt"

type ImageStatus string

const (
	ImageStatusPending    ImageStatus = "pending"
	ImageStatusProcessing ImageStatus = "processing"
	ImageStatusReady      ImageStatus = "ready"
	ImageStatusFailed     ImageStatus = "failed"
)

var validImageStatuses = map[ImageStatus]struct{}{
	ImageStatusPending:    {},
	ImageStatusProcessing: {},
	ImageStatusReady:      {},
	ImageStatusFailed:     {},
}

func NewImageStatus(s string) (ImageStatus, error) {
	m := ImageStatus(s)
	if _, ok := validImageStatuses[m]; !ok {
		return "", fmt.Errorf("invalid image status: %q", s)
	}

	return m, nil
}

func (i ImageStatus) String() string {
	return string(i)
}

func (i ImageStatus) Validate() error {
	_, err := NewImageStatus(i.String())
	return err
}

package value_object

import "fmt"

type ImagePurpose string

const (
	ImagePurposeCover        ImagePurpose = "cover"
	ImagePurposeIllustration ImagePurpose = "illustration"
)

var validImagePurpose = map[ImagePurpose]struct{}{
	ImagePurposeCover:        {},
	ImagePurposeIllustration: {},
}

func NewImagePurpose(s string) (ImagePurpose, error) {
	m := ImagePurpose(s)
	if _, ok := validImagePurpose[m]; !ok {
		return "", fmt.Errorf("invalid image purpose: %q", s)
	}

	return m, nil
}

func (i ImagePurpose) String() string {
	return string(i)
}

func (i ImagePurpose) Validate() error {
	_, err := NewImagePurpose(i.String())
	return err
}

package value_object

import "fmt"

type ImageSlot struct {
	purpose ImagePurpose
	slot    int
}

func NewImageSlot(purpose ImagePurpose, ordinal int) (ImageSlot, error) {
	switch purpose {
	case ImagePurposeCover:
		if ordinal != 1 {
			return ImageSlot{}, fmt.Errorf("cover purpose must have ordinal 1, got %d", ordinal)
		}
	case ImagePurposeIllustration:
		if ordinal < 1 || ordinal > 3 {
			return ImageSlot{}, fmt.Errorf("illustration purpose must have ordinal 1-3, got %d", ordinal)
		}
	default:
		return ImageSlot{}, fmt.Errorf("invalid image purpose: %q", purpose)
	}

	return ImageSlot{purpose: purpose, slot: ordinal}, nil
}

func (s ImageSlot) Purpose() ImagePurpose {
	return s.purpose
}

func (s ImageSlot) Ordinal() int {
	return s.slot
}

func (s ImageSlot) Less(other ImageSlot) bool {
	if s.purpose != other.purpose {
		if s.purpose == ImagePurposeCover {
			return true
		}
		if other.purpose == ImagePurposeCover {
			return false
		}
	}

	return s.slot < other.slot
}

func (s ImageSlot) Validate() error {
	_, err := NewImageSlot(s.purpose, s.slot)
	return err
}

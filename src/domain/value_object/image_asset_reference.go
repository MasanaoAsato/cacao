package value_object

import (
	"fmt"
	"net/url"
	"path"
)

type ImageAssetReference struct {
	storageKey string
	mediaType  string
	width      int
	height     int
}

func NewImageAssetReference(storageKey, mediaType string, width, height int) (ImageAssetReference, error) {
	reference := ImageAssetReference{
		storageKey: storageKey,
		mediaType:  mediaType,
		width:      width,
		height:     height,
	}
	if err := reference.Validate(); err != nil {
		return ImageAssetReference{}, err
	}

	return reference, nil
}

func (r ImageAssetReference) StorageKey() string {
	return r.storageKey
}

func (r ImageAssetReference) MediaType() string {
	return r.mediaType
}

func (r ImageAssetReference) Width() int {
	return r.width
}

func (r ImageAssetReference) Height() int {
	return r.height
}

func (r ImageAssetReference) Validate() error {
	if r.storageKey == "" {
		return fmt.Errorf("storage key must not be empty")
	}
	if path.IsAbs(r.storageKey) {
		return fmt.Errorf("storage key must not be an absolute path: %q", r.storageKey)
	}
	if parsedURL, err := url.Parse(r.storageKey); err == nil && parsedURL.IsAbs() {
		return fmt.Errorf("storage key must not be a url: %q", r.storageKey)
	}

	if r.mediaType != "image/png" && r.mediaType != "image/jpeg" {
		return fmt.Errorf("unsupported image media type: %q", r.mediaType)
	}

	if r.width <= 0 {
		return fmt.Errorf("image width must be positive, got %d", r.width)
	}
	if r.height <= 0 {
		return fmt.Errorf("image height must be positive, got %d", r.height)
	}

	return nil
}

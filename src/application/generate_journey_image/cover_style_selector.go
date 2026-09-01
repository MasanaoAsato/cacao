package generatejourneyimage

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"

	"cacao/src/domain/value_object"
)

const coverStyleSelectionSalt = "cover-style-v1"

func selectCoverStyle(imageID value_object.ID) (value_object.ImageVisualStyle, error) {
	if imageID.IsEmpty() {
		return value_object.ImageVisualStyleNone, fmt.Errorf("image id must not be empty")
	}

	digest := sha256.Sum256([]byte(coverStyleSelectionSalt + ":" + imageID.String()))
	selectionKey := binary.BigEndian.Uint64(digest[:8])
	return coverStyleForSelectionKey(selectionKey)
}

func coverStyleForSelectionKey(selectionKey uint64) (value_object.ImageVisualStyle, error) {
	catalog := value_object.CoverImageVisualStyleCatalog()
	if len(catalog) == 0 {
		return value_object.ImageVisualStyleNone, fmt.Errorf("cover image visual style catalog must not be empty")
	}

	return catalog[selectionKey%uint64(len(catalog))], nil
}

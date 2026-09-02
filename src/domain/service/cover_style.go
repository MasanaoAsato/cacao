package service

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"

	"cacao/src/domain/value_object"
)

// coverStyleSelectionSalt は表紙画風選択の契約バージョン。
// 同じ画像 ID からは常に同じ画風が選ばれる必要があるため、
// 選択ロジックを変えるときはこの値を上げて新しい契約として扱う。
const coverStyleSelectionSalt = "cover-style-v1"

// SelectCoverStyle は画像 ID から表紙用の画風を決定的に選ぶドメインルール。
// 表紙は画像ごとに画風を変えて「闇鍋」感を出すが、再試行しても同じ画風になるよう
// 乱数ではなく ID のハッシュで選ぶ。
func SelectCoverStyle(imageID value_object.ID) (value_object.ImageVisualStyle, error) {
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

// VisualStyleForSlot はスロットの用途に応じた画風を返す。
// 表紙は SelectCoverStyle で選び、挿絵は画風なし（none）とする。
func VisualStyleForSlot(imageID value_object.ID, slot value_object.ImageSlot) (value_object.ImageVisualStyle, error) {
	if slot.Purpose() == value_object.ImagePurposeCover {
		return SelectCoverStyle(imageID)
	}
	return value_object.ImageVisualStyleNone, nil
}

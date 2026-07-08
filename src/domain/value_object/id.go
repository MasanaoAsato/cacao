package value_object

import (
	"fmt"

	"github.com/google/uuid"
)

// ID はドメイン内の各エンティティを一意に識別するための値オブジェクト。
// UUID v4 を内部値として持ち、生成後は不変。
type ID struct {
	value uuid.UUID
}

// NewID は新しいランダムなUUIDを持つ ID を生成する。
// 新規エンティティ作成時に使用する。
func NewID() ID {
	return ID{value: uuid.New()}
}

// NewIDFromString は UUID 文字列から ID を復元する。
// リポジトリから永続化済みのデータを読み出す際などに使用する。
func NewIDFromString(s string) (ID, error) {
	u, err := uuid.Parse(s)
	if err != nil {
		return ID{}, fmt.Errorf("invalid id: %w", err)
	}

	return ID{value: u}, nil
}

// Value は内部の UUID を返す。
func (i ID) Value() uuid.UUID {
	return i.value
}

// String は UUID の文字列表現を返す。
func (i ID) String() string {
	return i.value.String()
}

// Equals は他の ID と等価かを判定する。
func (i ID) Equals(other ID) bool {
	return i.value == other.value
}

// IsEmpty は ID が空（ゼロ値）かどうかを判定する。
func (i ID) IsEmpty() bool {
	return i.value == uuid.Nil
}

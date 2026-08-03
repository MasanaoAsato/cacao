package value_object

import (
	"fmt"
)

// Endpoint は移動区間の端点を表す値オブジェクト。
// spotID が空（ゼロ値）でなければ同じ日内のスポットを参照し、
// 空なら出発地・宿泊地など旅程外の地点を label で表す。
type Endpoint struct {
	spotID ID
	label  string
}

// NewSpotEndpoint は旅程内スポットを指す Endpoint を生成する。id は空不可。
func NewSpotEndpoint(id ID) (Endpoint, error) {
	if id.IsEmpty() {
		return Endpoint{}, fmt.Errorf("spotID must not be empty")
	}

	return Endpoint{spotID: id, label: ""}, nil
}

// NewNamedEndpoint は旅程外の地点を指す Endpoint を生成する。label は空文字不可。
// 例: "大阪（出発地）", "難波周辺の宿泊地"
func NewNamedEndpoint(label string) (Endpoint, error) {
	if label == "" {
		return Endpoint{}, fmt.Errorf("label must not be empty")
	}

	return Endpoint{spotID: ID{}, label: label}, nil
}

func (e Endpoint) IsSpot() bool {
	return !e.spotID.IsEmpty()
}

// SpotID は参照先のスポット ID を返す。IsSpot() が false のときはゼロ値を返す。
func (e Endpoint) SpotID() ID {
	return e.spotID
}

func (e Endpoint) Label() string {
	return e.label
}

func (e Endpoint) Equals(other Endpoint) bool {
	return e.spotID.Equals(other.spotID) && e.label == other.label
}

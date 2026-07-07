package value_object

import (
	"fmt"
	"strings"
)

// Departure は旅程の出発地点を表す値オブジェクト。
// 将来、緯度経度や国コードなどの拡張をしやすいように市区町村・国の2階層で構成する。
type Departure struct {
	city    string
	country string
}

// NewDeparture は出発地点を生成する。
// city は空文字不可。country は空の場合でもよいが、可能なら国名を入れる。
func NewDeparture(city, country string) (Departure, error) {
	trimmedCity := strings.TrimSpace(city)
	if trimmedCity == "" {
		return Departure{}, fmt.Errorf("city must not be empty")
	}

	return Departure{
		city:    trimmedCity,
		country: strings.TrimSpace(country),
	}, nil
}

// City は出発都市を返す。
func (d Departure) City() string {
	return d.city
}

// Country は出発国を返す。
func (d Departure) Country() string {
	return d.country
}

// Equals は他の Departure と等価かを判定する。
// 現在は city と country の完全一致で判定する。
func (d Departure) Equals(other Departure) bool {
	return d.city == other.city && d.country == other.country
}

// String は人間が読みやすい文字列表現を返す。
func (d Departure) String() string {
	if d.country == "" {
		return d.city
	}
	return fmt.Sprintf("%s, %s", d.city, d.country)
}

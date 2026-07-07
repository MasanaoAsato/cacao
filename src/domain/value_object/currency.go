package value_object

import (
	"fmt"
	"strings"
)

// Currency は予算の通貨を表す値オブジェクト。
// ISO 4217 の3文字コード（JPY, USD, EUR など）を内部値として持つ。
type Currency struct {
	code string
}

// NewCurrency は通貨コードから Currency を生成する。
// code は3文字の英字で、内部で大文字に正規化される。
func NewCurrency(code string) (Currency, error) {
	normalized := strings.ToUpper(strings.TrimSpace(code))
	if len(normalized) != 3 {
		return Currency{}, fmt.Errorf("invalid currency code %q: must be 3 letters", normalized)
	}
	for _, r := range normalized {
		if r < 'A' || r > 'Z' {
			return Currency{}, fmt.Errorf("invalid currency code %q: must contain only letters", normalized)
		}
	}

	return Currency{code: normalized}, nil
}

// Code は正規化済みの通貨コード（例: "JPY"）を返す。
func (c Currency) Code() string {
	return c.code
}

// Equals は他の Currency と等価かを判定する。
func (c Currency) Equals(other Currency) bool {
	return c.code == other.code
}

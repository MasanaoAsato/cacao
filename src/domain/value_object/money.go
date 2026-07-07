package value_object

import (
	"fmt"
)

// Money は金額と通貨を組み合わせた値オブジェクト。
// 予算や料金など、通貨単位とセットで扱うべき値に使用する。
// 現状は整数単位の通貨（JPY など）を前提とする。
type Money struct {
	amount   int
	currency Currency
}

// NewMoney は金額と通貨から Money を生成する。
// amount は 0 以上の整数でなければならない。
func NewMoney(amount int, currency Currency) (Money, error) {
	if amount < 0 {
		return Money{}, fmt.Errorf("amount must be non-negative, got %d", amount)
	}

	return Money{
		amount:   amount,
		currency: currency,
	}, nil
}

// Amount は金額を返す。
func (m Money) Amount() int {
	return m.amount
}

// Currency は通貨を返す。
func (m Money) Currency() Currency {
	return m.currency
}

// Equals は他の Money と金額・通貨の両方が等価かを判定する。
func (m Money) Equals(other Money) bool {
	return m.amount == other.amount && m.currency.Equals(other.currency)
}

// String は人間が読みやすい文字列表現を返す。
func (m Money) String() string {
	return fmt.Sprintf("%s %d", m.currency.Code(), m.amount)
}

package repository

import "errors"

// ErrDuplicateID は同じ識別子の集約がすでに保存されていることを表す。
// 識別子はサーバー側で発行する UUID なので通常は起きないが、永続化層が一意制約違反を検出したときに返す。
var ErrDuplicateID = errors.New("duplicate id")

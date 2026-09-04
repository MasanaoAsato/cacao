package value_object

import (
	"fmt"
	"regexp"
	"strings"
)

var themeSeedPattern = regexp.MustCompile("(?i)^v1-([0-9a-f]{8})$")

// ThemeSeed はしおりのテーマを再現するための不変なシード値である。
// web/src/theme/seed.ts と同じ v1-xxxxxxxx 形式を受け付ける。
type ThemeSeed struct {
	token string
}

// NewThemeSeed はテーマシードを検証し、小文字へ正規化して返す。
func NewThemeSeed(token string) (ThemeSeed, error) {
	matches := themeSeedPattern.FindStringSubmatch(token)
	if matches == nil {
		return ThemeSeed{}, fmt.Errorf("invalid theme seed: %q", token)
	}

	return ThemeSeed{token: "v1-" + strings.ToLower(matches[1])}, nil
}

// String はURLクエリへ渡せる正規化済みのテーマシードを返す。
func (s ThemeSeed) String() string {
	return s.token
}

// IsEmpty はゼロ値かを返す。
func (s ThemeSeed) IsEmpty() bool {
	return s.token == ""
}

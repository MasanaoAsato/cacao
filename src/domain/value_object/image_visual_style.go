package value_object

import (
	"fmt"
	"slices"
)

// ImageVisualStyle は画像生成で使用するプロバイダー中立の画風IDを表す。
type ImageVisualStyle string

const (
	ImageVisualStyleNone                ImageVisualStyle = "none"
	ImageVisualStyleEditorialPhotograph ImageVisualStyle = "editorial-photograph"
	ImageVisualStyleCinematicPhotograph ImageVisualStyle = "cinematic-photograph"
	ImageVisualStyleWatercolor          ImageVisualStyle = "watercolor"
	ImageVisualStyleGouache             ImageVisualStyle = "gouache"
	ImageVisualStyleOilPainting         ImageVisualStyle = "oil-painting"
	ImageVisualStylePastel              ImageVisualStyle = "pastel"
)

var validImageVisualStyles = map[ImageVisualStyle]struct{}{
	ImageVisualStyleNone:                {},
	ImageVisualStyleEditorialPhotograph: {},
	ImageVisualStyleCinematicPhotograph: {},
	ImageVisualStyleWatercolor:          {},
	ImageVisualStyleGouache:             {},
	ImageVisualStyleOilPainting:         {},
	ImageVisualStylePastel:              {},
}

var coverImageVisualStyleCatalog = []ImageVisualStyle{
	ImageVisualStyleEditorialPhotograph,
	ImageVisualStyleCinematicPhotograph,
	ImageVisualStyleWatercolor,
	ImageVisualStyleGouache,
	ImageVisualStyleOilPainting,
	ImageVisualStylePastel,
}

// CoverImageVisualStyleCatalog は表紙用画風カタログのコピーを返す。
// 要素の順序は画像IDからの決定的選択に使用するため変更してはならない。
func CoverImageVisualStyleCatalog() []ImageVisualStyle {
	return slices.Clone(coverImageVisualStyleCatalog)
}

// NewImageVisualStyle は許可された画風IDを作成する。
func NewImageVisualStyle(s string) (ImageVisualStyle, error) {
	style := ImageVisualStyle(s)
	if _, ok := validImageVisualStyles[style]; !ok {
		return "", fmt.Errorf("invalid image visual style: %q", s)
	}

	return style, nil
}

// String は画風IDの文字列表現を返す。
func (s ImageVisualStyle) String() string {
	return string(s)
}

// Validate は画風IDが許可されているか検証する。
func (s ImageVisualStyle) Validate() error {
	_, err := NewImageVisualStyle(s.String())
	return err
}

// ValidateFor は画像用途と画風IDの組み合わせを検証する。
func (s ImageVisualStyle) ValidateFor(purpose ImagePurpose) error {
	if err := purpose.Validate(); err != nil {
		return fmt.Errorf("image purpose: %w", err)
	}
	if err := s.Validate(); err != nil {
		return err
	}

	switch purpose {
	case ImagePurposeCover:
		if s == ImageVisualStyleNone {
			return fmt.Errorf("cover image visual style must not be none")
		}
	case ImagePurposeIllustration:
		if s != ImageVisualStyleNone {
			return fmt.Errorf("illustration image visual style must be none")
		}
	}

	return nil
}

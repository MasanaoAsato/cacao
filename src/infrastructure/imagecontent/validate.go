// Package imagecontent は生成画像のバイト列を検証する共通処理を提供する。
// 画像生成器（ComfyUI / OpenRouter）とストレージが同じ上限・同じ判定で検証し、
// 「生成器は通ったがストレージで弾かれる」食い違いを防ぐ。
package imagecontent

import (
	"bytes"
	"fmt"
	"image"
	"net/http"

	// 対応形式のデコーダを登録する。
	_ "image/jpeg"
	_ "image/png"

	domainservice "cacao/src/domain/service"
)

// Limits は受け入れる画像の上限。
type Limits struct {
	MaxBytes  int64
	MaxWidth  int
	MaxHeight int
	MaxPixels int64
}

// Validate は上限値がすべて正であることを確認する。
func (l Limits) Validate() error {
	if l.MaxBytes < 1 || l.MaxWidth < 1 || l.MaxHeight < 1 || l.MaxPixels < 1 {
		return fmt.Errorf("image limits must be positive: %+v", l)
	}
	return nil
}

// Info は検証済み画像から読み取ったメタデータ。
type Info struct {
	MediaType string
	Width     int
	Height    int
}

// Inspect は content が対応形式（PNG / JPEG）の正常な画像で、limits に収まることを検証し、
// media type と寸法を返す。失敗は domainservice.ErrGeneratedImageInvalid でラップする。
func Inspect(content []byte, limits Limits) (Info, error) {
	if len(content) == 0 {
		return Info{}, invalid("image content must not be empty")
	}
	if int64(len(content)) > limits.MaxBytes {
		return Info{}, invalid("image content exceeds maximum bytes")
	}

	mediaType := http.DetectContentType(content)
	if _, ok := Extension(mediaType); !ok {
		return Info{}, invalid("unsupported detected media type: %q", mediaType)
	}

	config, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil {
		return Info{}, invalid("decode image header: %v", err)
	}
	if config.Width < 1 || config.Height < 1 {
		return Info{}, invalid("image dimensions must be positive")
	}
	if config.Width > limits.MaxWidth {
		return Info{}, invalid("image width exceeds maximum")
	}
	if config.Height > limits.MaxHeight {
		return Info{}, invalid("image height exceeds maximum")
	}
	if int64(config.Width) > limits.MaxPixels/int64(config.Height) {
		return Info{}, invalid("image pixels exceed maximum")
	}

	// ヘッダだけでなく本体もデコードして、壊れた画像を弾く。
	decoded, _, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return Info{}, invalid("decode image: %v", err)
	}
	if decoded.Bounds().Dx() != config.Width || decoded.Bounds().Dy() != config.Height {
		return Info{}, invalid("decoded dimensions differ from header")
	}

	return Info{MediaType: mediaType, Width: config.Width, Height: config.Height}, nil
}

// InspectGenerated は生成器が申告した media type と寸法が実際の内容と一致することまで検証する。
func InspectGenerated(generated domainservice.GeneratedImage, limits Limits) (Info, error) {
	info, err := Inspect(generated.Content, limits)
	if err != nil {
		return Info{}, err
	}
	if generated.MediaType != info.MediaType {
		return Info{}, invalid("declared media type differs from content")
	}
	if generated.Width != info.Width || generated.Height != info.Height {
		return Info{}, invalid("declared dimensions differ from content")
	}
	return info, nil
}

// Extension は対応する media type の拡張子を返す。
func Extension(mediaType string) (string, bool) {
	switch mediaType {
	case "image/png":
		return ".png", true
	case "image/jpeg":
		return ".jpg", true
	default:
		return "", false
	}
}

func invalid(format string, arguments ...any) error {
	return fmt.Errorf(
		"%w: "+format,
		append([]any{domainservice.ErrGeneratedImageInvalid}, arguments...)...,
	)
}

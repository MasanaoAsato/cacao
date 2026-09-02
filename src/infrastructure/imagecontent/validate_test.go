package imagecontent

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	domainservice "cacao/src/domain/service"
)

func encodePNG(t *testing.T, width, height int) []byte {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	canvas.Set(0, 0, color.RGBA{R: 1, G: 2, B: 3, A: 255})
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, canvas); err != nil {
		t.Fatalf("png.Encode() error = %v", err)
	}
	return buffer.Bytes()
}

func encodeJPEG(t *testing.T, width, height int) []byte {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, canvas, nil); err != nil {
		t.Fatalf("jpeg.Encode() error = %v", err)
	}
	return buffer.Bytes()
}

func generousLimits() Limits {
	return Limits{MaxBytes: 1 << 20, MaxWidth: 64, MaxHeight: 64, MaxPixels: 64 * 64}
}

func TestInspect(t *testing.T) {
	t.Parallel()

	t.Run("正常系: PNG と JPEG を受け入れ media type と寸法を返す", func(t *testing.T) {
		pngInfo, err := Inspect(encodePNG(t, 4, 3), generousLimits())
		if err != nil {
			t.Fatalf("Inspect(png) error = %v", err)
		}
		if pngInfo != (Info{MediaType: "image/png", Width: 4, Height: 3}) {
			t.Errorf("png info = %+v", pngInfo)
		}
		jpegInfo, err := Inspect(encodeJPEG(t, 5, 2), generousLimits())
		if err != nil {
			t.Fatalf("Inspect(jpeg) error = %v", err)
		}
		if jpegInfo.MediaType != "image/jpeg" || jpegInfo.Width != 5 || jpegInfo.Height != 2 {
			t.Errorf("jpeg info = %+v", jpegInfo)
		}
	})

	tests := []struct {
		name    string
		content []byte
		limits  Limits
	}{
		{name: "異常系: 空", content: nil, limits: generousLimits()},
		{name: "異常系: 画像でない", content: []byte("not an image"), limits: generousLimits()},
		{name: "異常系: 壊れた PNG 本体", content: encodePNG(t, 4, 4)[:40], limits: generousLimits()},
		{name: "境界値系: バイト上限を 1 超える", content: encodePNG(t, 4, 4), limits: Limits{MaxBytes: int64(len(encodePNG(t, 4, 4))) - 1, MaxWidth: 64, MaxHeight: 64, MaxPixels: 4096}},
		{name: "境界値系: 幅が上限を 1 超える", content: encodePNG(t, 5, 1), limits: Limits{MaxBytes: 1 << 20, MaxWidth: 4, MaxHeight: 64, MaxPixels: 4096}},
		{name: "境界値系: 高さが上限を 1 超える", content: encodePNG(t, 1, 5), limits: Limits{MaxBytes: 1 << 20, MaxWidth: 64, MaxHeight: 4, MaxPixels: 4096}},
		{name: "境界値系: 画素数が上限を超える", content: encodePNG(t, 4, 4), limits: Limits{MaxBytes: 1 << 20, MaxWidth: 64, MaxHeight: 64, MaxPixels: 15}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Inspect(tt.content, tt.limits)
			if !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
				t.Fatalf("Inspect() error = %v, want ErrGeneratedImageInvalid", err)
			}
		})
	}

	t.Run("境界値系: ちょうど上限の画像は受け入れる", func(t *testing.T) {
		content := encodePNG(t, 4, 4)
		limits := Limits{MaxBytes: int64(len(content)), MaxWidth: 4, MaxHeight: 4, MaxPixels: 16}
		if _, err := Inspect(content, limits); err != nil {
			t.Fatalf("Inspect() error = %v", err)
		}
	})
}

func TestInspectGenerated(t *testing.T) {
	t.Parallel()
	content := encodePNG(t, 4, 3)

	t.Run("正常系: 申告どおり", func(t *testing.T) {
		generated := domainservice.GeneratedImage{Content: content, MediaType: "image/png", Width: 4, Height: 3}
		if _, err := InspectGenerated(generated, generousLimits()); err != nil {
			t.Fatalf("InspectGenerated() error = %v", err)
		}
	})
	t.Run("異常系: media type の申告が違う", func(t *testing.T) {
		generated := domainservice.GeneratedImage{Content: content, MediaType: "image/jpeg", Width: 4, Height: 3}
		if _, err := InspectGenerated(generated, generousLimits()); !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
			t.Fatalf("error = %v", err)
		}
	})
	t.Run("異常系: 寸法の申告が違う", func(t *testing.T) {
		generated := domainservice.GeneratedImage{Content: content, MediaType: "image/png", Width: 3, Height: 4}
		if _, err := InspectGenerated(generated, generousLimits()); !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
			t.Fatalf("error = %v", err)
		}
	})
}

func TestExtension(t *testing.T) {
	t.Parallel()
	if ext, ok := Extension("image/png"); !ok || ext != ".png" {
		t.Errorf("png = %q, %v", ext, ok)
	}
	if ext, ok := Extension("image/jpeg"); !ok || ext != ".jpg" {
		t.Errorf("jpeg = %q, %v", ext, ok)
	}
	if _, ok := Extension("image/gif"); ok {
		t.Error("gif must not be supported")
	}
}

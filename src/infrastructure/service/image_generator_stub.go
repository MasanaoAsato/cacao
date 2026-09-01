package service

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/png"

	domainservice "cacao/src/domain/service"
)

// ImageGeneratorStub はGPUや外部APIを使わず固定PNGを返す画像生成器である。
type ImageGeneratorStub struct {
	// ErrOn はテスト時だけ生成エラーを注入するためのフィールドである。
	ErrOn   error
	content []byte
}

// ImageGeneratorStubOption は ImageGeneratorStub の構成を変更する。
type ImageGeneratorStubOption func(*ImageGeneratorStub)

// WithImageGeneratorStubError は指定したエラーを生成時に返す設定を作る。
func WithImageGeneratorStubError(err error) ImageGeneratorStubOption {
	return func(stub *ImageGeneratorStub) {
		stub.ErrOn = err
	}
}

// NewImageGeneratorStub は固定PNGを返すStubを生成する。
func NewImageGeneratorStub(options ...ImageGeneratorStubOption) *ImageGeneratorStub {
	stub := &ImageGeneratorStub{content: newStubPNG()}
	for _, option := range options {
		if option != nil {
			option(stub)
		}
	}

	return stub
}

var _ domainservice.ImageGenerator = (*ImageGeneratorStub)(nil)

// Generate は有効な ImageBrief に対して固定PNGを返す。
func (s *ImageGeneratorStub) Generate(
	ctx context.Context,
	brief domainservice.ImageBrief,
) (domainservice.GeneratedImage, error) {
	if err := ctx.Err(); err != nil {
		return domainservice.GeneratedImage{}, err
	}
	if _, err := domainservice.NewImageBrief(
		brief.Destination(),
		brief.Period(),
		brief.Slot(),
		brief.Style(),
	); err != nil {
		return domainservice.GeneratedImage{}, fmt.Errorf(
			"%w: %w",
			domainservice.ErrImageGenerationRejected,
			err,
		)
	}
	if s.ErrOn != nil {
		return domainservice.GeneratedImage{}, s.ErrOn
	}

	content := s.content
	if len(content) == 0 {
		content = newStubPNG()
	}

	return domainservice.GeneratedImage{
		Content:   append([]byte(nil), content...),
		MediaType: "image/png",
		Width:     2,
		Height:    2,
	}, nil
}

func newStubPNG() []byte {
	var buffer bytes.Buffer
	canvas := image.NewRGBA(image.Rect(0, 0, 2, 2))
	canvas.Set(0, 0, color.RGBA{R: 28, G: 92, B: 79, A: 255})
	canvas.Set(1, 0, color.RGBA{R: 241, G: 202, B: 120, A: 255})
	canvas.Set(0, 1, color.RGBA{R: 241, G: 202, B: 120, A: 255})
	canvas.Set(1, 1, color.RGBA{R: 28, G: 92, B: 79, A: 255})
	if err := png.Encode(&buffer, canvas); err != nil {
		panic(fmt.Sprintf("encode image generator stub PNG: %v", err))
	}

	return buffer.Bytes()
}

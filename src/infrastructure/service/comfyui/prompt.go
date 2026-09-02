package comfyui

import (
	"fmt"
	"strings"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	imageprompt "cacao/src/infrastructure/service/prompt"
)

const maxPositiveSeed = int64(1<<63 - 1)

// Prompt は ComfyUI workflow へ渡す画像生成値を表す。
type Prompt struct {
	Positive string
	Negative string
	Seed     int64
	Width    int
	Height   int
}

// NewPrompt は画像ブリーフから画像生成用の prompt と pixel preset を作成する。
func NewPrompt(brief domainservice.ImageBrief) (Prompt, error) {
	imagePrompt, err := imageprompt.BuildImagePrompt(brief)
	if err != nil {
		return Prompt{}, fmt.Errorf("build image prompt: %w", err)
	}

	width, height := imageSize(brief.Slot().Purpose())
	return Prompt{
		Positive: imagePrompt.Positive,
		Negative: imagePrompt.Negative,
		Seed:     imagePrompt.Seed,
		Width:    width,
		Height:   height,
	}, nil
}

// BuildPrompt は NewPrompt の明示的な別名である。
func BuildPrompt(brief domainservice.ImageBrief) (Prompt, error) {
	return NewPrompt(brief)
}

func imageSize(purpose value_object.ImagePurpose) (int, int) {
	if purpose == value_object.ImagePurposeCover {
		return 896, 1280
	}

	return 1024, 768
}

func validatePrompt(prompt Prompt) error {
	if strings.TrimSpace(prompt.Positive) == "" {
		return fmt.Errorf("positive prompt must not be empty")
	}
	if strings.TrimSpace(prompt.Negative) == "" {
		return fmt.Errorf("negative prompt must not be empty")
	}
	if prompt.Seed <= 0 || prompt.Seed > maxPositiveSeed {
		return fmt.Errorf("seed must be positive 63-bit integer")
	}
	if prompt.Width <= 0 || prompt.Height <= 0 {
		return fmt.Errorf("image dimensions must be positive")
	}

	return nil
}

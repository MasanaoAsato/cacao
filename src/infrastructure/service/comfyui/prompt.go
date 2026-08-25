package comfyui

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"strings"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

const defaultNegativePrompt = "low quality, blurry, watermark, logo, text, distorted, duplicate"

const maxPositiveSeed = int64(1<<63 - 1)

// Prompt はComfyUI workflowへ渡すprovider中立の画像生成値を表す。
type Prompt struct {
	Positive string
	Negative string
	Seed     int64
	Width    int
	Height   int
}

// NewPrompt は画像ブリーフから画像生成用のpromptとpresetを作成する。
func NewPrompt(brief domainservice.ImageBrief) (Prompt, error) {
	if _, err := domainservice.NewImageBrief(
		brief.Destination(),
		brief.Period(),
		brief.Slot(),
	); err != nil {
		return Prompt{}, fmt.Errorf("invalid image brief: %w", err)
	}

	seed, err := newSeed()
	if err != nil {
		return Prompt{}, fmt.Errorf("generate image seed: %w", err)
	}

	width, height := imageSize(brief.Slot().Purpose())
	destination := brief.Destination().String()

	positive := fmt.Sprintf(
		"A polished, text-free travel background illustration of %s. "+
			"Depict scenery, architecture, color palette, vegetation, and weather that are geographically and climatically authentic to the destination. "+
			"Do not use generic seasonal motifs, landmarks, or vegetation from other regions. "+
			"%s "+
			"Background artwork only. No typography, text, letters, words, numbers, dates, logos, watermarks, captions, or signage.",
		destination,
		composition(brief.Slot().Purpose()),
	)

	return Prompt{
		Positive: positive,
		Negative: defaultNegativePrompt,
		Seed:     seed,
		Width:    width,
		Height:   height,
	}, nil
}

// BuildPrompt はNewPromptの明示的な別名である。
func BuildPrompt(brief domainservice.ImageBrief) (Prompt, error) {
	return NewPrompt(brief)
}

func newSeed() (int64, error) {
	var buffer [8]byte
	if _, err := rand.Read(buffer[:]); err != nil {
		return 0, err
	}

	seed := int64(binary.BigEndian.Uint64(buffer[:]) & uint64(maxPositiveSeed))
	if seed == 0 {
		seed = 1
	}

	return seed, nil
}

func imageSize(purpose value_object.ImagePurpose) (int, int) {
	if purpose == value_object.ImagePurposeCover {
		return 896, 1280
	}

	return 1024, 768
}

func composition(purpose value_object.ImagePurpose) string {
	if purpose == value_object.ImagePurposeCover {
		return "Use a portrait composition with a clean, uncluttered upper area for later layout."
	}

	return "Use a landscape composition with a balanced focal point and uncluttered margins for later layout."
}

func validatePrompt(prompt Prompt) error {
	if strings.TrimSpace(prompt.Positive) == "" {
		return fmt.Errorf("positive prompt must not be empty")
	}
	if strings.TrimSpace(prompt.Negative) == "" {
		return fmt.Errorf("negative prompt must not be empty")
	}
	if prompt.Seed <= 0 || prompt.Seed > maxPositiveSeed {
		return fmt.Errorf("seed must be a positive 63-bit integer")
	}
	if prompt.Width <= 0 || prompt.Height <= 0 {
		return fmt.Errorf("image dimensions must be positive")
	}

	return nil
}

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
		`DESTINATION REFERENCE:
		%s

		The destination above is semantic reference information only.
		Use it only to determine the appropriate geography, climate, architecture,
		vegetation, landscape, and atmosphere.
		Never reproduce, copy, spell, transliterate, translate, or visually render
		the destination name itself anywhere in the image.

		Create a polished environmental background illustration representing that destination.

		Depict scenery, architecture, color palette, vegetation, and weather that are
		geographically and climatically authentic to the destination.
		Do not use generic seasonal motifs, landmarks, or vegetation from other regions.

		Use a full-frame scenic composition.
		%s
		This is environmental artwork, not a travel poster, postcard, title card,
		advertisement, brochure, magazine cover, or promotional graphic.
		Do not reserve empty space for a title or heading.

		Any signs, plaques, storefront signs, billboards, posters, displays, labels,
		or other surfaces that would normally contain writing must instead be blank,
		unmarked, or contain only non-symbolic decorative texture.

		Background artwork only.
		No typography, text, letters, words, numbers, dates, place names, logos,
		watermarks, captions, signage, pseudo-text, fictional writing, or
		text-like markings anywhere in the image.`,
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

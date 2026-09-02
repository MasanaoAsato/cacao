package imageprompt

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

const (
	defaultNegativePrompt = "low quality, blurry, watermark, logo, text, distorted, duplicate"
)

// MaxPositiveSeed は画像生成 seed の上限（正の 63bit 整数）。
const MaxPositiveSeed = int64(1<<63 - 1)

// ImagePrompt は画像生成プロバイダーへ渡す共通の画像プロンプトを表す。
type ImagePrompt struct {
	Positive string
	Negative string
	Seed     int64
}

// BuildImagePrompt は画像ブリーフからプロバイダー中立の画像プロンプトを作成する。
func BuildImagePrompt(brief domainservice.ImageBrief) (ImagePrompt, error) {
	if _, err := domainservice.NewImageBrief(
		brief.Destination(),
		brief.Period(),
		brief.Slot(),
		brief.Style(),
	); err != nil {
		return ImagePrompt{}, fmt.Errorf("invalid image brief: %w", err)
	}

	seed, err := newSeed()
	if err != nil {
		return ImagePrompt{}, fmt.Errorf("generate image seed: %w", err)
	}

	rendering, err := renderingInstruction(
		brief.Style(),
		brief.Slot().Purpose(),
	)
	if err != nil {
		return ImagePrompt{}, fmt.Errorf("resolve image visual style: %w", err)
	}

	period := brief.Period()
	positive := fmt.Sprintf(
		`DESTINATION REFERENCE:
		%s

		The destination above is semantic reference information only.
		Use it only to determine the appropriate geography, climate, architecture,
		vegetation, landscape, and atmosphere.
		Never reproduce, copy, spell, transliterate, translate, or visually render
		the destination name itself anywhere in the image.

		TRAVEL PERIOD (SEMANTIC REFERENCE ONLY):
		%s through %s
		Use this only to infer the local season, weather, and atmosphere for the destination.
		Never render the dates, time, calendar, or numbers in the image.

		%s

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
		brief.Destination().String(),
		period.StartDate().Format(time.DateOnly),
		period.EndDate().Format(time.DateOnly),
		rendering,
		composition(brief.Slot().Purpose()),
	)

	return ImagePrompt{
		Positive: positive,
		Negative: defaultNegativePrompt,
		Seed:     seed,
	}, nil
}

func newSeed() (int64, error) {
	var buffer [8]byte
	if _, err := rand.Read(buffer[:]); err != nil {
		return 0, err
	}

	seed := int64(binary.BigEndian.Uint64(buffer[:]) & uint64(MaxPositiveSeed))
	if seed == 0 {
		seed = 1
	}

	return seed, nil
}

func composition(purpose value_object.ImagePurpose) string {
	if purpose == value_object.ImagePurposeCover {
		return "Use a portrait composition with a balanced focal point and details extending through the entire frame."
	}

	return "Use a landscape composition with a balanced focal point and uncluttered margins for later layout."
}

func renderingInstruction(
	style value_object.ImageVisualStyle,
	purpose value_object.ImagePurpose,
) (string, error) {
	if purpose == value_object.ImagePurposeIllustration {
		if style != value_object.ImageVisualStyleNone {
			return "", fmt.Errorf("illustration image visual style must be none")
		}

		return "Create a polished environmental background illustration representing that destination.", nil
	}

	if purpose != value_object.ImagePurposeCover {
		return "", fmt.Errorf("unsupported image purpose: %q", purpose)
	}

	switch style {
	case value_object.ImageVisualStyleEditorialPhotograph:
		return "Render as a natural-light editorial travel photograph with realistic materials and true-to-place color.", nil
	case value_object.ImageVisualStyleCinematicPhotograph:
		return "Render as a cinematic environmental photograph with restrained filmic color grading and authentic local light.", nil
	case value_object.ImageVisualStyleWatercolor:
		return "Render as a layered transparent watercolor painting with restrained paper texture.", nil
	case value_object.ImageVisualStyleGouache:
		return "Render as a matte gouache painting with clear shapes and tactile brushwork.", nil
	case value_object.ImageVisualStyleOilPainting:
		return "Render as a contemporary plein-air oil painting with natural colors and visible painterly texture.", nil
	case value_object.ImageVisualStylePastel:
		return "Render as a soft pastel painting with a controlled palette and gentle grain.", nil
	default:
		return "", fmt.Errorf("unsupported cover image visual style: %q", style)
	}
}

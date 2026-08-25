package comfyui

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"strings"
	"time"

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
	ordinal := brief.Slot().Ordinal()
	period := brief.Period()
	destination := brief.Destination().String()

	positive := fmt.Sprintf(
		"A polished travel illustration for %s, a %d-day journey from %s to %s, %s image slot %d, %s season, suitable for a travel journal.",
		destination,
		period.Days(),
		period.StartDate().Format(time.DateOnly),
		period.EndDate().Format(time.DateOnly),
		brief.Slot().Purpose().String(),
		ordinal,
		season(period.StartDate()),
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

func season(date time.Time) string {
	switch date.Month() {
	case time.December, time.January, time.February:
		return "winter"
	case time.March, time.April, time.May:
		return "spring"
	case time.June, time.July, time.August:
		return "summer"
	default:
		return "autumn"
	}
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

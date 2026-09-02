package comfyui

import (
	"cacao/src/infrastructure/imagegen/imageprompt"
	"strings"
	"testing"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

func TestNewPromptUsesPurposePreset(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		purpose    value_object.ImagePurpose
		ordinal    int
		width      int
		height     int
		promptText string
	}{
		{
			name:       "cover",
			purpose:    value_object.ImagePurposeCover,
			ordinal:    1,
			width:      896,
			height:     1280,
			promptText: "portrait composition",
		},
		{
			name:       "illustration",
			purpose:    value_object.ImagePurposeIllustration,
			ordinal:    2,
			width:      1024,
			height:     768,
			promptText: "landscape composition",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			brief := newTestBrief(t, testCase.purpose, testCase.ordinal)
			prompt, err := NewPrompt(brief)
			if err != nil {
				t.Fatalf("NewPrompt() error = %v", err)
			}
			if prompt.Width != testCase.width || prompt.Height != testCase.height {
				t.Fatalf("dimensions = %dx%d, want %dx%d", prompt.Width, prompt.Height, testCase.width, testCase.height)
			}
			if !strings.Contains(prompt.Positive, testCase.promptText) {
				t.Fatalf("positive prompt = %q, want it to contain %q", prompt.Positive, testCase.promptText)
			}
			if !strings.Contains(prompt.Positive, "Kyoto, Japan") {
				t.Fatalf("positive prompt = %q, want destination", prompt.Positive)
			}
			if prompt.Negative == "" || prompt.Seed <= 0 || prompt.Seed > imageprompt.MaxPositiveSeed {
				t.Fatalf("invalid generated prompt values: %+v", prompt)
			}
		})
	}
}

func TestNewPromptRejectsInvalidBrief(t *testing.T) {
	t.Parallel()

	if _, err := NewPrompt(domainservice.ImageBrief{}); err == nil {
		t.Fatal("NewPrompt() error = nil, want error")
	}
}

func TestNewPromptUsesEveryCoverVisualStyle(t *testing.T) {
	t.Parallel()

	for _, style := range value_object.CoverImageVisualStyleCatalog() {
		style := style
		t.Run(style.String(), func(t *testing.T) {
			brief := newTestBriefWithStyle(t, value_object.ImagePurposeCover, 1, style)
			prompt, err := NewPrompt(brief)
			if err != nil {
				t.Fatalf("NewPrompt() error = %v", err)
			}
			if !strings.Contains(prompt.Positive, stylePromptKeyword(style)) {
				t.Fatalf("positive prompt = %q, want style keyword %q", prompt.Positive, stylePromptKeyword(style))
			}
			if !strings.Contains(prompt.Positive, "No typography, text, letters, words, numbers, dates") {
				t.Fatalf("positive prompt = %q, want text-free contract", prompt.Positive)
			}
		})
	}
}

func stylePromptKeyword(style value_object.ImageVisualStyle) string {
	switch style {
	case value_object.ImageVisualStyleEditorialPhotograph:
		return "editorial travel photograph"
	case value_object.ImageVisualStyleCinematicPhotograph:
		return "cinematic environmental photograph"
	case value_object.ImageVisualStyleWatercolor:
		return "transparent watercolor painting"
	case value_object.ImageVisualStyleGouache:
		return "matte gouache painting"
	case value_object.ImageVisualStyleOilPainting:
		return "plein-air oil painting"
	case value_object.ImageVisualStylePastel:
		return "soft pastel painting"
	default:
		return ""
	}
}

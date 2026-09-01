package comfyui

import (
	"strings"
	"testing"

	"cacao/src/domain/value_object"
)

func TestNewPromptCreatesTextFreeBackground(t *testing.T) {
	t.Parallel()

	brief := newTestBrief(t, value_object.ImagePurposeCover, 1)

	prompt, err := NewPrompt(brief)
	if err != nil {
		t.Fatalf("NewPrompt() error = %v", err)
	}

	for _, want := range []string{
		"Kyoto, Japan",
		"TRAVEL PERIOD (SEMANTIC REFERENCE ONLY)",
		"2026-04-01 through 2026-04-03",
		"geographically and climatically authentic",
		"Do not use generic seasonal motifs",
		"No typography, text, letters, words, numbers, dates",
		"editorial travel photograph",
		"portrait composition with a balanced focal point and details extending through the entire frame",
	} {
		if !strings.Contains(prompt.Positive, want) {
			t.Errorf("positive prompt = %q, want it contain %q", prompt.Positive, want)
		}
	}

	for _, unwanted := range []string{
		"clean, uncluttered upper area for later layout",
		"image slot",
		"travel journal",
	} {
		if strings.Contains(prompt.Positive, unwanted) {
			t.Errorf("positive prompt = %q, must not contain %q", prompt.Positive, unwanted)
		}
	}
}

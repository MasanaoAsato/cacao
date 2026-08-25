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
		"geographically and climatically authentic",
		"Do not use generic seasonal motifs",
		"No typography, text, letters, words, numbers, dates",
		"portrait composition",
	} {
		if !strings.Contains(prompt.Positive, want) {
			t.Errorf("positive prompt = %q, want it contain %q", prompt.Positive, want)
		}
	}

	for _, unwanted := range []string{
		"2026-04-01",
		"2026-04-03",
		"image slot",
		"travel journal",
	} {
		if strings.Contains(prompt.Positive, unwanted) {
			t.Errorf("positive prompt = %q, must not contain %q", prompt.Positive, unwanted)
		}
	}
}

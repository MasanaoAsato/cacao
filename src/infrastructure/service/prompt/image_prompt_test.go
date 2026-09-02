package prompt

import (
	"strings"
	"testing"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

func TestBuildImagePrompt(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		purpose value_object.ImagePurpose
		style   value_object.ImageVisualStyle
		want    string
	}{
		{
			name:    "cover",
			purpose: value_object.ImagePurposeCover,
			style:   value_object.ImageVisualStyleEditorialPhotograph,
			want:    "portrait composition",
		},
		{
			name:    "illustration",
			purpose: value_object.ImagePurposeIllustration,
			style:   value_object.ImageVisualStyleNone,
			want:    "landscape composition",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			brief := newImagePromptTestBrief(t, testCase.purpose, testCase.style)
			got, err := BuildImagePrompt(brief)
			if err != nil {
				t.Fatalf("BuildImagePrompt() error = %v", err)
			}
			for _, want := range []string{
				"Kyoto, Japan",
				"2026-04-01 through 2026-04-03",
				"No typography, text, letters, words, numbers, dates",
				testCase.want,
			} {
				if !strings.Contains(got.Positive, want) {
					t.Errorf("positive prompt = %q, want it to contain %q", got.Positive, want)
				}
			}
			if got.Negative == "" || got.Seed <= 0 || got.Seed > maxPositiveSeed {
				t.Fatalf("invalid image prompt values: %+v", got)
			}
		})
	}
}

func TestBuildImagePromptRejectsInvalidBrief(t *testing.T) {
	t.Parallel()
	if _, err := BuildImagePrompt(domainservice.ImageBrief{}); err == nil {
		t.Fatal("BuildImagePrompt() error = nil, want error")
	}
}

func TestRenderingInstructionRejectsInvalidIllustrationStyle(t *testing.T) {
	t.Parallel()
	if _, err := renderingInstruction(
		value_object.ImageVisualStyleEditorialPhotograph,
		value_object.ImagePurposeIllustration,
	); err == nil {
		t.Fatal("renderingInstruction() error = nil, want error")
	}
}

func newImagePromptTestBrief(
	t *testing.T,
	purpose value_object.ImagePurpose,
	style value_object.ImageVisualStyle,
) domainservice.ImageBrief {
	t.Helper()
	destination, err := value_object.NewDestination("Kyoto", "Japan")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	period, err := value_object.NewPeriod(
		time.Date(2026, time.April, 1, 12, 0, 0, 0, time.UTC),
		time.Date(2026, time.April, 3, 12, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	slot, err := value_object.NewImageSlot(purpose, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	brief, err := domainservice.NewImageBrief(destination, period, slot, style)
	if err != nil {
		t.Fatalf("NewImageBrief() error = %v", err)
	}
	return brief
}

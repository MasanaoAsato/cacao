package imageprompt

import (
	"testing"

	"cacao/src/domain/value_object"
)

func TestCoverStyleInstructionCoversV2Catalog(t *testing.T) {
	t.Parallel()

	catalog := value_object.CoverImageVisualStyleCatalog()
	if len(coverStyleInstructions) != len(catalog) {
		t.Fatalf("instruction count = %d, want %d", len(coverStyleInstructions), len(catalog))
	}

	instructions := map[string]struct{}{}
	for _, style := range catalog {
		instruction, err := coverStyleInstruction(style)
		if err != nil {
			t.Fatalf("coverStyleInstruction(%q) error = %v", style, err)
		}
		if instruction == "" {
			t.Errorf("coverStyleInstruction(%q) returned an empty instruction", style)
		}
		if _, ok := instructions[instruction]; ok {
			t.Errorf("coverStyleInstruction(%q) duplicated %q", style, instruction)
		}
		instructions[instruction] = struct{}{}
	}
}

func TestCoverStyleInstructionRejectsLegacyStyle(t *testing.T) {
	t.Parallel()

	if _, err := coverStyleInstruction(value_object.ImageVisualStyleEditorialPhotograph); err == nil {
		t.Fatal("coverStyleInstruction() error = nil, want error")
	}
}

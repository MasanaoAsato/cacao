package comfyui

import (
	"encoding/json"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

const testWorkflowJSON = `{
  "3": {"inputs": {"seed": 1}, "class_type": "KSampler"},
  "5": {"inputs": {"width": 896, "height": 1280}, "class_type": "EmptyLatentImage"},
  "6": {"inputs": {"text": "positive"}, "class_type": "CLIPTextEncode"},
  "7": {"inputs": {"text": "negative"}, "class_type": "CLIPTextEncode"},
  "9": {"inputs": {"images": ["8", 0]}, "class_type": "SaveImage"}
}`

const testManifestJSON = `{
  "version": "v1",
  "positive_prompt": {"node_id": "6", "input": "text"},
  "negative_prompt": {"node_id": "7", "input": "text"},
  "seed": {"node_id": "3", "input": "seed"},
  "size": {"node_id": "5", "width_input": "width", "height_input": "height"},
  "output_node_id": "9"
}`

func TestNewWorkflowBuild(t *testing.T) {
	t.Parallel()

	workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
	if err != nil {
		t.Fatalf("NewWorkflowFromBytes() error = %v", err)
	}
	brief := newTestBrief(t, value_object.ImagePurposeCover, 1)
	prompt := Prompt{
		Positive: "destination prompt",
		Negative: "bad quality",
		Seed:     42,
		Width:    896,
		Height:   1280,
	}
	data, err := workflow.Build(prompt)
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	var nodes map[string]struct {
		Inputs map[string]any `json:"inputs"`
	}
	if err := json.Unmarshal(data, &nodes); err != nil {
		t.Fatalf("decode built workflow: %v", err)
	}
	if got := nodes["6"].Inputs["text"]; got != prompt.Positive {
		t.Fatalf("positive prompt = %v, want %q", got, prompt.Positive)
	}
	if got := nodes["7"].Inputs["text"]; got != prompt.Negative {
		t.Fatalf("negative prompt = %v, want %q", got, prompt.Negative)
	}
	if got := int64(nodes["3"].Inputs["seed"].(float64)); got != prompt.Seed {
		t.Fatalf("seed = %d, want %d", got, prompt.Seed)
	}
	if got := int(nodes["5"].Inputs["width"].(float64)); got != prompt.Width {
		t.Fatalf("width = %d, want %d", got, prompt.Width)
	}
	if got := int(nodes["5"].Inputs["height"].(float64)); got != prompt.Height {
		t.Fatalf("height = %d, want %d", got, prompt.Height)
	}
	if got := workflow.OutputNodeID(); got != "9" {
		t.Fatalf("OutputNodeID() = %q, want %q", got, "9")
	}
	if brief.Slot().Purpose() != value_object.ImagePurposeCover {
		t.Fatalf("test brief was not created as cover")
	}
}

func TestZImageTurboWorkflowConfiguration(t *testing.T) {
	t.Parallel()

	workflow, err := NewWorkflow(
		zImageTurboConfigPath(t, "journey_image_api.json"),
		zImageTurboConfigPath(t, "journey_image_manifest.json"),
	)
	if err != nil {
		t.Fatalf("NewWorkflow() error = %v", err)
	}
	if workflow.Manifest().NegativePrompt != nil {
		t.Fatal("Z-Image Turbo manifest must not set a negative prompt binding")
	}

	prompt := Prompt{
		Positive: "Kyoto in spring",
		Negative: "unused negative prompt",
		Seed:     42,
		Width:    896,
		Height:   1280,
	}
	data, err := workflow.Build(prompt)
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	var nodes map[string]struct {
		Inputs map[string]any `json:"inputs"`
	}
	if err := json.Unmarshal(data, &nodes); err != nil {
		t.Fatalf("decode built workflow: %v", err)
	}
	if got := nodes["57:27"].Inputs["text"]; got != prompt.Positive {
		t.Fatalf("positive prompt = %v, want %q", got, prompt.Positive)
	}
	if got := int64(nodes["57:3"].Inputs["seed"].(float64)); got != prompt.Seed {
		t.Fatalf("seed = %d, want %d", got, prompt.Seed)
	}
	if got := int(nodes["57:13"].Inputs["width"].(float64)); got != prompt.Width {
		t.Fatalf("width = %d, want %d", got, prompt.Width)
	}
	if got := int(nodes["57:13"].Inputs["height"].(float64)); got != prompt.Height {
		t.Fatalf("height = %d, want %d", got, prompt.Height)
	}
	conditioning, ok := nodes["57:33"].Inputs["conditioning"].([]any)
	if !ok || len(conditioning) != 2 || conditioning[0] != "57:27" || conditioning[1] != float64(0) {
		t.Fatalf("zero conditioning = %v, want [57:27 0]", nodes["57:33"].Inputs["conditioning"])
	}
	if got := workflow.OutputNodeID(); got != "9" {
		t.Fatalf("OutputNodeID() = %q, want %q", got, "9")
	}
}

func TestWorkflowManifestReturnsIndependentNegativeBinding(t *testing.T) {
	t.Parallel()

	workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
	if err != nil {
		t.Fatalf("NewWorkflowFromBytes() error = %v", err)
	}
	manifest := workflow.Manifest()
	if manifest.NegativePrompt == nil {
		t.Fatal("Manifest().NegativePrompt = nil, want binding")
	}
	manifest.NegativePrompt.Input = "changed"

	data, err := workflow.Build(Prompt{
		Positive: "positive",
		Negative: "negative",
		Seed:     1,
		Width:    896,
		Height:   1280,
	})
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	var nodes map[string]struct {
		Inputs map[string]any `json:"inputs"`
	}
	if err := json.Unmarshal(data, &nodes); err != nil {
		t.Fatalf("decode built workflow: %v", err)
	}
	if got := nodes["7"].Inputs["text"]; got != "negative" {
		t.Fatalf("negative prompt = %v, want %q", got, "negative")
	}
}

func TestNewWorkflowRejectsInvalidManifest(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		manifest string
	}{
		{
			name:     "unsupported version",
			manifest: strings.Replace(testManifestJSON, `"v1"`, `"v2"`, 1),
		},
		{
			name:     "unknown field",
			manifest: strings.Replace(testManifestJSON, `"output_node_id": "9"`, `"output_node_id": "9", "unexpected": true`, 1),
		},
		{
			name:     "missing input",
			manifest: strings.Replace(testManifestJSON, `"input": "text"`, `"input": "missing"`, 1),
		},
		{
			name:     "missing output node",
			manifest: strings.Replace(testManifestJSON, `"output_node_id": "9"`, `"output_node_id": "99"`, 1),
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testCase.manifest))
			if err == nil {
				t.Fatal("NewWorkflowFromBytes() error = nil, want error")
			}
		})
	}
}

func TestWorkflowBuildRejectsInvalidPrompt(t *testing.T) {
	t.Parallel()

	workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
	if err != nil {
		t.Fatalf("NewWorkflowFromBytes() error = %v", err)
	}

	cases := []struct {
		name   string
		prompt Prompt
	}{
		{
			name: "zero seed",
			prompt: Prompt{
				Positive: "positive",
				Negative: "negative",
				Width:    1,
				Height:   1,
			},
		},
		{
			name: "zero width",
			prompt: Prompt{
				Positive: "positive",
				Negative: "negative",
				Seed:     1,
				Height:   1,
			},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if _, err := workflow.Build(testCase.prompt); err == nil {
				t.Fatal("Build() error = nil, want error")
			}
		})
	}
}

func TestWorkflowBuildIsSafeForConcurrentCalls(t *testing.T) {
	t.Parallel()

	workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
	if err != nil {
		t.Fatalf("NewWorkflowFromBytes() error = %v", err)
	}

	cases := []Prompt{
		{Positive: "first", Negative: "negative-1", Seed: 1, Width: 896, Height: 1280},
		{Positive: "second", Negative: "negative-2", Seed: 2, Width: 1024, Height: 768},
	}
	var waitGroup sync.WaitGroup
	for _, prompt := range cases {
		prompt := prompt
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			for range 20 {
				data, err := workflow.Build(prompt)
				if err != nil {
					t.Errorf("Build() error = %v", err)
					return
				}
				if !strings.Contains(string(data), prompt.Positive) {
					t.Errorf("built workflow does not contain %q", prompt.Positive)
					return
				}
			}
		}()
	}
	waitGroup.Wait()
}

func newTestBrief(t *testing.T, purpose value_object.ImagePurpose, ordinal int) domainservice.ImageBrief {
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
	slot, err := value_object.NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	brief, err := domainservice.NewImageBrief(destination, period, slot)
	if err != nil {
		t.Fatalf("NewImageBrief() error = %v", err)
	}

	return brief
}

func zImageTurboConfigPath(t *testing.T, fileName string) string {
	t.Helper()

	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller() failed")
	}

	return filepath.Join(filepath.Dir(sourceFile), "..", "..", "..", "..", "config", "comfyui", fileName)
}

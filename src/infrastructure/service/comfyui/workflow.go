package comfyui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

const workflowManifestVersion = "v1"

// InputBinding はmanifestが管理するComfyUI node inputを表す。
type InputBinding struct {
	NodeID string `json:"node_id"`
	Input  string `json:"input"`
}

// SizeBinding は画像サイズを管理するnode inputを表す。
type SizeBinding struct {
	NodeID      string `json:"node_id"`
	WidthInput  string `json:"width_input"`
	HeightInput string `json:"height_input"`
}

// Manifest はcacaoが変更してよいworkflowのnode/inputを宣言する。
type Manifest struct {
	Version        string       `json:"version"`
	PositivePrompt InputBinding `json:"positive_prompt"`
	// NegativePrompt がnilの場合はworkflowが持つ負のconditioningをそのまま使用する。
	NegativePrompt *InputBinding `json:"negative_prompt"`
	Seed           InputBinding  `json:"seed"`
	Size           SizeBinding   `json:"size"`
	OutputNodeID   string        `json:"output_node_id"`
}

// Workflow は検証済みのComfyUI API Format workflow templateを保持する。
type Workflow struct {
	template map[string]json.RawMessage
	manifest Manifest
}

// NewWorkflow はworkflowとmanifestをファイルから読み込んで検証する。
func NewWorkflow(workflowPath, manifestPath string) (*Workflow, error) {
	workflowData, err := os.ReadFile(workflowPath)
	if err != nil {
		return nil, fmt.Errorf("read workflow %q: %w", workflowPath, err)
	}

	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read workflow manifest %q: %w", manifestPath, err)
	}

	return NewWorkflowFromBytes(workflowData, manifestData)
}

// NewWorkflowFromFiles はNewWorkflowの明示的な別名である。
func NewWorkflowFromFiles(workflowPath, manifestPath string) (*Workflow, error) {
	return NewWorkflow(workflowPath, manifestPath)
}

// NewWorkflowFromBytes はJSON bytesからworkflowとmanifestを読み込んで検証する。
func NewWorkflowFromBytes(workflowData, manifestData []byte) (*Workflow, error) {
	template := map[string]json.RawMessage{}
	if err := decodeJSON(workflowData, &template, false); err != nil {
		return nil, fmt.Errorf("decode workflow: %w", err)
	}
	if len(template) == 0 {
		return nil, fmt.Errorf("workflow must contain at least one node")
	}
	if err := validateNodes(template); err != nil {
		return nil, fmt.Errorf("validate workflow: %w", err)
	}

	manifest := Manifest{}
	if err := decodeJSON(manifestData, &manifest, true); err != nil {
		return nil, fmt.Errorf("decode workflow manifest: %w", err)
	}
	if err := validateManifest(template, manifest); err != nil {
		return nil, fmt.Errorf("validate workflow manifest: %w", err)
	}

	return &Workflow{
		template: cloneNodes(template),
		manifest: manifest,
	}, nil
}

// NewWorkflowFromJSON はNewWorkflowFromBytesの読みやすい別名である。
func NewWorkflowFromJSON(workflowData, manifestData []byte) (*Workflow, error) {
	return NewWorkflowFromBytes(workflowData, manifestData)
}

// Manifest はworkflow manifestのコピーを返す。
func (w *Workflow) Manifest() Manifest {
	manifest := w.manifest
	if w.manifest.NegativePrompt != nil {
		negativePrompt := *w.manifest.NegativePrompt
		manifest.NegativePrompt = &negativePrompt
	}

	return manifest
}

// OutputNodeID は画像出力nodeのIDを返す。
func (w *Workflow) OutputNodeID() string {
	return w.manifest.OutputNodeID
}

// Build はprompt値をtemplateへ反映したworkflow JSONを作成する。
func (w *Workflow) Build(prompt Prompt) ([]byte, error) {
	if w == nil {
		return nil, fmt.Errorf("workflow must not be nil")
	}
	if err := validatePrompt(prompt); err != nil {
		return nil, fmt.Errorf("validate prompt: %w", err)
	}

	nodes := cloneNodes(w.template)
	if err := setInput(nodes, w.manifest.PositivePrompt, prompt.Positive); err != nil {
		return nil, fmt.Errorf("set positive prompt: %w", err)
	}
	if w.manifest.NegativePrompt != nil {
		if err := setInput(nodes, *w.manifest.NegativePrompt, prompt.Negative); err != nil {
			return nil, fmt.Errorf("set negative prompt: %w", err)
		}
	}
	if err := setInput(nodes, w.manifest.Seed, prompt.Seed); err != nil {
		return nil, fmt.Errorf("set seed: %w", err)
	}
	if err := setInput(nodes, InputBinding{
		NodeID: w.manifest.Size.NodeID,
		Input:  w.manifest.Size.WidthInput,
	}, prompt.Width); err != nil {
		return nil, fmt.Errorf("set image width: %w", err)
	}
	if err := setInput(nodes, InputBinding{
		NodeID: w.manifest.Size.NodeID,
		Input:  w.manifest.Size.HeightInput,
	}, prompt.Height); err != nil {
		return nil, fmt.Errorf("set image height: %w", err)
	}

	data, err := json.Marshal(nodes)
	if err != nil {
		return nil, fmt.Errorf("encode workflow: %w", err)
	}

	return data, nil
}

func decodeJSON(data []byte, destination any, disallowUnknownFields bool) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	if disallowUnknownFields {
		decoder.DisallowUnknownFields()
	}
	if err := decoder.Decode(destination); err != nil {
		return err
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("multiple JSON values")
		}
		return err
	}

	return nil
}

func validateNodes(nodes map[string]json.RawMessage) error {
	for nodeID, rawNode := range nodes {
		if strings.TrimSpace(nodeID) == "" {
			return fmt.Errorf("node id must not be empty")
		}

		node := map[string]json.RawMessage{}
		if err := decodeJSON(rawNode, &node, false); err != nil {
			return fmt.Errorf("node %q: %w", nodeID, err)
		}

		inputsRaw, ok := node["inputs"]
		if !ok {
			return fmt.Errorf("node %q: inputs are missing", nodeID)
		}
		inputs := map[string]json.RawMessage{}
		if err := decodeJSON(inputsRaw, &inputs, false); err != nil {
			return fmt.Errorf("node %q inputs: %w", nodeID, err)
		}
		if inputs == nil {
			return fmt.Errorf("node %q inputs must be an object", nodeID)
		}
	}

	return nil
}

func validateManifest(nodes map[string]json.RawMessage, manifest Manifest) error {
	if manifest.Version != workflowManifestVersion {
		return fmt.Errorf("unsupported version %q", manifest.Version)
	}
	if err := validateBinding(nodes, "positive_prompt", manifest.PositivePrompt); err != nil {
		return err
	}
	if manifest.NegativePrompt != nil {
		if err := validateBinding(nodes, "negative_prompt", *manifest.NegativePrompt); err != nil {
			return err
		}
	}
	if err := validateBinding(nodes, "seed", manifest.Seed); err != nil {
		return err
	}
	if strings.TrimSpace(manifest.Size.NodeID) == "" {
		return fmt.Errorf("size node id must not be empty")
	}
	if strings.TrimSpace(manifest.Size.WidthInput) == "" {
		return fmt.Errorf("size width input must not be empty")
	}
	if strings.TrimSpace(manifest.Size.HeightInput) == "" {
		return fmt.Errorf("size height input must not be empty")
	}
	if err := validateNodeInput(nodes, "size width", manifest.Size.NodeID, manifest.Size.WidthInput); err != nil {
		return err
	}
	if err := validateNodeInput(nodes, "size height", manifest.Size.NodeID, manifest.Size.HeightInput); err != nil {
		return err
	}
	if strings.TrimSpace(manifest.OutputNodeID) == "" {
		return fmt.Errorf("output node id must not be empty")
	}
	if _, ok := nodes[manifest.OutputNodeID]; !ok {
		return fmt.Errorf("output node %q does not exist", manifest.OutputNodeID)
	}

	return nil
}

func validateBinding(nodes map[string]json.RawMessage, name string, binding InputBinding) error {
	if strings.TrimSpace(binding.NodeID) == "" {
		return fmt.Errorf("%s node id must not be empty", name)
	}
	if strings.TrimSpace(binding.Input) == "" {
		return fmt.Errorf("%s input must not be empty", name)
	}

	return validateNodeInput(nodes, name, binding.NodeID, binding.Input)
}

func validateNodeInput(
	nodes map[string]json.RawMessage,
	name string,
	nodeID string,
	inputName string,
) error {
	rawNode, ok := nodes[nodeID]
	if !ok {
		return fmt.Errorf("%s node %q does not exist", name, nodeID)
	}

	node := map[string]json.RawMessage{}
	if err := decodeJSON(rawNode, &node, false); err != nil {
		return fmt.Errorf("decode %s node %q: %w", name, nodeID, err)
	}
	inputs := map[string]json.RawMessage{}
	if err := decodeJSON(node["inputs"], &inputs, false); err != nil {
		return fmt.Errorf("decode %s inputs: %w", name, err)
	}
	if _, ok := inputs[inputName]; !ok {
		return fmt.Errorf("%s input %q does not exist on node %q", name, inputName, nodeID)
	}

	return nil
}

func setInput(nodes map[string]json.RawMessage, binding InputBinding, value any) error {
	rawNode, ok := nodes[binding.NodeID]
	if !ok {
		return fmt.Errorf("node %q does not exist", binding.NodeID)
	}

	node := map[string]json.RawMessage{}
	if err := decodeJSON(rawNode, &node, false); err != nil {
		return err
	}
	inputs := map[string]json.RawMessage{}
	if err := decodeJSON(node["inputs"], &inputs, false); err != nil {
		return err
	}
	if _, ok := inputs[binding.Input]; !ok {
		return fmt.Errorf("input %q does not exist on node %q", binding.Input, binding.NodeID)
	}

	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	inputs[binding.Input] = json.RawMessage(encoded)
	node["inputs"], err = json.Marshal(inputs)
	if err != nil {
		return err
	}
	nodes[binding.NodeID], err = json.Marshal(node)
	if err != nil {
		return err
	}

	return nil
}

func cloneNodes(nodes map[string]json.RawMessage) map[string]json.RawMessage {
	clone := make(map[string]json.RawMessage, len(nodes))
	for nodeID, rawNode := range nodes {
		clone[nodeID] = append(json.RawMessage(nil), rawNode...)
	}

	return clone
}

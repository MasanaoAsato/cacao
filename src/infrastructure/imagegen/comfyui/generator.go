package comfyui

import (
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/imagecontent"
	"context"
	"errors"
	"fmt"

	domainservice "cacao/src/domain/service"
)

// Generator はComfyUI clientと固定workflowをprovider-neutral portへ適合させる。
type Generator struct {
	client   *Client
	workflow *Workflow
}

// NewGenerator は設定から ComfyUI generator を作成する。
// base URL の解析と workflow / manifest の読込・検証はここで行い、起動時に失敗させる。
func NewGenerator(
	config config.ComfyUI,
	limits imagecontent.Limits,
	options ...ClientOption,
) (*Generator, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("comfyui config: %w", err)
	}
	client, err := NewClient(config.BaseURL, append([]ClientOption{WithLimits(limits)}, options...)...)
	if err != nil {
		return nil, fmt.Errorf("create comfyui client: %w", err)
	}
	workflow, err := NewWorkflow(config.WorkflowPath, config.ManifestPath)
	if err != nil {
		return nil, fmt.Errorf("load comfyui workflow: %w", err)
	}

	return NewGeneratorWithClient(client, workflow)
}

// NewGeneratorWithClient は検証済みclientとworkflowからgeneratorを作成する。
func NewGeneratorWithClient(client *Client, workflow *Workflow) (*Generator, error) {
	if client == nil {
		return nil, fmt.Errorf("comfyui client must not be nil")
	}
	if workflow == nil {
		return nil, fmt.Errorf("comfyui workflow must not be nil")
	}

	return &Generator{client: client, workflow: workflow}, nil
}

var _ domainservice.ImageGenerator = (*Generator)(nil)

// Generate は画像ブリーフをComfyUIの画像へ変換する。
func (g *Generator) Generate(
	ctx context.Context,
	brief domainservice.ImageBrief,
) (domainservice.GeneratedImage, error) {
	if g == nil || g.client == nil || g.workflow == nil {
		return domainservice.GeneratedImage{}, wrapFailure(
			domainservice.ErrImageGeneratorUnavailable,
			errors.New("comfyui generator is not initialized"),
		)
	}
	if ctx == nil {
		return domainservice.GeneratedImage{}, errors.New("context must not be nil")
	}
	if err := ctx.Err(); err != nil {
		return domainservice.GeneratedImage{}, mapContextError(err)
	}

	prompt, err := NewPrompt(brief)
	if err != nil {
		return domainservice.GeneratedImage{}, wrapFailure(domainservice.ErrImageGenerationRejected, err)
	}
	workflow, err := g.workflow.Build(prompt)
	if err != nil {
		return domainservice.GeneratedImage{}, wrapFailure(domainservice.ErrImageGenerationRejected, err)
	}
	promptID, err := g.client.Submit(ctx, workflow)
	if err != nil {
		return domainservice.GeneratedImage{}, mapClientError(err)
	}
	output, err := g.client.WaitForOutput(ctx, promptID, g.workflow.OutputNodeID())
	if err != nil {
		return domainservice.GeneratedImage{}, mapClientError(err)
	}
	image, err := g.client.View(ctx, output)
	if err != nil {
		return domainservice.GeneratedImage{}, mapClientError(err)
	}

	return domainservice.GeneratedImage{
		Content:   image.Content,
		MediaType: image.MediaType,
		Width:     image.Width,
		Height:    image.Height,
	}, nil
}

func mapClientError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		return wrapFailure(domainservice.ErrImageGeneratorTimeout, err)
	}
	if errors.Is(err, context.Canceled) {
		return err
	}

	var clientErr *clientError
	if errors.As(err, &clientErr) {
		switch clientErr.kind {
		case failureRejected:
			return wrapFailure(domainservice.ErrImageGenerationRejected, err)
		case failureInvalid:
			return wrapFailure(domainservice.ErrGeneratedImageInvalid, err)
		case failureUnavailable:
			return wrapFailure(domainservice.ErrImageGeneratorUnavailable, err)
		}
	}

	return wrapFailure(domainservice.ErrImageGeneratorUnavailable, err)
}

func mapContextError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		return wrapFailure(domainservice.ErrImageGeneratorTimeout, err)
	}

	return err
}

func wrapFailure(sentinel, cause error) error {
	if cause == nil {
		return sentinel
	}

	return fmt.Errorf("%w: %w", sentinel, cause)
}

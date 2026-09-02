package imagegen

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/imagecontent"
	"cacao/src/infrastructure/imagegen/imageprompt"
	"cacao/src/infrastructure/openrouterclient"
	"cacao/src/observability"

	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/models/operations"
)

const openRouterImageOperation = "openrouter_generate_image"

// OpenRouterConfig は OpenRouter 画像生成器の実行設定。
// 認証情報とモデルは config.OpenRouterImage、タイムアウトと画像上限は画像設定全体から受け取る。
type OpenRouterConfig struct {
	config.OpenRouterImage
	Timeout time.Duration
	Limits  imagecontent.Limits
}

// Validate は生成に必要な値がすべて揃っているかを検証する。
func (c OpenRouterConfig) Validate() error {
	if err := c.OpenRouterImage.Validate(); err != nil {
		return err
	}
	if c.Timeout <= 0 {
		return errors.New("openrouter image timeout must be greater than zero")
	}
	return c.Limits.Validate()
}

type openRouterImageClient interface {
	Generate(
		ctx context.Context,
		request components.ImageGenerationRequest,
		opts ...operations.Option,
	) (*operations.CreateImagesResponse, error)
}

// OpenRouterGenerator は OpenRouter の画像生成 API を ImageGenerator に適合させる。
type OpenRouterGenerator struct {
	client openRouterImageClient
	config OpenRouterConfig
}

var _ domainservice.ImageGenerator = (*OpenRouterGenerator)(nil)

// NewOpenRouterGenerator は OpenRouter 画像生成器を生成する。設定はここで一度だけ検証する。
func NewOpenRouterGenerator(config OpenRouterConfig) (*OpenRouterGenerator, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid openrouter image config: %w", err)
	}
	client := openrouterclient.New(strings.TrimSpace(config.APIKey), config.Timeout).Images
	return newOpenRouterGenerator(client, config), nil
}

func newOpenRouterGenerator(client openRouterImageClient, config OpenRouterConfig) *OpenRouterGenerator {
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.Model = strings.TrimSpace(config.Model)
	return &OpenRouterGenerator{client: client, config: config}
}

// Generate は画像ブリーフを OpenRouter へ送り、検証済み PNG を返す。
func (g *OpenRouterGenerator) Generate(
	ctx context.Context,
	brief domainservice.ImageBrief,
) (domainservice.GeneratedImage, error) {
	if g == nil || g.client == nil {
		return domainservice.GeneratedImage{}, errors.New("openrouter image generator is not initialized")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return domainservice.GeneratedImage{}, err
	}

	commonPrompt, err := imageprompt.BuildImagePrompt(brief)
	if err != nil {
		return domainservice.GeneratedImage{}, withImageOperation(
			wrapImageFailure(domainservice.ErrImageGenerationRejected, err),
		)
	}
	request, err := g.buildRequest(commonPrompt, brief.Slot().Purpose())
	if err != nil {
		return domainservice.GeneratedImage{}, withImageOperation(
			wrapImageFailure(domainservice.ErrImageGenerationRejected, err),
		)
	}

	requestContext, cancel := context.WithTimeout(ctx, g.config.Timeout)
	defer cancel()
	response, err := g.client.Generate(
		requestContext,
		request,
		operations.WithRetries(openrouterclient.NoRetry()),
		operations.WithOperationTimeout(g.config.Timeout),
	)
	if err != nil {
		return domainservice.GeneratedImage{}, mapOpenRouterImageError(ctx, requestContext, err)
	}
	if err := ctx.Err(); err != nil {
		return domainservice.GeneratedImage{}, err
	}
	if errors.Is(requestContext.Err(), context.DeadlineExceeded) {
		return domainservice.GeneratedImage{}, withImageOperation(
			wrapImageFailure(domainservice.ErrImageGeneratorTimeout, context.DeadlineExceeded),
		)
	}

	generatedImage, err := decodeOpenRouterImage(response, g.config.Limits)
	if err != nil {
		return domainservice.GeneratedImage{}, withImageOperation(err)
	}

	return generatedImage, nil
}

func (g *OpenRouterGenerator) buildRequest(
	commonPrompt imageprompt.ImagePrompt,
	purpose value_object.ImagePurpose,
) (components.ImageGenerationRequest, error) {
	aspectRatio, err := imageAspectRatio(purpose)
	if err != nil {
		return components.ImageGenerationRequest{}, err
	}

	n := int64(1)
	outputFormat := components.ImageGenerationRequestOutputFormatPng
	stream := false
	return components.ImageGenerationRequest{
		Model:        g.config.Model,
		Prompt:       commonPrompt.Positive + "\n\nAvoid all of the following: " + commonPrompt.Negative,
		N:            &n,
		OutputFormat: &outputFormat,
		Stream:       &stream,
		AspectRatio:  &aspectRatio,
	}, nil
}

func imageAspectRatio(purpose value_object.ImagePurpose) (components.ImageGenerationRequestAspectRatio, error) {
	switch purpose {
	case value_object.ImagePurposeCover:
		return components.ImageGenerationRequestAspectRatioTwentyThree, nil
	case value_object.ImagePurposeIllustration:
		return components.ImageGenerationRequestAspectRatioFortyThree, nil
	default:
		return "", fmt.Errorf("unsupported image purpose: %q", purpose)
	}
}

// encodedBase64DecodedLength はデコードせずに復元後のバイト数を求め、巨大な本文を早期に弾く。
func encodedBase64DecodedLength(encoded string) (int64, error) {
	if len(encoded)%4 != 0 {
		return 0, errors.New("base64 length must be a multiple of four")
	}
	if strings.ContainsAny(encoded, "\r\n") {
		return 0, errors.New("base64 line breaks are not supported")
	}

	padding := 0
	if strings.HasSuffix(encoded, "=") {
		padding++
		if strings.HasSuffix(encoded[:len(encoded)-1], "=") {
			padding++
		}
	}
	groups := int64(len(encoded) / 4)
	return groups*3 - int64(padding), nil
}

func decodeOpenRouterImage(
	response *operations.CreateImagesResponse,
	limits imagecontent.Limits,
) (domainservice.GeneratedImage, error) {
	if response == nil {
		return domainservice.GeneratedImage{}, invalidImageOutput("response is empty")
	}
	if response.EventStream != nil || response.Type == operations.CreateImagesResponseTypeEventStream {
		return domainservice.GeneratedImage{}, invalidImageOutput("streaming response is not supported")
	}
	if response.ImageGenerationResponse == nil {
		return domainservice.GeneratedImage{}, invalidImageOutput("image response is empty")
	}
	if len(response.ImageGenerationResponse.Data) != 1 {
		return domainservice.GeneratedImage{}, invalidImageOutput("response must contain exactly one image")
	}

	data := response.ImageGenerationResponse.Data[0]
	if data.MediaType != nil && *data.MediaType != "image/png" {
		return domainservice.GeneratedImage{}, invalidImageOutput("response media type is not png")
	}
	if strings.TrimSpace(data.B64JSON) == "" {
		return domainservice.GeneratedImage{}, invalidImageOutput("response image data is empty")
	}

	decodedLength, err := encodedBase64DecodedLength(data.B64JSON)
	if err != nil {
		return domainservice.GeneratedImage{}, invalidImageOutput("invalid image data encoding")
	}
	if decodedLength > limits.MaxBytes {
		return domainservice.GeneratedImage{}, invalidImageOutput("decoded image exceeds maximum bytes")
	}
	content, err := base64.StdEncoding.Strict().DecodeString(data.B64JSON)
	if err != nil {
		return domainservice.GeneratedImage{}, invalidImageOutput("decode image data")
	}

	info, err := imagecontent.Inspect(content, limits)
	if err != nil {
		return domainservice.GeneratedImage{}, observability.WithErrorDetail(
			observability.ErrorDetailGeneratedImageInvalid,
			err,
		)
	}
	if info.MediaType != "image/png" {
		return domainservice.GeneratedImage{}, invalidImageOutput("image content is not png")
	}

	return domainservice.GeneratedImage{
		Content:   content,
		MediaType: info.MediaType,
		Width:     info.Width,
		Height:    info.Height,
	}, nil
}

func mapOpenRouterImageError(
	parentContext context.Context,
	requestContext context.Context,
	err error,
) error {
	if parentErr := parentContext.Err(); parentErr != nil {
		return parentErr
	}
	cause := openrouterclient.WrapRequestError(err)
	if errors.Is(requestContext.Err(), context.DeadlineExceeded) ||
		errors.Is(err, context.DeadlineExceeded) ||
		isTimeoutNetworkError(err) {
		return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorTimeout, cause))
	}

	if status, ok := openrouterclient.StatusCode(err); ok {
		switch {
		case status == http.StatusRequestTimeout || status == openrouterclient.StatusEdgeNetworkTimeout:
			return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorTimeout, cause))
		case status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
			return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorUnavailable, cause))
		case status >= http.StatusBadRequest && status < http.StatusInternalServerError:
			return withImageOperation(wrapImageFailure(domainservice.ErrImageGenerationRejected, cause))
		}
	}

	return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorUnavailable, cause))
}

func isTimeoutNetworkError(err error) bool {
	var networkError net.Error
	return errors.As(err, &networkError) && networkError.Timeout()
}

// wrapImageFailure はドメインの失敗分類と原因を束ね、ログ用の固定原因コードを付ける。
func wrapImageFailure(classification, cause error) error {
	if classification == nil {
		return cause
	}
	failure := classification
	if cause != nil {
		failure = fmt.Errorf("%w: %w", classification, cause)
	}
	var detail observability.ErrorDetailCode
	switch {
	case errors.Is(classification, domainservice.ErrImageGeneratorTimeout):
		detail = observability.ErrorDetailImageProviderTimeout
	case errors.Is(classification, domainservice.ErrImageGeneratorUnavailable):
		detail = observability.ErrorDetailImageProviderUnavailable
	case errors.Is(classification, domainservice.ErrImageGenerationRejected):
		detail = observability.ErrorDetailImageGenerationRejected
	}
	return observability.WithErrorDetail(detail, failure)
}

func invalidImageOutput(reason string) error {
	return observability.WithErrorDetail(
		observability.ErrorDetailGeneratedImageInvalid,
		fmt.Errorf("%w: %s", domainservice.ErrGeneratedImageInvalid, reason),
	)
}

func withImageOperation(err error) error {
	return observability.WithOperation(openRouterImageOperation, err)
}

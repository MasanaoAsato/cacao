package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/png"
	"net"
	"net/http"
	"strings"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/observability"
	imageprompt "cacao/src/infrastructure/service/prompt"

	openrouter "github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/models/operations"
	"github.com/OpenRouterTeam/go-sdk/retry"
)

const openRouterImageOperation = "openrouter_generate_image"

// OpenRouterImageConfig は OpenRouter 画像生成器の設定を表す。
type OpenRouterImageConfig struct {
	APIKey            string
	Model             string
	RequestTimeout    time.Duration
	GenerationTimeout time.Duration
	MaxBytes          int64
	MaxWidth          int
	MaxHeight         int
	MaxPixels         int64
}

type openRouterImageClient interface {
	Generate(
		ctx context.Context,
		request components.ImageGenerationRequest,
		opts ...operations.Option,
	) (*operations.CreateImagesResponse, error)
}

// OpenRouterImageGenerator は OpenRouter の画像生成 API を ImageGenerator に適合させる。
type OpenRouterImageGenerator struct {
	client openRouterImageClient
	config OpenRouterImageConfig
}

var _ domainservice.ImageGenerator = (*OpenRouterImageGenerator)(nil)

// NewOpenRouterImageGenerator は OpenRouter 画像生成器を生成する。
func NewOpenRouterImageGenerator(config OpenRouterImageConfig) (*OpenRouterImageGenerator, error) {
	if err := config.validate(); err != nil {
		return nil, fmt.Errorf("invalid openrouter image config: %w", err)
	}

	timeout := config.timeout()
	config.RequestTimeout = timeout
	config.GenerationTimeout = timeout
	httpClient := &http.Client{Timeout: timeout}
	retryConfig := retry.Config{Strategy: "none"}
	client := openrouter.New(
		openrouter.WithServer(openrouter.ServerProduction),
		openrouter.WithSecurity(strings.TrimSpace(config.APIKey)),
		openrouter.WithClient(httpClient),
		openrouter.WithTimeout(timeout),
		openrouter.WithRetryConfig(retryConfig),
	).Images

	return newOpenRouterImageGenerator(client, config), nil
}

// NewImageGeneratorOpenRouter は NewOpenRouterImageGenerator の別名である。
func NewImageGeneratorOpenRouter(config OpenRouterImageConfig) (*OpenRouterImageGenerator, error) {
	return NewOpenRouterImageGenerator(config)
}

func newOpenRouterImageGenerator(
	client openRouterImageClient,
	config OpenRouterImageConfig,
) *OpenRouterImageGenerator {
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.Model = strings.TrimSpace(config.Model)
	timeout := config.timeout()
	config.RequestTimeout = timeout
	config.GenerationTimeout = timeout
	return &OpenRouterImageGenerator{client: client, config: config}
}

func (c OpenRouterImageConfig) timeout() time.Duration {
	if c.GenerationTimeout > 0 {
		return c.GenerationTimeout
	}

	return c.RequestTimeout
}

func (c OpenRouterImageConfig) validate() error {
	if strings.TrimSpace(c.APIKey) == "" {
		return errors.New("openrouter api key must not be empty")
	}
	if strings.TrimSpace(c.Model) == "" {
		return errors.New("openrouter image model must not be empty")
	}
	if strings.HasPrefix(strings.TrimSpace(c.Model), "~") {
		return errors.New("openrouter image model must be a model id without leading '~'")
	}
	model := strings.TrimSpace(c.Model)
	if strings.HasPrefix(model, "http://") || strings.HasPrefix(model, "https://") {
		return errors.New("openrouter image model must be a model id, not a url")
	}
	if c.timeout() <= 0 {
		return errors.New("openrouter image request timeout must be greater than zero")
	}
	if c.MaxBytes < 1 {
		return errors.New("openrouter image maximum bytes must be positive")
	}
	if c.MaxWidth < 1 {
		return errors.New("openrouter image maximum width must be positive")
	}
	if c.MaxHeight < 1 {
		return errors.New("openrouter image maximum height must be positive")
	}
	if c.MaxPixels < 1 {
		return errors.New("openrouter image maximum pixels must be positive")
	}

	return nil
}

// Generate は画像ブリーフを OpenRouter へ送り、検証済み PNG を返す。
func (g *OpenRouterImageGenerator) Generate(
	ctx context.Context,
	brief domainservice.ImageBrief,
) (domainservice.GeneratedImage, error) {
	if g == nil {
		return domainservice.GeneratedImage{}, errors.New("openrouter image generator must not be nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return domainservice.GeneratedImage{}, err
	}
	if err := g.config.validate(); err != nil {
		return domainservice.GeneratedImage{}, fmt.Errorf("openrouter image config: %w", err)
	}
	if g.client == nil {
		return domainservice.GeneratedImage{}, errors.New("openrouter image client must not be nil")
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

	timeout := g.config.timeout()
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	response, err := g.client.Generate(
		requestContext,
		request,
		operations.WithRetries(retry.Config{Strategy: "none"}),
		operations.WithOperationTimeout(timeout),
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

	generatedImage, err := decodeOpenRouterImage(response, g.config)
	if err != nil {
		return domainservice.GeneratedImage{}, withImageOperation(err)
	}

	return generatedImage, nil
}

func (g *OpenRouterImageGenerator) buildRequest(
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
	config OpenRouterImageConfig,
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
	if decodedLength > config.MaxBytes {
		return domainservice.GeneratedImage{}, invalidImageOutput("decoded image exceeds maximum bytes")
	}
	content, err := base64.StdEncoding.Strict().DecodeString(data.B64JSON)
	if err != nil {
		return domainservice.GeneratedImage{}, invalidImageOutput("decode image data")
	}
	if len(content) == 0 {
		return domainservice.GeneratedImage{}, invalidImageOutput("decoded image is empty")
	}
	if int64(len(content)) > config.MaxBytes {
		return domainservice.GeneratedImage{}, invalidImageOutput("image exceeds maximum bytes")
	}
	if http.DetectContentType(content) != "image/png" {
		return domainservice.GeneratedImage{}, invalidImageOutput("image content is not png")
	}

	imageConfig, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil {
		return domainservice.GeneratedImage{}, invalidImageOutput("decode image header")
	}
	if imageConfig.Width < 1 || imageConfig.Height < 1 {
		return domainservice.GeneratedImage{}, invalidImageOutput("image dimensions must be positive")
	}
	if imageConfig.Width > config.MaxWidth {
		return domainservice.GeneratedImage{}, invalidImageOutput("image width exceeds maximum")
	}
	if imageConfig.Height > config.MaxHeight {
		return domainservice.GeneratedImage{}, invalidImageOutput("image height exceeds maximum")
	}
	if int64(imageConfig.Width) > config.MaxPixels/int64(imageConfig.Height) {
		return domainservice.GeneratedImage{}, invalidImageOutput("image pixels exceed maximum")
	}
	decoded, format, err := image.Decode(bytes.NewReader(content))
	if err != nil || format != "png" ||
		decoded.Bounds().Dx() != imageConfig.Width ||
		decoded.Bounds().Dy() != imageConfig.Height {
		return domainservice.GeneratedImage{}, invalidImageOutput("decode image")
	}

	return domainservice.GeneratedImage{
		Content:   content,
		MediaType: "image/png",
		Width:     imageConfig.Width,
		Height:    imageConfig.Height,
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
	if errors.Is(requestContext.Err(), context.DeadlineExceeded) ||
		errors.Is(err, context.DeadlineExceeded) ||
		isTimeoutNetworkError(err) {
		return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorTimeout, err))
	}

	if status, ok := openRouterStatusCode(err); ok {
		switch {
		case status == http.StatusRequestTimeout || status == 524:
			return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorTimeout, err))
		case status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
			return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorUnavailable, err))
		case status >= http.StatusBadRequest && status < http.StatusInternalServerError:
			return withImageOperation(wrapImageFailure(domainservice.ErrImageGenerationRejected, err))
		}
	}

	return withImageOperation(wrapImageFailure(domainservice.ErrImageGeneratorUnavailable, err))
}

func isTimeoutNetworkError(err error) bool {
	var networkError net.Error
	return errors.As(err, &networkError) && networkError.Timeout()
}

func openRouterStatusCode(err error) (int, bool) {
	status, _, ok := observability.ProviderErrorDetails(err)
	return status, ok
}

type imageFailureError struct {
	classification error
	cause          error
}

func (e *imageFailureError) Error() string {
	return e.classification.Error()
}

func (e *imageFailureError) Unwrap() []error {
	if e.cause == nil {
		return []error{e.classification}
	}
	return []error{e.classification, e.cause}
}

func wrapImageFailure(classification, cause error) error {
	if classification == nil {
		return cause
	}
	failure := &imageFailureError{
		classification: classification,
		cause:          cause,
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

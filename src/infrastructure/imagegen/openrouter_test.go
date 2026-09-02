package imagegen

import (
	"bytes"
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/imagecontent"
	"cacao/src/infrastructure/openrouterclient"
	"context"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/png"
	"net"
	"testing"
	"testing/synctest"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/observability"

	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/models/operations"
	"github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
)

type fakeOpenRouterImageClient struct {
	request  components.ImageGenerationRequest
	calls    int
	generate func(context.Context, components.ImageGenerationRequest) (*operations.CreateImagesResponse, error)
}

func (f *fakeOpenRouterImageClient) Generate(
	ctx context.Context,
	request components.ImageGenerationRequest,
	_ ...operations.Option,
) (*operations.CreateImagesResponse, error) {
	f.calls++
	f.request = request
	return f.generate(ctx, request)
}

func TestOpenRouterImageGeneratorGenerate(t *testing.T) {
	t.Parallel()
	pngContent := testPNGContent(t, 2, 3)
	cases := []struct {
		name    string
		purpose value_object.ImagePurpose
		style   value_object.ImageVisualStyle
		aspect  components.ImageGenerationRequestAspectRatio
		brief   func(*testing.T) domainservice.ImageBrief
	}{
		{
			name:    "cover",
			purpose: value_object.ImagePurposeCover,
			style:   value_object.ImageVisualStyleEditorialPhotograph,
			aspect:  components.ImageGenerationRequestAspectRatioTwentyThree,
			brief:   newOpenRouterImageTestBrief,
		},
		{
			name:    "illustration",
			purpose: value_object.ImagePurposeIllustration,
			style:   value_object.ImageVisualStyleNone,
			aspect:  components.ImageGenerationRequestAspectRatioFortyThree,
			brief:   newOpenRouterIllustrationTestBrief,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			client := &fakeOpenRouterImageClient{
				generate: func(context.Context, components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
					return imageResponse(pngContent, "image/png"), nil
				},
			}
			generator := newOpenRouterGenerator(client, validOpenRouterConfig())

			got, err := generator.Generate(context.Background(), testCase.brief(t))
			if err != nil {
				t.Fatalf("Generate() error = %v", err)
			}
			if client.calls != 1 {
				t.Fatalf("Generate() calls = %d, want 1", client.calls)
			}
			if !bytes.Equal(got.Content, pngContent) {
				t.Fatal("Generate() content differs from provider response")
			}
			if got.MediaType != "image/png" || got.Width != 2 || got.Height != 3 {
				t.Fatalf("Generate() image metadata = %+v", got)
			}

			request := client.request
			if request.Model != "test/image-model" {
				t.Errorf("request model = %q, want test/image-model", request.Model)
			}
			if request.N == nil || *request.N != 1 {
				t.Errorf("request n = %v, want 1", request.N)
			}
			if request.OutputFormat == nil || *request.OutputFormat != components.ImageGenerationRequestOutputFormatPng {
				t.Errorf("request output format = %v, want png", request.OutputFormat)
			}
			if request.Stream == nil || *request.Stream {
				t.Errorf("request stream = %v, want false", request.Stream)
			}
			if request.AspectRatio == nil || *request.AspectRatio != testCase.aspect {
				t.Errorf("request aspect ratio = %v, want %s", request.AspectRatio, testCase.aspect)
			}
			if request.InputReferences != nil || request.Provider != nil || request.Resolution != nil ||
				request.User != nil || request.Seed != nil || request.Size != nil {
				t.Errorf("request contains unsupported optional fields: %+v", request)
			}
			if !bytes.Contains([]byte(request.Prompt), []byte("Avoid all of the following:")) {
				t.Errorf("request prompt does not contain negative prompt: %q", request.Prompt)
			}
		})
	}
}

func TestOpenRouterImageGeneratorMapsProviderErrors(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		status   int
		want     error
		wantBody string
	}{
		{name: "request timeout", status: 408, want: domainservice.ErrImageGeneratorTimeout},
		{name: "edge timeout", status: 524, want: domainservice.ErrImageGeneratorTimeout},
		{name: "rate limited", status: 429, want: domainservice.ErrImageGeneratorUnavailable},
		{name: "provider server error", status: 500, want: domainservice.ErrImageGeneratorUnavailable},
		{name: "provider rejected", status: 400, want: domainservice.ErrImageGenerationRejected},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			client := &fakeOpenRouterImageClient{
				generate: func(context.Context, components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
					return nil, sdkerrors.NewAPIError("provider failure", testCase.status, "sensitive provider body", nil)
				},
			}
			generator := newOpenRouterGenerator(client, validOpenRouterConfig())
			_, err := generator.Generate(context.Background(), newOpenRouterImageTestBrief(t))
			if !errors.Is(err, testCase.want) {
				t.Fatalf("Generate() error = %v, want errors.Is(..., %v)", err, testCase.want)
			}
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				t.Fatalf("provider error unexpectedly exposes context cancellation: %v", err)
			}
			if bytes.Contains([]byte(err.Error()), []byte("sensitive provider body")) {
				t.Fatal("provider response body leaked in error string")
			}
			var apiError *sdkerrors.APIError
			if !errors.As(err, &apiError) || apiError.StatusCode != testCase.status {
				t.Fatalf("Generate() API error = %#v, want status %d", apiError, testCase.status)
			}
			if got := observability.SourceOperation(err); got != openRouterImageOperation {
				t.Errorf("SourceOperation() = %q, want %q", got, openRouterImageOperation)
			}
		})
	}
}

func TestOpenRouterImageGeneratorMapsTypedForbiddenError(t *testing.T) {
	t.Parallel()

	client := &fakeOpenRouterImageClient{
		generate: func(context.Context, components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
			return nil, &sdkerrors.ForbiddenResponseError{}
		},
	}
	generator := newOpenRouterGenerator(client, validOpenRouterConfig())

	_, err := generator.Generate(context.Background(), newOpenRouterImageTestBrief(t))
	if !errors.Is(err, domainservice.ErrImageGenerationRejected) {
		t.Fatalf("Generate() error = %v, want image generation rejected", err)
	}
	if errors.Is(err, domainservice.ErrImageGeneratorUnavailable) {
		t.Fatalf("Generate() error = %v, must not be provider unavailable", err)
	}
	var requestError *openrouterclient.RequestError
	if !errors.As(err, &requestError) || requestError.ProviderStatusCode() != 403 {
		t.Fatalf("ProviderStatusCode() = %v, want 403", requestError)
	}
	if got := observability.ErrorDetail(err); got != string(observability.ErrorDetailImageGenerationRejected) {
		t.Fatalf("ErrorDetail() = %q, want %q", got, observability.ErrorDetailImageGenerationRejected)
	}
}

func TestOpenRouterImageGeneratorMapsTransportErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		cause error
		want  error
	}{
		{
			name:  "network timeout",
			cause: timeoutNetworkError{},
			want:  domainservice.ErrImageGeneratorTimeout,
		},
		{
			name:  "network unavailable",
			cause: errors.New("dial provider: connection refused"),
			want:  domainservice.ErrImageGeneratorUnavailable,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			client := &fakeOpenRouterImageClient{
				generate: func(context.Context, components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
					return nil, testCase.cause
				},
			}
			generator := newOpenRouterGenerator(client, validOpenRouterConfig())

			_, err := generator.Generate(context.Background(), newOpenRouterImageTestBrief(t))

			if !errors.Is(err, testCase.want) {
				t.Fatalf("Generate() error = %v, want errors.Is(..., %v)", err, testCase.want)
			}
		})
	}
}

func TestOpenRouterImageGeneratorMapsRequestTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := &fakeOpenRouterImageClient{
			generate: func(ctx context.Context, _ components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
				<-ctx.Done()
				return nil, ctx.Err()
			},
		}
		config := validOpenRouterConfig()
		config.Timeout = time.Second
		generator := newOpenRouterGenerator(client, config)

		_, err := generator.Generate(context.Background(), newOpenRouterImageTestBrief(t))

		if !errors.Is(err, domainservice.ErrImageGeneratorTimeout) {
			t.Fatalf("Generate() error = %v, want image generator timeout", err)
		}
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("Generate() error = %v, want context.DeadlineExceeded", err)
		}
	})
}

func TestOpenRouterImageGeneratorPreservesParentCancellation(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())
	client := &fakeOpenRouterImageClient{
		generate: func(ctx context.Context, _ components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		},
	}
	generator := newOpenRouterGenerator(client, validOpenRouterConfig())
	result := make(chan error, 1)
	go func() {
		_, err := generator.Generate(ctx, newOpenRouterImageTestBrief(t))
		result <- err
	}()
	cancel()
	err := <-result
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Generate() error = %v, want context.Canceled", err)
	}
	if errors.Is(err, domainservice.ErrImageGeneratorUnavailable) {
		t.Fatal("parent cancellation was classified as provider unavailable")
	}
}

func TestOpenRouterImageGeneratorRejectsInvalidOutputs(t *testing.T) {
	t.Parallel()
	validContent := testPNGContent(t, 2, 3)
	cases := []struct {
		name     string
		response *operations.CreateImagesResponse
		config   OpenRouterConfig
	}{
		{name: "nil response"},
		{
			name: "stream response",
			response: &operations.CreateImagesResponse{
				Type: operations.CreateImagesResponseTypeEventStream,
			},
		},
		{
			name:     "missing data",
			response: imageResponseWithData(),
		},
		{
			name: "multiple images",
			response: imageResponseWithData(
				components.ImageGenerationResponseData{B64JSON: base64.StdEncoding.EncodeToString(validContent)},
				components.ImageGenerationResponseData{B64JSON: base64.StdEncoding.EncodeToString(validContent)},
			),
		},
		{
			name:     "wrong media type",
			response: imageResponse(validContent, "image/jpeg"),
		},
		{
			name:     "invalid base64",
			response: imageResponseWithData(components.ImageGenerationResponseData{B64JSON: "not base64"}),
		},
		{
			name: "invalid png",
			response: imageResponseWithData(components.ImageGenerationResponseData{
				B64JSON: base64.StdEncoding.EncodeToString([]byte("not png")),
			}),
		},
		{
			name:     "maximum bytes",
			response: imageResponse(validContent, "image/png"),
			config: func() OpenRouterConfig {
				config := validOpenRouterConfig()
				config.Limits.MaxBytes = int64(len(validContent) - 1)
				return config
			}(),
		},
		{
			name:     "maximum width",
			response: imageResponse(validContent, "image/png"),
			config: func() OpenRouterConfig {
				config := validOpenRouterConfig()
				config.Limits.MaxWidth = 1
				return config
			}(),
		},
		{
			name:     "maximum height",
			response: imageResponse(validContent, "image/png"),
			config: func() OpenRouterConfig {
				config := validOpenRouterConfig()
				config.Limits.MaxHeight = 2
				return config
			}(),
		},
		{
			name:     "maximum pixels",
			response: imageResponse(validContent, "image/png"),
			config: func() OpenRouterConfig {
				config := validOpenRouterConfig()
				config.Limits.MaxPixels = 5
				return config
			}(),
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			config := testCase.config
			if config.APIKey == "" {
				config = validOpenRouterConfig()
			}
			client := &fakeOpenRouterImageClient{
				generate: func(context.Context, components.ImageGenerationRequest) (*operations.CreateImagesResponse, error) {
					return testCase.response, nil
				},
			}
			generator := newOpenRouterGenerator(client, config)
			_, err := generator.Generate(context.Background(), newOpenRouterImageTestBrief(t))
			if !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
				t.Fatalf("Generate() error = %v, want generated image invalid", err)
			}
		})
	}
}

func TestOpenRouterConfigValidate(t *testing.T) {
	t.Parallel()
	mutate := func(fn func(*OpenRouterConfig)) OpenRouterConfig {
		config := validOpenRouterConfig()
		fn(&config)
		return config
	}
	cases := []struct {
		name   string
		config OpenRouterConfig
	}{
		{name: "missing api key", config: mutate(func(c *OpenRouterConfig) { c.APIKey = "" })},
		{name: "missing model", config: mutate(func(c *OpenRouterConfig) { c.Model = "" })},
		{name: "model url", config: mutate(func(c *OpenRouterConfig) { c.Model = "https://example.invalid/model" })},
		{name: "zero timeout", config: mutate(func(c *OpenRouterConfig) { c.Timeout = 0 })},
		{name: "zero bytes", config: mutate(func(c *OpenRouterConfig) { c.Limits.MaxBytes = 0 })},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if err := testCase.config.Validate(); err == nil {
				t.Fatal("Validate() error = nil, want error")
			}
			if _, err := NewOpenRouterGenerator(testCase.config); err == nil {
				t.Fatal("NewOpenRouterGenerator() error = nil, want error")
			}
		})
	}
	if _, err := NewOpenRouterGenerator(validOpenRouterConfig()); err != nil {
		t.Fatalf("NewOpenRouterGenerator(valid) error = %v", err)
	}
}

func validOpenRouterConfig() OpenRouterConfig {
	return OpenRouterConfig{
		OpenRouterImage: config.OpenRouterImage{APIKey: "test-key", Model: "test/image-model"},
		Timeout:         time.Second,
		Limits:          imagecontent.Limits{MaxBytes: 1 << 20, MaxWidth: 100, MaxHeight: 100, MaxPixels: 10_000},
	}
}

func imageResponse(content []byte, mediaType string) *operations.CreateImagesResponse {
	data := components.ImageGenerationResponseData{B64JSON: base64.StdEncoding.EncodeToString(content)}
	if mediaType != "" {
		data.MediaType = &mediaType
	}
	return imageResponseWithData(data)
}

func imageResponseWithData(data ...components.ImageGenerationResponseData) *operations.CreateImagesResponse {
	returnImageResponse := components.ImageGenerationResponse{Data: data}
	response := operations.CreateCreateImagesResponseImageGenerationResponse(returnImageResponse)
	return &response
}

func testPNGContent(t *testing.T, width, height int) []byte {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			canvas.Set(x, y, color.RGBA{R: uint8(x + 1), G: uint8(y + 1), B: 1, A: 255})
		}
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, canvas); err != nil {
		t.Fatalf("png.Encode() error = %v", err)
	}
	return buffer.Bytes()
}

func newOpenRouterImageTestBrief(t *testing.T) domainservice.ImageBrief {
	return newOpenRouterBrief(t, value_object.ImagePurposeCover, value_object.ImageVisualStyleEditorialPhotograph)
}

func newOpenRouterIllustrationTestBrief(t *testing.T) domainservice.ImageBrief {
	return newOpenRouterBrief(t, value_object.ImagePurposeIllustration, value_object.ImageVisualStyleNone)
}

func newOpenRouterBrief(
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

type timeoutNetworkError struct{}

func (timeoutNetworkError) Error() string   { return "network timeout" }
func (timeoutNetworkError) Timeout() bool   { return true }
func (timeoutNetworkError) Temporary() bool { return true }

var _ net.Error = timeoutNetworkError{}

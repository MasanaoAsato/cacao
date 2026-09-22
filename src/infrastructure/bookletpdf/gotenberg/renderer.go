package gotenberg

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"

	domainservice "cacao/src/domain/service"
	"cacao/src/infrastructure/config"
)

const bookletReadyExpression = `(() => {
  const shell = document.querySelector(".booklet-shell");
  const state = shell?.dataset.bookletPrintState ?? "";
  if (state === "error") {
    throw new Error("booklet page reported an error");
  }
  if (state !== "ready") {
    return false;
  }
  return Array.from(document.querySelectorAll(".booklet-document img"))
    .every((image) => image.complete && image.naturalWidth > 0);
})()`

// Renderer はしおり画面をGotenbergのChromium APIでPDF化する。
type Renderer struct {
	config   config.Booklet
	client   *http.Client
	renderFn func(context.Context, domainservice.BookletRenderRequest) (
		domainservice.RenderedBooklet,
		error,
	)
	slots chan struct{}
}

// NewRenderer はGotenbergによるしおりPDFレンダラーを生成する。
func NewRenderer(bookletConfig config.Booklet) *Renderer {
	renderer := &Renderer{
		config: bookletConfig,
		client: &http.Client{
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		slots: make(chan struct{}, bookletConfig.PDFConcurrency),
	}
	renderer.renderFn = renderer.render

	return renderer
}

var _ domainservice.BookletRenderer = (*Renderer)(nil)

// Render は空きがある場合だけGotenbergへ変換を要求する。
func (r *Renderer) Render(
	ctx context.Context,
	request domainservice.BookletRenderRequest,
) (domainservice.RenderedBooklet, error) {
	if !r.tryAcquire() {
		return domainservice.RenderedBooklet{}, domainservice.ErrBookletRendererBusy
	}
	defer func() { <-r.slots }()

	rendered, err := r.renderFn(ctx, request)
	if err != nil {
		return domainservice.RenderedBooklet{}, err
	}

	return rendered, nil
}

func (r *Renderer) tryAcquire() bool {
	select {
	case r.slots <- struct{}{}:
		return true
	default:
		return false
	}
}

func (r *Renderer) render(
	ctx context.Context,
	request domainservice.BookletRenderRequest,
) (domainservice.RenderedBooklet, error) {
	renderURL, err := r.bookletURL(request)
	if err != nil {
		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: build booklet URL: %w",
			domainservice.ErrBookletRenderFailed,
			newSafeGotenbergError("build gotenberg render URL failed", err),
		)
	}

	renderContext, cancel := context.WithTimeout(ctx, r.config.PDFTimeout)
	defer cancel()

	httpRequest, err := r.newConversionRequest(renderContext, renderURL)
	if err != nil {
		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: build Gotenberg request: %w",
			domainservice.ErrBookletRenderFailed,
			newSafeGotenbergError("build gotenberg request failed", err),
		)
	}

	response, err := r.client.Do(httpRequest)
	if err != nil {
		return domainservice.RenderedBooklet{}, r.classifyRequestError(renderContext, err)
	}
	defer func() {
		_ = response.Body.Close()
	}()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		if response.StatusCode == http.StatusGatewayTimeout {
			return domainservice.RenderedBooklet{}, fmt.Errorf(
				"%w: %w",
				domainservice.ErrBookletRenderTimeout,
				newSafeGotenbergError("gotenberg returned HTTP 504", nil),
			)
		}

		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: %w",
			domainservice.ErrBookletRenderFailed,
			newSafeGotenbergError(fmt.Sprintf("gotenberg returned HTTP %d", response.StatusCode), nil),
		)
	}
	if err := validatePDFMediaType(response.Header.Get("Content-Type")); err != nil {
		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: %w",
			domainservice.ErrBookletRenderFailed,
			newSafeGotenbergError("gotenberg returned invalid PDF content type", err),
		)
	}

	content, err := io.ReadAll(io.LimitReader(response.Body, r.config.PDFMaxBytes+1))
	if err != nil {
		return domainservice.RenderedBooklet{}, r.classifyRequestError(renderContext, err)
	}

	rendered := domainservice.RenderedBooklet{
		Content:   content,
		MediaType: domainservice.BookletPDFMediaType,
	}
	if err := domainservice.ValidateRenderedBooklet(rendered, r.config.PDFMaxBytes); err != nil {
		return domainservice.RenderedBooklet{}, err
	}

	return rendered, nil
}

func (r *Renderer) newConversionRequest(
	ctx context.Context,
	renderURL string,
) (*http.Request, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fields := []struct {
		name  string
		value string
	}{
		{name: "url", value: renderURL},
		{name: "printBackground", value: "true"},
		{name: "preferCssPageSize", value: "true"},
		{name: "emulatedMediaType", value: "print"},
		{name: "waitForExpression", value: bookletReadyExpression},
	}
	for _, field := range fields {
		if err := writer.WriteField(field.name, field.value); err != nil {
			return nil, fmt.Errorf("write multipart field %s: %w", field.name, err)
		}
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart body: %w", err)
	}

	endpoint, err := url.JoinPath(
		r.config.GotenbergURL,
		"forms",
		"chromium",
		"convert",
		"url",
	)
	if err != nil {
		return nil, fmt.Errorf("join Gotenberg URL: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return nil, fmt.Errorf("create Gotenberg request: %w", err)
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())

	return request, nil
}

func (r *Renderer) classifyRequestError(ctx context.Context, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) ||
		errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf(
			"%w: %w",
			domainservice.ErrBookletRenderTimeout,
			newSafeGotenbergError("gotenberg request timed out", err),
		)
	}

	return fmt.Errorf(
		"%w: %w",
		domainservice.ErrBookletRenderFailed,
		newSafeGotenbergError("gotenberg request failed", err),
	)
}

type safeGotenbergError struct {
	message string
	cause   error
}

func newSafeGotenbergError(message string, cause error) *safeGotenbergError {
	return &safeGotenbergError{message: message, cause: cause}
}

func (e *safeGotenbergError) Error() string {
	return e.message
}

func (e *safeGotenbergError) Unwrap() error {
	return e.cause
}

func (e *safeGotenbergError) SafeLogMessage() string {
	return e.message
}

func (r *Renderer) bookletURL(
	request domainservice.BookletRenderRequest,
) (string, error) {
	renderURL, err := url.JoinPath(
		r.config.RenderBaseURL,
		"journeys",
		request.JourneyID().String(),
		"booklet",
	)
	if err != nil {
		return "", fmt.Errorf("join booklet URL path: %w", err)
	}

	parsedURL, err := url.Parse(renderURL)
	if err != nil {
		return "", fmt.Errorf("parse booklet URL: %w", err)
	}
	if seed, ok := request.ThemeSeed(); ok {
		query := parsedURL.Query()
		query.Set("seed", seed.String())
		parsedURL.RawQuery = query.Encode()
	}

	return parsedURL.String(), nil
}

func validatePDFMediaType(value string) error {
	mediaType, _, err := mime.ParseMediaType(value)
	if err != nil {
		return fmt.Errorf("parse Gotenberg Content-Type: %w", err)
	}
	if mediaType != domainservice.BookletPDFMediaType {
		return fmt.Errorf("gotenberg Content-Type is %q, want application/pdf", mediaType)
	}

	return nil
}

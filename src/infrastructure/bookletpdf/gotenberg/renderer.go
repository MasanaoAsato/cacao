package gotenberg

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"

	domainservice "cacao/src/domain/service"
	"cacao/src/infrastructure/config"
	"cacao/src/observability"
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
		err := domainservice.ErrBookletRendererBusy
		r.logFailure(ctx, request, slog.LevelWarn, err)

		return domainservice.RenderedBooklet{}, err
	}
	defer func() { <-r.slots }()

	rendered, err := r.renderFn(ctx, request)
	if err != nil {
		r.logFailure(ctx, request, slog.LevelError, err)

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
			"%w: build booklet URL: %v",
			domainservice.ErrBookletRenderFailed,
			err,
		)
	}

	renderContext, cancel := context.WithTimeout(ctx, r.config.PDFTimeout)
	defer cancel()

	httpRequest, err := r.newConversionRequest(renderContext, renderURL)
	if err != nil {
		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: build Gotenberg request: %v",
			domainservice.ErrBookletRenderFailed,
			err,
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
				"%w: Gotenberg returned HTTP %d",
				domainservice.ErrBookletRenderTimeout,
				response.StatusCode,
			)
		}

		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: Gotenberg returned HTTP %d",
			domainservice.ErrBookletRenderFailed,
			response.StatusCode,
		)
	}
	if err := validatePDFMediaType(response.Header.Get("Content-Type")); err != nil {
		return domainservice.RenderedBooklet{}, fmt.Errorf(
			"%w: %v",
			domainservice.ErrBookletRenderFailed,
			err,
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
		return fmt.Errorf("%w: %v", domainservice.ErrBookletRenderTimeout, err)
	}

	return fmt.Errorf("%w: Gotenberg request: %v", domainservice.ErrBookletRenderFailed, err)
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

func (r *Renderer) logFailure(
	ctx context.Context,
	request domainservice.BookletRenderRequest,
	level slog.Level,
	err error,
) {
	failureContext := observability.FailureContext{
		JourneyID: request.JourneyID().String(),
		Operation: "render_booklet_pdf",
	}
	if seed, ok := request.ThemeSeed(); ok {
		failureContext.ThemeSeed = seed.String()
	}
	observability.LogFailure(ctx, slog.Default(), level, failureContext, err)
}

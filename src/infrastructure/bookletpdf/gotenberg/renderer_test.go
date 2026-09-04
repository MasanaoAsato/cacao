package gotenberg

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/config"
)

const testPDF = "%PDF-1.4\n%%EOF\n"

func TestRendererRender(t *testing.T) {
	var receivedFields map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(
		writer http.ResponseWriter,
		request *http.Request,
	) {
		if request.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", request.Method)
		}
		if request.URL.Path != "/forms/chromium/convert/url" {
			t.Errorf("path = %q, want Gotenberg Chromium URL route", request.URL.Path)
		}
		if err := request.ParseMultipartForm(1 << 20); err != nil {
			t.Errorf("ParseMultipartForm() error = %v", err)
			http.Error(writer, "invalid form", http.StatusBadRequest)

			return
		}

		receivedFields = make(map[string]string)
		for _, name := range []string{
			"url",
			"printBackground",
			"preferCssPageSize",
			"emulatedMediaType",
			"waitForExpression",
		} {
			receivedFields[name] = request.FormValue(name)
		}

		writer.Header().Set("Content-Type", "application/pdf")
		_, _ = io.WriteString(writer, testPDF)
	}))
	defer server.Close()

	seed, err := value_object.NewThemeSeed("V1-ABCDEF12")
	if err != nil {
		t.Fatalf("NewThemeSeed() error = %v", err)
	}
	request, err := domainservice.NewBookletRenderRequest(value_object.NewID(), &seed)
	if err != nil {
		t.Fatalf("NewBookletRenderRequest() error = %v", err)
	}

	rendered, err := newTestRenderer(server.URL).Render(context.Background(), request)
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}
	if string(rendered.Content) != testPDF {
		t.Errorf("Render() content = %q, want test PDF", rendered.Content)
	}
	if rendered.MediaType != domainservice.BookletPDFMediaType {
		t.Errorf(
			"Render() MediaType = %q, want %q",
			rendered.MediaType,
			domainservice.BookletPDFMediaType,
		)
	}

	wantURL := "https://example.test/app/journeys/" +
		request.JourneyID().String() +
		"/booklet?seed=v1-abcdef12"
	if receivedFields["url"] != wantURL {
		t.Errorf("url field = %q, want %q", receivedFields["url"], wantURL)
	}
	for name, want := range map[string]string{
		"printBackground":   "true",
		"preferCssPageSize": "true",
		"emulatedMediaType": "print",
	} {
		if receivedFields[name] != want {
			t.Errorf("%s field = %q, want %q", name, receivedFields[name], want)
		}
	}
	if !strings.Contains(receivedFields["waitForExpression"], "bookletPrintState") {
		t.Error("waitForExpression does not inspect bookletPrintState")
	}
	if !strings.Contains(receivedFields["waitForExpression"], "state === \"error\"") {
		t.Error("waitForExpression does not fail on the page error state")
	}
	if !strings.Contains(receivedFields["waitForExpression"], "naturalWidth > 0") {
		t.Error("waitForExpression does not wait for booklet images")
	}
}

func TestRendererBookletURLOmitsSeedWhenNotSpecified(t *testing.T) {
	request := newTestRequest(t)
	renderer := newTestRenderer("http://127.0.0.1:3002")

	got, err := renderer.bookletURL(request)
	if err != nil {
		t.Fatalf("bookletURL() error = %v", err)
	}

	want := "https://example.test/app/journeys/" +
		request.JourneyID().String() +
		"/booklet"
	if got != want {
		t.Errorf("bookletURL() = %q, want %q", got, want)
	}
}

func TestRendererRejectsGotenbergFailureResponses(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		status      int
		body        string
		wantError   error
	}{
		{
			name:        "異常系: 非2xx",
			status:      http.StatusServiceUnavailable,
			contentType: "text/plain",
			body:        "conversion failed",
			wantError:   domainservice.ErrBookletRenderFailed,
		},
		{
			name:        "異常系: Gotenbergのタイムアウト",
			status:      http.StatusGatewayTimeout,
			contentType: "text/plain",
			body:        "conversion timed out",
			wantError:   domainservice.ErrBookletRenderTimeout,
		},
		{
			name:        "異常系: PDF以外",
			status:      http.StatusOK,
			contentType: "text/html",
			body:        "<html></html>",
			wantError:   domainservice.ErrBookletRenderFailed,
		},
		{
			name:        "境界値系: 最大サイズを1バイト超過",
			status:      http.StatusOK,
			contentType: "application/pdf",
			body:        testPDF + "x",
			wantError:   domainservice.ErrRenderedBookletInvalid,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(
				writer http.ResponseWriter,
				_ *http.Request,
			) {
				writer.Header().Set("Content-Type", testCase.contentType)
				writer.WriteHeader(testCase.status)
				_, _ = io.WriteString(writer, testCase.body)
			}))
			defer server.Close()

			renderer := newTestRenderer(server.URL)
			renderer.config.PDFMaxBytes = int64(len(testPDF))
			_, err := renderer.Render(context.Background(), newTestRequest(t))
			if !errors.Is(err, testCase.wantError) {
				t.Errorf("Render() error = %v, want %v", err, testCase.wantError)
			}
		})
	}
}

func TestRendererAcceptsPDFAtConfiguredMaximum(t *testing.T) {
	server := newPDFServer(testPDF)
	defer server.Close()

	renderer := newTestRenderer(server.URL)
	renderer.config.PDFMaxBytes = int64(len(testPDF))

	if _, err := renderer.Render(context.Background(), newTestRequest(t)); err != nil {
		t.Fatalf("Render() error = %v", err)
	}
}

func TestRendererTimesOutGotenbergRequest(t *testing.T) {
	requestStarted := make(chan struct{})
	releaseRequest := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(
		_ http.ResponseWriter,
		_ *http.Request,
	) {
		close(requestStarted)
		<-releaseRequest
	}))
	defer server.Close()

	renderer := newTestRenderer(server.URL)
	renderer.config.PDFTimeout = 20 * time.Millisecond

	_, err := renderer.Render(context.Background(), newTestRequest(t))
	close(releaseRequest)
	if !errors.Is(err, domainservice.ErrBookletRenderTimeout) {
		t.Errorf("Render() error = %v, want ErrBookletRenderTimeout", err)
	}

	select {
	case <-requestStarted:
	default:
		t.Fatal("Gotenberg request was not started")
	}
}

func TestRendererRejectsConcurrentRender(t *testing.T) {
	renderer := newTestRenderer("http://127.0.0.1:3002")
	started := make(chan struct{})
	release := make(chan struct{})
	renderer.renderFn = func(
		_ context.Context,
		_ domainservice.BookletRenderRequest,
	) (domainservice.RenderedBooklet, error) {
		close(started)
		<-release

		return domainservice.RenderedBooklet{
			Content:   []byte(testPDF),
			MediaType: domainservice.BookletPDFMediaType,
		}, nil
	}

	previousLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer slog.SetDefault(previousLogger)

	firstDone := make(chan error, 1)
	go func() {
		_, err := renderer.Render(context.Background(), newTestRequest(t))
		firstDone <- err
	}()
	<-started

	_, err := renderer.Render(context.Background(), newTestRequest(t))
	if !errors.Is(err, domainservice.ErrBookletRendererBusy) {
		t.Errorf("second Render() error = %v, want ErrBookletRendererBusy", err)
	}

	close(release)
	if err := <-firstDone; err != nil {
		t.Errorf("first Render() error = %v", err)
	}
}

func newTestRenderer(gotenbergURL string) *Renderer {
	return NewRenderer(config.Booklet{
		PDFDriver:      config.BookletPDFDriverGotenberg,
		RenderBaseURL:  "https://example.test/app",
		GotenbergURL:   gotenbergURL,
		PDFTimeout:     time.Second,
		PDFConcurrency: 1,
		PDFMaxBytes:    1 << 20,
	})
}

func newTestRequest(t *testing.T) domainservice.BookletRenderRequest {
	t.Helper()

	request, err := domainservice.NewBookletRenderRequest(value_object.NewID(), nil)
	if err != nil {
		t.Fatalf("NewBookletRenderRequest() error = %v", err)
	}

	return request
}

func newPDFServer(content string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(
		writer http.ResponseWriter,
		_ *http.Request,
	) {
		writer.Header().Set("Content-Type", "application/pdf")
		_, _ = io.WriteString(writer, content)
	}))
}

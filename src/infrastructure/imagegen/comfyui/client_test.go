package comfyui

import (
	"bytes"
	"cacao/src/infrastructure/imagecontent"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestClientSubmitWaitForOutputAndView(t *testing.T) {
	t.Parallel()

	content := testPNG(t)
	var historyCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/prompt":
			if request.Method != http.MethodPost {
				t.Errorf("prompt method = %s, want POST", request.Method)
			}
			var payload map[string]json.RawMessage
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				t.Errorf("decode prompt payload: %v", err)
			}
			if _, ok := payload["client_id"]; ok {
				t.Error("prompt payload unexpectedly contains client_id")
			}
			writer.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(writer, `{"prompt_id":"prompt-1"}`)
		case "/history/prompt-1":
			if historyCalls.Add(1) == 1 {
				_, _ = io.WriteString(writer, `{}`)
				return
			}
			writer.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(writer, `{"prompt-1":{"outputs":{"9":{"images":[{"filename":"旅程 image.png","subfolder":"nested folder","type":"output"}]}},"status":{"status_str":"success","completed":true}}}`)
		case "/view":
			query := request.URL.Query()
			if query.Get("filename") != "旅程 image.png" || query.Get("subfolder") != "nested folder" || query.Get("type") != "output" {
				t.Errorf("view query = %v", query)
			}
			writer.Header().Set("Content-Type", "application/octet-stream")
			_, _ = writer.Write(content)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	client, err := NewClient(server.URL, WithPollInterval(0))
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	promptID, err := client.Submit(context.Background(), []byte(`{"3":{}}`))
	if err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if promptID != "prompt-1" {
		t.Fatalf("Submit() prompt id = %q, want %q", promptID, "prompt-1")
	}
	output, err := client.WaitForOutput(context.Background(), promptID, "9")
	if err != nil {
		t.Fatalf("WaitForOutput() error = %v", err)
	}
	if output.Filename != "旅程 image.png" {
		t.Fatalf("output filename = %q", output.Filename)
	}
	image, err := client.View(context.Background(), output)
	if err != nil {
		t.Fatalf("View() error = %v", err)
	}
	if image.MediaType != "image/png" || image.Width != 2 || image.Height != 2 {
		t.Fatalf("image metadata = %+v", image)
	}
	if len(image.Content) != len(content) || historyCalls.Load() != 2 {
		t.Fatalf("image content/history calls = %d/%d, want %d/2", len(image.Content), historyCalls.Load(), len(content))
	}
}

func TestClientSubmitClassifiesHTTPAndJSONErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		statusCode int
		body       string
		kind       failureKind
	}{
		{name: "bad request", statusCode: http.StatusBadRequest, body: `{}`, kind: failureRejected},
		{name: "server error", statusCode: http.StatusBadGateway, body: `{}`, kind: failureUnavailable},
		{name: "malformed json", statusCode: http.StatusOK, body: `{`, kind: failureRejected},
		{name: "node errors", statusCode: http.StatusOK, body: `{"node_errors":{"3":{"errors":["bad"]}}}`, kind: failureRejected},
		{name: "missing prompt id", statusCode: http.StatusOK, body: `{}`, kind: failureRejected},
	}

	for _, testCase := range cases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.WriteHeader(testCase.statusCode)
				_, _ = io.WriteString(writer, testCase.body)
			}))
			defer server.Close()
			client, err := NewClient(server.URL)
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			_, err = client.Submit(context.Background(), []byte(`{"3":{}}`))
			if err == nil {
				t.Fatal("Submit() error = nil, want error")
			}
			var clientErr *clientError
			if !errors.As(err, &clientErr) || clientErr.kind != testCase.kind {
				t.Fatalf("Submit() error = %T %v, want kind %d", err, err, testCase.kind)
			}
		})
	}
}

func TestClientWaitForOutputRejectsExecutionAndMissingOutput(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		body string
	}{
		{
			name: "execution error status",
			body: `{"prompt-1":{"outputs":{},"status":{"status_str":"error","completed":true}}}`,
		},
		{
			name: "execution error message",
			body: `{"prompt-1":{"outputs":{},"status":{"status_str":"running","messages":[["execution_error",{}]]}}}`,
		},
		{
			name: "missing image",
			body: `{"prompt-1":{"outputs":{"9":{"images":[]}},"status":{"status_str":"success","completed":true}}}`,
		},
	}

	for _, testCase := range cases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(writer, testCase.body)
			}))
			defer server.Close()
			client, err := NewClient(server.URL, WithPollInterval(0))
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			_, err = client.WaitForOutput(context.Background(), "prompt-1", "9")
			if err == nil {
				t.Fatal("WaitForOutput() error = nil, want error")
			}
			var clientErr *clientError
			if !errors.As(err, &clientErr) || clientErr.kind != failureRejected {
				t.Fatalf("WaitForOutput() error = %T %v, want rejected", err, err)
			}
		})
	}
}

func TestClientViewImageSizeBoundary(t *testing.T) {
	t.Parallel()

	content := testPNG(t)
	for _, testCase := range []struct {
		name      string
		maxBytes  int64
		wantError bool
	}{
		{name: "exact limit", maxBytes: int64(len(content)), wantError: false},
		{name: "one byte over", maxBytes: int64(len(content) - 1), wantError: true},
	} {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				_, _ = writer.Write(content)
			}))
			defer server.Close()
			client, err := NewClient(server.URL, WithLimits(imagecontent.Limits{MaxBytes: testCase.maxBytes, MaxWidth: 4096, MaxHeight: 4096, MaxPixels: 1 << 24}))
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			_, err = client.View(context.Background(), OutputReference{Filename: "image.png", Type: "output"})
			if testCase.wantError && err == nil {
				t.Fatal("View() error = nil, want error")
			}
			if !testCase.wantError && err != nil {
				t.Fatalf("View() error = %v, want nil", err)
			}
		})
	}
}

func TestClientViewRejectsCorruptImageBinary(t *testing.T) {
	t.Parallel()

	content := testCorruptPNG(t)
	if _, _, err := image.DecodeConfig(bytes.NewReader(content)); err != nil {
		t.Fatalf("corrupt fixture header must decode: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write(content)
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	_, err = client.View(context.Background(), OutputReference{Filename: "image.png", Type: "output"})
	if err == nil {
		t.Fatal("View() error = nil, want error")
	}
	var clientErr *clientError
	if !errors.As(err, &clientErr) || clientErr.kind != failureInvalid {
		t.Fatalf("View() error = %T %v, want invalid image", err, err)
	}
}

func TestClientRedirectPolicyAndBaseURLValidation(t *testing.T) {
	t.Parallel()

	foreign := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_, _ = io.WriteString(writer, `{"prompt_id":"foreign"}`)
	}))
	defer foreign.Close()

	local := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/prompt" {
			http.Redirect(writer, request, "/prompt-final", http.StatusFound)
			return
		}
		if request.URL.Path == "/prompt-final" {
			_, _ = io.WriteString(writer, `{"prompt_id":"same-origin"}`)
			return
		}
		if request.URL.Path == "/foreign" {
			http.Redirect(writer, request, foreign.URL+"/prompt", http.StatusFound)
			return
		}
		http.NotFound(writer, request)
	}))
	defer local.Close()

	client, err := NewClient(local.URL)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	promptID, err := client.Submit(context.Background(), []byte(`{"3":{}}`))
	if err != nil || promptID != "same-origin" {
		t.Fatalf("same-origin redirect result = %q, %v", promptID, err)
	}

	foreignRedirectClient, err := NewClientWithHTTPClient(local.URL, &http.Client{
		Transport: redirectTransport{target: "/foreign"},
	})
	if err != nil {
		t.Fatalf("NewClientWithHTTPClient() error = %v", err)
	}
	_, err = foreignRedirectClient.Submit(context.Background(), []byte(`{"3":{}}`))
	if err == nil {
		t.Fatal("foreign redirect error = nil, want error")
	}

	for _, rawURL := range []string{
		"",
		"ftp://localhost:8188",
		"http://user@localhost:8188",
		"http://localhost:8188/path",
		"http://localhost:8188?secret=1",
		"http://localhost:8188/#fragment",
	} {
		if _, err := NewClient(rawURL); err == nil {
			t.Errorf("NewClient(%q) error = nil, want error", rawURL)
		}
	}
}

type redirectTransport struct {
	target string
}

func (t redirectTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	clone := request.Clone(request.Context())
	clone.URL.Path = t.target
	return http.DefaultTransport.RoundTrip(clone)
}

func testPNG(t *testing.T) []byte {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, 2, 2))
	canvas.Set(0, 0, color.RGBA{R: 255, A: 255})
	canvas.Set(1, 1, color.RGBA{B: 255, A: 255})
	var bytesBuffer bytes.Buffer
	if err := png.Encode(&bytesBuffer, canvas); err != nil {
		t.Fatalf("png.Encode() error = %v", err)
	}

	return bytesBuffer.Bytes()
}

func testCorruptPNG(t *testing.T) []byte {
	t.Helper()

	content := append([]byte(nil), testPNG(t)...)
	idatOffset := bytes.Index(content, []byte("IDAT"))
	if idatOffset < 0 || idatOffset+len("IDAT") >= len(content) {
		t.Fatal("test PNG does not contain an IDAT payload")
	}
	content[idatOffset+len("IDAT")] ^= 0xff

	return content
}

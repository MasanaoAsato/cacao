package comfyui

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

func TestGeneratorGenerate(t *testing.T) {
	t.Parallel()

	content := testPNG(t)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/prompt":
			_, _ = io.WriteString(writer, `{"prompt_id":"prompt-1"}`)
		case "/history/prompt-1":
			_, _ = io.WriteString(writer, `{"prompt-1":{"outputs":{"9":{"images":[{"filename":"result.png","type":"output"}]}},"status":{"status_str":"success","completed":true}}}`)
		case "/view":
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
	workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
	if err != nil {
		t.Fatalf("NewWorkflowFromBytes() error = %v", err)
	}
	generator, err := NewGeneratorWithClient(client, workflow)
	if err != nil {
		t.Fatalf("NewGeneratorWithClient() error = %v", err)
	}

	got, err := generator.Generate(context.Background(), newTestBrief(t, value_object.ImagePurposeCover, 1))
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if got.MediaType != "image/png" || got.Width != 2 || got.Height != 2 || len(got.Content) != len(content) {
		t.Fatalf("GeneratedImage = %+v", got)
	}
}

func TestGeneratorMapsProviderErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		handler    http.Handler
		want       error
		withCancel bool
	}{
		{
			name: "provider unavailable",
			handler: http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(http.StatusBadGateway)
			}),
			want: domainservice.ErrImageGeneratorUnavailable,
		},
		{
			name: "invalid generated image",
			handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				switch request.URL.Path {
				case "/prompt":
					_, _ = io.WriteString(writer, `{"prompt_id":"prompt-1"}`)
				case "/history/prompt-1":
					_, _ = io.WriteString(writer, `{"prompt-1":{"outputs":{"9":{"images":[{"filename":"result.png","type":"output"}]}},"status":{"status_str":"success","completed":true}}}`)
				case "/view":
					_, _ = io.WriteString(writer, "not an image")
				}
			}),
			want: domainservice.ErrGeneratedImageInvalid,
		},
		{
			name: "timeout",
			handler: http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				time.Sleep(100 * time.Millisecond)
			}),
			want:       domainservice.ErrImageGeneratorTimeout,
			withCancel: true,
		},
	}

	for _, testCase := range cases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(testCase.handler)
			defer server.Close()
			client, err := NewClient(server.URL, WithPollInterval(0))
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
			if err != nil {
				t.Fatalf("NewWorkflowFromBytes() error = %v", err)
			}
			generator, err := NewGeneratorWithClient(client, workflow)
			if err != nil {
				t.Fatalf("NewGeneratorWithClient() error = %v", err)
			}
			ctx := context.Background()
			if testCase.withCancel {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, 10*time.Millisecond)
				defer cancel()
			}
			_, err = generator.Generate(ctx, newTestBrief(t, value_object.ImagePurposeCover, 1))
			if err == nil || !errors.Is(err, testCase.want) {
				t.Fatalf("Generate() error = %v, want errors.Is(..., %v)", err, testCase.want)
			}
		})
	}
}

func TestGeneratorRejectsInvalidBrief(t *testing.T) {
	t.Parallel()

	client, err := NewClient("http://127.0.0.1:8188")
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	workflow, err := NewWorkflowFromBytes([]byte(testWorkflowJSON), []byte(testManifestJSON))
	if err != nil {
		t.Fatalf("NewWorkflowFromBytes() error = %v", err)
	}
	generator, err := NewGeneratorWithClient(client, workflow)
	if err != nil {
		t.Fatalf("NewGeneratorWithClient() error = %v", err)
	}

	_, err = generator.Generate(context.Background(), domainservice.ImageBrief{})
	if err == nil || !errors.Is(err, domainservice.ErrImageGenerationRejected) {
		t.Fatalf("Generate() error = %v, want generation rejected", err)
	}
}

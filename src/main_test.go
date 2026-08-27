package main

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"cacao/src/infrastructure/service"
)

func TestNewJourneyGeneratorOpenRouter(t *testing.T) {
	t.Setenv("LLM_DRIVER", "openrouter")
	t.Setenv("LLM_WEB_SEARCH", "true")
	t.Setenv("OPENROUTER_API_KEY", "test-openrouter-api-key")
	t.Setenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

	generator, err := newJourneyGenerator()
	if err != nil {
		t.Fatalf("newJourneyGenerator() error = %v", err)
	}
	if _, ok := generator.(*service.JourneyGeneratorOpenRouter); !ok {
		t.Fatalf("generator type = %T, want *service.JourneyGeneratorOpenRouter", generator)
	}
}

func TestNewJourneyGeneratorOpenRouterRejectsMissingConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		apiKey string
		model  string
		want   string
	}{
		{
			name:   "missing API key",
			apiKey: "",
			model:  "openai/gpt-4o-mini",
			want:   "api key",
		},
		{
			name:   "missing model",
			apiKey: "test-openrouter-api-key",
			model:  "",
			want:   "model",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("LLM_DRIVER", "openrouter")
			t.Setenv("OPENROUTER_API_KEY", tt.apiKey)
			t.Setenv("OPENROUTER_MODEL", tt.model)

			_, err := newJourneyGenerator()
			if err == nil {
				t.Fatal("newJourneyGenerator() error = nil, want error")
			}
			if !strings.Contains(err.Error(), tt.want) {
				t.Errorf("error = %q, want message containing %q", err, tt.want)
			}
		})
	}
}

func TestNewJourneyGeneratorKeepsExistingDrivers(t *testing.T) {
	t.Run("stub", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "stub")

		generator, err := newJourneyGenerator()
		if err != nil {
			t.Fatalf("newJourneyGenerator() error = %v", err)
		}
		if _, ok := generator.(*service.JourneyGeneratorStub); !ok {
			t.Fatalf("generator type = %T, want *service.JourneyGeneratorStub", generator)
		}
	})

	t.Run("unsupported driver", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "unsupported")

		_, err := newJourneyGenerator()
		if err == nil {
			t.Fatal("newJourneyGenerator() error = nil, want error")
		}
		if !strings.Contains(err.Error(), "unsupported LLM_DRIVER") {
			t.Errorf("error = %q, want unsupported driver error", err)
		}
	})
}

func TestNewImageGenerator(t *testing.T) {
	tests := []struct {
		name      string
		config    service.ImageConfig
		wantError bool
	}{
		{
			name:   "stub",
			config: service.ImageConfig{GeneratorDriver: "stub"},
		},
		{
			name: "comfyui",
			config: service.ImageConfig{
				GeneratorDriver:     "comfyui",
				ComfyUIBaseURL:      "http://127.0.0.1:8188",
				ComfyUIWorkflowPath: mainTestConfigPath(t, "journey_image_api.json"),
				ComfyUIManifestPath: mainTestConfigPath(t, "journey_image_manifest.json"),
			},
		},
		{
			name:      "unsupported driver",
			config:    service.ImageConfig{GeneratorDriver: "unknown"},
			wantError: true,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			generator, err := newImageGenerator(testCase.config)
			if (err != nil) != testCase.wantError {
				t.Fatalf("newImageGenerator() error = %v, wantError = %v", err, testCase.wantError)
			}
			if testCase.wantError {
				return
			}
			if generator == nil {
				t.Fatal("newImageGenerator() returned nil generator")
			}
		})
	}
}

func TestNewImageStorage(t *testing.T) {
	storage, err := newImageStorage(service.ImageConfig{
		Storage: service.ImageStorageConfig{
			Driver:    "filesystem",
			Root:      t.TempDir(),
			MaxBytes:  1,
			MaxWidth:  1,
			MaxHeight: 1,
			MaxPixels: 1,
		},
	})
	if err != nil {
		t.Fatalf("newImageStorage() error = %v", err)
	}
	if storage == nil {
		t.Fatal("newImageStorage() returned nil storage")
	}
	closeable, ok := storage.(interface{ Close() error })
	if !ok {
		t.Fatal("storage does not expose Close")
	}
	if err := closeable.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
}

func TestNewImageStorageRejectsUnsupportedDriver(t *testing.T) {
	_, err := newImageStorage(service.ImageConfig{
		Storage: service.ImageStorageConfig{Driver: "s3"},
	})
	if err == nil {
		t.Fatal("newImageStorage() error = nil, want error")
	}
}

func TestImageWorkerConfigUsesImageConfig(t *testing.T) {
	config := service.ImageConfig{
		GenerationTimeout:   2 * time.Second,
		WorkerConcurrency:   4,
		WorkerPollInterval:  100 * time.Millisecond,
		WorkerLeaseDuration: 3 * time.Second,
	}
	workerConfig := imageWorkerConfig(config)

	if workerConfig.GenerationTimeout != config.GenerationTimeout {
		t.Errorf("GenerationTimeout = %s, want %s", workerConfig.GenerationTimeout, config.GenerationTimeout)
	}
	if workerConfig.Concurrency != config.WorkerConcurrency {
		t.Errorf("Concurrency = %d, want %d", workerConfig.Concurrency, config.WorkerConcurrency)
	}
	if workerConfig.PollInterval != config.WorkerPollInterval {
		t.Errorf("PollInterval = %s, want %s", workerConfig.PollInterval, config.WorkerPollInterval)
	}
	if workerConfig.LeaseDuration != config.WorkerLeaseDuration {
		t.Errorf("LeaseDuration = %s, want %s", workerConfig.LeaseDuration, config.WorkerLeaseDuration)
	}
}

func TestLoadDotEnvIgnoresMissingFile(t *testing.T) {
	missingPath := filepath.Join(t.TempDir(), ".env")
	if err := loadDotEnvFile(missingPath); err != nil {
		t.Fatalf("loadDotEnv() error = %v", err)
	}
}

func TestWaitForWorkerWaitsAfterCancellation(t *testing.T) {
	workerResult := make(chan error, 1)
	releaseWorker := make(chan struct{})
	cancelled := make(chan struct{})
	waitResult := make(chan error, 1)

	go func() {
		<-releaseWorker
		workerResult <- nil
	}()
	go func() {
		waitResult <- waitForWorkerWithTimeout(
			workerResult,
			func() { close(cancelled) },
			time.Millisecond,
		)
	}()

	select {
	case <-cancelled:
	case <-time.After(time.Second):
		t.Fatal("worker cancellation was not requested")
	}
	select {
	case <-waitResult:
		t.Fatal("waitForWorkerWithTimeout returned before worker stopped")
	default:
	}

	close(releaseWorker)
	select {
	case err := <-waitResult:
		if err == nil {
			t.Fatal("waitForWorkerWithTimeout() error = nil, want timeout error")
		}
	case <-time.After(time.Second):
		t.Fatal("waitForWorkerWithTimeout did not return after worker stopped")
	}
}

func mainTestConfigPath(t *testing.T, fileName string) string {
	t.Helper()

	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller() failed")
	}

	return filepath.Join(filepath.Dir(sourceFile), "..", "config", "comfyui", fileName)
}

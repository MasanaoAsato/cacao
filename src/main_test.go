package main

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/journeygen"
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
	if _, ok := generator.(*journeygen.OpenRouterGenerator); !ok {
		t.Fatalf("generator type = %T, want *journeygen.OpenRouterGenerator", generator)
	}
}

func TestNewJourneyGeneratorOpenRouterRejectsMissingConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		apiKey string
		model  string
		want   string
	}{
		{name: "missing API key", apiKey: "", model: "openai/gpt-4o-mini", want: "api key"},
		{name: "missing model", apiKey: "test-openrouter-api-key", model: "", want: "model"},
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
		if _, ok := generator.(*journeygen.Stub); !ok {
			t.Fatalf("generator type = %T, want *journeygen.Stub", generator)
		}
	})

	t.Run("openai requires api key", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "openai")
		t.Setenv("OPENAI_API_KEY", "")

		if _, err := newJourneyGenerator(); err == nil {
			t.Fatal("newJourneyGenerator() error = nil, want error")
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
	limits := config.ImageLimits{MaxBytes: 1 << 20, MaxWidth: 1024, MaxHeight: 1024, MaxPixels: 1 << 20}
	tests := []struct {
		name      string
		config    config.Image
		wantError bool
	}{
		{
			name:   "stub",
			config: config.Image{GeneratorDriver: config.ImageGeneratorStub},
		},
		{
			name: "comfyui",
			config: config.Image{
				GeneratorDriver: config.ImageGeneratorComfyUI,
				ComfyUI: config.ComfyUI{
					BaseURL:      "http://127.0.0.1:8188",
					WorkflowPath: mainTestConfigPath(t, "journey_image_api.json"),
					ManifestPath: mainTestConfigPath(t, "journey_image_manifest.json"),
				},
				Storage: config.ImageStorage{Limits: limits},
			},
		},
		{
			name: "comfyui rejects invalid base URL at startup",
			config: config.Image{
				GeneratorDriver: config.ImageGeneratorComfyUI,
				ComfyUI: config.ComfyUI{
					BaseURL:      "http://user@localhost:8188",
					WorkflowPath: mainTestConfigPath(t, "journey_image_api.json"),
					ManifestPath: mainTestConfigPath(t, "journey_image_manifest.json"),
				},
				Storage: config.ImageStorage{Limits: limits},
			},
			wantError: true,
		},
		{
			name: "comfyui rejects unreadable workflow at startup",
			config: config.Image{
				GeneratorDriver: config.ImageGeneratorComfyUI,
				ComfyUI: config.ComfyUI{
					BaseURL:      "http://127.0.0.1:8188",
					WorkflowPath: filepath.Join(t.TempDir(), "missing.json"),
					ManifestPath: mainTestConfigPath(t, "journey_image_manifest.json"),
				},
				Storage: config.ImageStorage{Limits: limits},
			},
			wantError: true,
		},
		{
			name: "openrouter",
			config: config.Image{
				GeneratorDriver:   config.ImageGeneratorOpenRouter,
				OpenRouterImage:   config.OpenRouterImage{APIKey: "test-key", Model: "provider/image-model"},
				GenerationTimeout: time.Second,
				Storage:           config.ImageStorage{Limits: limits},
			},
		},
		{
			name:      "unsupported driver",
			config:    config.Image{GeneratorDriver: "unknown"},
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
	storage, err := newImageStorage(config.Image{
		Storage: config.ImageStorage{
			Driver: config.ImageStorageFilesystem,
			Root:   t.TempDir(),
			Limits: config.ImageLimits{MaxBytes: 1, MaxWidth: 1, MaxHeight: 1, MaxPixels: 1},
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
	_, err := newImageStorage(config.Image{
		Storage: config.ImageStorage{Driver: "s3"},
	})
	if err == nil {
		t.Fatal("newImageStorage() error = nil, want error")
	}
}

func TestNewWorkerConfigUsesImageConfig(t *testing.T) {
	imageConfig := config.Image{
		Worker: config.ImageWorker{Concurrency: 4, PollInterval: 100 * time.Millisecond},
	}
	workerConfig := newWorkerConfig(imageConfig)

	if workerConfig.Concurrency != 4 {
		t.Errorf("Concurrency = %d, want 4", workerConfig.Concurrency)
	}
	if workerConfig.PollInterval != 100*time.Millisecond {
		t.Errorf("PollInterval = %s, want 100ms", workerConfig.PollInterval)
	}
	if workerConfig.BatchSize != 1 || workerConfig.RecoveryBatchSize != 10 {
		t.Errorf("batch sizes = %d/%d, want worker defaults 1/10", workerConfig.BatchSize, workerConfig.RecoveryBatchSize)
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

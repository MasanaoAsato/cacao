package main

import (
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"cacao/src/infrastructure/service"
)

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

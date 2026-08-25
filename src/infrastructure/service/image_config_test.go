package service

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestImageConfigFromEnvDefaults(t *testing.T) {
	clearImageConfigEnv(t)

	config, err := ImageConfigFromEnv()
	if err != nil {
		t.Fatalf("ImageConfigFromEnv() error = %v", err)
	}
	if config.GeneratorDriver != "stub" {
		t.Errorf("GeneratorDriver = %q, want stub", config.GeneratorDriver)
	}
	if config.GenerationTimeout != 180*time.Second {
		t.Errorf("GenerationTimeout = %s, want 180s", config.GenerationTimeout)
	}
	if config.WorkerConcurrency != 1 {
		t.Errorf("WorkerConcurrency = %d, want 1", config.WorkerConcurrency)
	}
	if config.WorkerPollInterval != time.Second {
		t.Errorf("WorkerPollInterval = %s, want 1s", config.WorkerPollInterval)
	}
	if config.WorkerLeaseDuration != 240*time.Second {
		t.Errorf("WorkerLeaseDuration = %s, want 240s", config.WorkerLeaseDuration)
	}
	if config.Storage.Root != "./var/journey-images" {
		t.Errorf("Storage.Root = %q, want ./var/journey-images", config.Storage.Root)
	}
}

func TestImageConfigFromEnvComfyUI(t *testing.T) {
	clearImageConfigEnv(t)
	t.Setenv("IMAGE_GENERATOR_DRIVER", "comfyui")
	t.Setenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188")
	t.Setenv("COMFYUI_WORKFLOW_PATH", imageConfigFilePath(t, "journey_image_api.json"))
	t.Setenv("COMFYUI_MANIFEST_PATH", imageConfigFilePath(t, "journey_image_manifest.json"))

	config, err := ImageConfigFromEnv()
	if err != nil {
		t.Fatalf("ImageConfigFromEnv() error = %v", err)
	}
	if config.GeneratorDriver != "comfyui" {
		t.Errorf("GeneratorDriver = %q, want comfyui", config.GeneratorDriver)
	}
	if config.ComfyUIBaseURL != "http://127.0.0.1:8188" {
		t.Errorf("ComfyUIBaseURL = %q, want configured URL", config.ComfyUIBaseURL)
	}
}

func TestImageConfigFromEnvRejectsInvalidValues(t *testing.T) {
	cases := []struct {
		name  string
		setup func(*testing.T)
	}{
		{
			name: "unsupported driver",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_GENERATOR_DRIVER", "unknown")
			},
		},
		{
			name: "comfyui requires base URL",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_GENERATOR_DRIVER", "comfyui")
			},
		},
		{
			name: "generation timeout below minimum",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_GENERATION_TIMEOUT", "999ms")
			},
		},
		{
			name: "worker concurrency above maximum",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_WORKER_CONCURRENCY", "5")
			},
		},
		{
			name: "worker poll interval below minimum",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_WORKER_POLL_INTERVAL", "99ms")
			},
		},
		{
			name: "worker lease is not longer than generation timeout",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_GENERATION_TIMEOUT", "10s")
				t.Setenv("IMAGE_WORKER_LEASE_DURATION", "10s")
			},
		},
		{
			name: "invalid comfyui URL",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_GENERATOR_DRIVER", "comfyui")
				t.Setenv("COMFYUI_BASE_URL", "http://user@localhost:8188")
			},
		},
		{
			name: "workflow is not readable",
			setup: func(t *testing.T) {
				t.Setenv("IMAGE_GENERATOR_DRIVER", "comfyui")
				t.Setenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188")
				t.Setenv("COMFYUI_WORKFLOW_PATH", filepath.Join(t.TempDir(), "missing.json"))
			},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			clearImageConfigEnv(t)
			testCase.setup(t)

			if _, err := ImageConfigFromEnv(); err == nil {
				t.Fatal("ImageConfigFromEnv() error = nil, want error")
			}
		})
	}
}

func TestImageConfigValidateBoundaries(t *testing.T) {
	base := ImageConfig{
		GeneratorDriver:     "stub",
		GenerationTimeout:   time.Second,
		WorkerConcurrency:   1,
		WorkerPollInterval:  100 * time.Millisecond,
		WorkerLeaseDuration: 2 * time.Second,
	}
	cases := []struct {
		name    string
		config  ImageConfig
		wantErr bool
	}{
		{
			name:   "minimum values",
			config: base,
		},
		{
			name: "maximum concurrency",
			config: ImageConfig{
				GeneratorDriver:     "stub",
				GenerationTimeout:   time.Second,
				WorkerConcurrency:   4,
				WorkerPollInterval:  100 * time.Millisecond,
				WorkerLeaseDuration: 2 * time.Second,
			},
		},
		{
			name: "lease equal timeout",
			config: ImageConfig{
				GeneratorDriver:     "stub",
				GenerationTimeout:   time.Second,
				WorkerConcurrency:   1,
				WorkerPollInterval:  100 * time.Millisecond,
				WorkerLeaseDuration: time.Second,
			},
			wantErr: true,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if err := testCase.config.validate(); (err != nil) != testCase.wantErr {
				t.Errorf("ImageConfig.validate() error = %v, wantErr = %v", err, testCase.wantErr)
			}
		})
	}
}

func clearImageConfigEnv(t *testing.T) {
	t.Helper()

	keys := []string{
		"IMAGE_GENERATOR_DRIVER",
		"COMFYUI_BASE_URL",
		"COMFYUI_WORKFLOW_PATH",
		"COMFYUI_MANIFEST_PATH",
		"IMAGE_GENERATION_TIMEOUT",
		"IMAGE_WORKER_CONCURRENCY",
		"IMAGE_WORKER_POLL_INTERVAL",
		"IMAGE_WORKER_LEASE_DURATION",
		"IMAGE_STORAGE_DRIVER",
		"IMAGE_STORAGE_ROOT",
		"IMAGE_MAX_BYTES",
		"IMAGE_MAX_WIDTH",
		"IMAGE_MAX_HEIGHT",
		"IMAGE_MAX_PIXELS",
	}
	for _, key := range keys {
		value, exists := os.LookupEnv(key)
		if exists {
			t.Cleanup(func() { _ = os.Setenv(key, value) })
		} else {
			t.Cleanup(func() { _ = os.Unsetenv(key) })
		}
		if err := os.Unsetenv(key); err != nil {
			t.Fatalf("unset %s: %v", key, err)
		}
	}
}

func imageConfigFilePath(t *testing.T, fileName string) string {
	t.Helper()

	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller() failed")
	}

	return filepath.Join(filepath.Dir(sourceFile), "..", "..", "..", "config", "comfyui", fileName)
}

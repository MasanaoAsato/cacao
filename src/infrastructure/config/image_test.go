package config

import (
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"
)

func TestImageFromEnvDefaults(t *testing.T) {
	clearImageEnv(t)

	config, err := ImageFromEnv()
	if err != nil {
		t.Fatalf("ImageFromEnv() error = %v", err)
	}
	if config.GeneratorDriver != ImageGeneratorStub {
		t.Errorf("GeneratorDriver = %q, want stub", config.GeneratorDriver)
	}
	if config.GenerationTimeout != DefaultImageGenerationTimeout {
		t.Errorf("GenerationTimeout = %s, want %s", config.GenerationTimeout, DefaultImageGenerationTimeout)
	}
	if config.MaxIllustrations != 3 {
		t.Errorf("MaxIllustrations = %d, want 3", config.MaxIllustrations)
	}
	if config.Worker.Concurrency != 1 {
		t.Errorf("Worker.Concurrency = %d, want 1", config.Worker.Concurrency)
	}
	if config.Worker.PollInterval != time.Second {
		t.Errorf("Worker.PollInterval = %s, want 1s", config.Worker.PollInterval)
	}
	if config.Worker.LeaseDuration != DefaultImageLeaseDuration {
		t.Errorf("Worker.LeaseDuration = %s, want %s", config.Worker.LeaseDuration, DefaultImageLeaseDuration)
	}
	if config.Storage.Driver != ImageStorageFilesystem || config.Storage.Root != "./var/journey-images" {
		t.Errorf("Storage = %+v", config.Storage)
	}
	if config.Storage.Limits != (ImageLimits{MaxBytes: 20971520, MaxWidth: 4096, MaxHeight: 4096, MaxPixels: 16777216}) {
		t.Errorf("Storage.Limits = %+v", config.Storage.Limits)
	}
}

func TestImageFromEnvComfyUI(t *testing.T) {
	clearImageEnv(t)
	t.Setenv("IMAGE_GENERATOR_DRIVER", "comfyui")
	t.Setenv("COMFYUI_BASE_URL", " http://127.0.0.1:8188 ")

	config, err := ImageFromEnv()
	if err != nil {
		t.Fatalf("ImageFromEnv() error = %v", err)
	}
	if config.GeneratorDriver != ImageGeneratorComfyUI {
		t.Errorf("GeneratorDriver = %q, want comfyui", config.GeneratorDriver)
	}
	if config.ComfyUI.BaseURL != "http://127.0.0.1:8188" {
		t.Errorf("ComfyUI.BaseURL = %q, want trimmed URL", config.ComfyUI.BaseURL)
	}
	if config.ComfyUI.WorkflowPath == "" || config.ComfyUI.ManifestPath == "" {
		t.Errorf("ComfyUI paths must have defaults: %+v", config.ComfyUI)
	}
}

func TestImageFromEnvOpenRouter(t *testing.T) {
	clearImageEnv(t)
	t.Setenv("IMAGE_GENERATOR_DRIVER", "openrouter")
	t.Setenv("OPENROUTER_API_KEY", "test-openrouter-key")
	t.Setenv("OPENROUTER_IMAGE_MODEL", "provider/image-model")

	config, err := ImageFromEnv()
	if err != nil {
		t.Fatalf("ImageFromEnv() error = %v", err)
	}
	if config.OpenRouterImage.APIKey != "test-openrouter-key" {
		t.Errorf("OpenRouterImage.APIKey = %q", config.OpenRouterImage.APIKey)
	}
	if config.OpenRouterImage.Model != "provider/image-model" {
		t.Errorf("OpenRouterImage.Model = %q", config.OpenRouterImage.Model)
	}
}

func TestImageFromEnvRejectsInvalidValues(t *testing.T) {
	cases := []struct {
		name string
		env  map[string]string
	}{
		{name: "異常系: 未対応ドライバ", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "unknown"}},
		{name: "異常系: comfyui は base URL 必須", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "comfyui"}},
		{name: "異常系: comfyui の workflow path が空", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "comfyui", "COMFYUI_BASE_URL": "http://127.0.0.1:8188", "COMFYUI_WORKFLOW_PATH": " "}},
		{name: "異常系: openrouter の API キー欠落", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "openrouter", "OPENROUTER_IMAGE_MODEL": "provider/image-model"}},
		{name: "異常系: openrouter のモデル欠落", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "openrouter", "OPENROUTER_API_KEY": "k"}},
		{name: "異常系: openrouter のモデルが URL", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "openrouter", "OPENROUTER_API_KEY": "k", "OPENROUTER_IMAGE_MODEL": "https://example.invalid/model"}},
		{name: "異常系: openrouter のモデルが ~ 始まり", env: map[string]string{"IMAGE_GENERATOR_DRIVER": "openrouter", "OPENROUTER_API_KEY": "k", "OPENROUTER_IMAGE_MODEL": "~provider/model"}},
		{name: "境界値系: 生成タイムアウトが下限未満", env: map[string]string{"IMAGE_GENERATION_TIMEOUT": "999ms"}},
		{name: "境界値系: 並列数が上限超過", env: map[string]string{"IMAGE_WORKER_CONCURRENCY": "5"}},
		{name: "境界値系: 並列数が 0", env: map[string]string{"IMAGE_WORKER_CONCURRENCY": "0"}},
		{name: "異常系: 挿絵上限が 0", env: map[string]string{"IMAGE_MAX_ILLUSTRATIONS": "0"}},
		{name: "異常系: 挿絵上限が 4", env: map[string]string{"IMAGE_MAX_ILLUSTRATIONS": "4"}},
		{name: "境界値系: ポーリング間隔が下限未満", env: map[string]string{"IMAGE_WORKER_POLL_INTERVAL": "99ms"}},
		{name: "境界値系: lease がタイムアウトと同じ", env: map[string]string{"IMAGE_GENERATION_TIMEOUT": "10s", "IMAGE_WORKER_LEASE_DURATION": "10s"}},
		{name: "異常系: ストレージドライバ未対応", env: map[string]string{"IMAGE_STORAGE_DRIVER": "s3"}},
		{name: "異常系: 上限が 0", env: map[string]string{"IMAGE_MAX_BYTES": "0"}},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			clearImageEnv(t)
			for key, value := range testCase.env {
				t.Setenv(key, value)
			}
			if _, err := ImageFromEnv(); err == nil {
				t.Fatal("ImageFromEnv() error = nil, want error")
			}
		})
	}
}

func TestImageFromEnvMaxIllustrations(t *testing.T) {
	for _, want := range []int{MinImageIllustrations, MaxImageIllustrations} {
		t.Run(fmt.Sprintf("境界値系: 挿絵上限%d枚", want), func(t *testing.T) {
			clearImageEnv(t)
			t.Setenv("IMAGE_MAX_ILLUSTRATIONS", strconv.Itoa(want))

			config, err := ImageFromEnv()
			if err != nil {
				t.Fatalf("ImageFromEnv() error = %v", err)
			}
			if config.MaxIllustrations != want {
				t.Errorf("MaxIllustrations = %d, want %d", config.MaxIllustrations, want)
			}
		})
	}
}

func TestImageFromEnvStorageLimits(t *testing.T) {
	clearImageEnv(t)
	t.Setenv("IMAGE_STORAGE_ROOT", "/tmp/cacao-images")
	t.Setenv("IMAGE_MAX_BYTES", "1")
	t.Setenv("IMAGE_MAX_WIDTH", "1")
	t.Setenv("IMAGE_MAX_HEIGHT", "1")
	t.Setenv("IMAGE_MAX_PIXELS", "1")

	config, err := ImageFromEnv()
	if err != nil {
		t.Fatalf("ImageFromEnv() error = %v", err)
	}
	if config.Storage.Root != "/tmp/cacao-images" {
		t.Errorf("Storage.Root = %q", config.Storage.Root)
	}
	if config.Storage.Limits != (ImageLimits{MaxBytes: 1, MaxWidth: 1, MaxHeight: 1, MaxPixels: 1}) {
		t.Errorf("境界値系: すべて 1 の上限は受け入れる: %+v", config.Storage.Limits)
	}
}

func TestImageValidateBoundaries(t *testing.T) {
	base := Image{
		GeneratorDriver:   ImageGeneratorStub,
		GenerationTimeout: MinImageGenerationTimeout,
		MaxIllustrations:  MinImageIllustrations,
		Worker:            ImageWorker{Concurrency: 1, PollInterval: MinImageWorkerPollInterval, LeaseDuration: 2 * time.Second},
		Storage:           ImageStorage{Driver: ImageStorageFilesystem, Root: ".", Limits: ImageLimits{MaxBytes: 1, MaxWidth: 1, MaxHeight: 1, MaxPixels: 1}},
	}
	maxConcurrency := base
	maxConcurrency.Worker.Concurrency = MaxImageWorkerConcurrency
	leaseEqualsTimeout := base
	leaseEqualsTimeout.Worker.LeaseDuration = base.GenerationTimeout

	cases := []struct {
		name    string
		config  Image
		wantErr bool
	}{
		{name: "境界値系: 最小値", config: base},
		{name: "境界値系: 並列数の最大値", config: maxConcurrency},
		{name: "境界値系: lease がタイムアウトと同じ", config: leaseEqualsTimeout, wantErr: true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if err := testCase.config.Validate(); (err != nil) != testCase.wantErr {
				t.Errorf("Validate() error = %v, wantErr = %v", err, testCase.wantErr)
			}
		})
	}
}

func clearImageEnv(t *testing.T) {
	t.Helper()

	keys := []string{
		"IMAGE_GENERATOR_DRIVER",
		"COMFYUI_BASE_URL",
		"COMFYUI_WORKFLOW_PATH",
		"COMFYUI_MANIFEST_PATH",
		"OPENROUTER_API_KEY",
		"OPENROUTER_IMAGE_MODEL",
		"IMAGE_GENERATION_TIMEOUT",
		"IMAGE_MAX_ILLUSTRATIONS",
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

package config

import (
	"strings"
	"testing"
	"time"
)

func TestBookletFromEnvDefaults(t *testing.T) {
	clearBookletEnv(t)

	bookletConfig, err := BookletFromEnv()
	if err != nil {
		t.Fatalf("BookletFromEnv() error = %v", err)
	}
	if bookletConfig.PDFDriver != BookletPDFDriverStub {
		t.Errorf("PDFDriver = %q, want %q", bookletConfig.PDFDriver, BookletPDFDriverStub)
	}
	if bookletConfig.PDFTimeout != DefaultBookletPDFTimeout {
		t.Errorf("PDFTimeout = %s, want %s", bookletConfig.PDFTimeout, DefaultBookletPDFTimeout)
	}
	if bookletConfig.PDFConcurrency != DefaultBookletConcurrency {
		t.Errorf(
			"PDFConcurrency = %d, want %d",
			bookletConfig.PDFConcurrency,
			DefaultBookletConcurrency,
		)
	}
	if bookletConfig.PDFMaxBytes != DefaultBookletPDFMaxBytes {
		t.Errorf(
			"PDFMaxBytes = %d, want %d",
			bookletConfig.PDFMaxBytes,
			DefaultBookletPDFMaxBytes,
		)
	}
	if bookletConfig.GotenbergURL != "" {
		t.Errorf("GotenbergURL = %q, want empty", bookletConfig.GotenbergURL)
	}
}

func TestBookletFromEnvGotenberg(t *testing.T) {
	clearBookletEnv(t)
	t.Setenv("BOOKLET_PDF_DRIVER", BookletPDFDriverGotenberg)
	t.Setenv("BOOKLET_RENDER_BASE_URL", " http://host.docker.internal:5173/app/ ")
	t.Setenv("BOOKLET_GOTENBERG_URL", " http://127.0.0.1:3002/ ")
	t.Setenv("BOOKLET_PDF_TIMEOUT", "45s")
	t.Setenv("BOOKLET_PDF_CONCURRENCY", "2")
	t.Setenv("BOOKLET_PDF_MAX_BYTES", "1024")

	bookletConfig, err := BookletFromEnv()
	if err != nil {
		t.Fatalf("BookletFromEnv() error = %v", err)
	}
	if bookletConfig.RenderBaseURL != "http://host.docker.internal:5173/app" {
		t.Errorf("RenderBaseURL = %q, want normalized URL", bookletConfig.RenderBaseURL)
	}
	if bookletConfig.GotenbergURL != "http://127.0.0.1:3002" {
		t.Errorf("GotenbergURL = %q, want normalized URL", bookletConfig.GotenbergURL)
	}
	if bookletConfig.PDFTimeout != 45*time.Second {
		t.Errorf("PDFTimeout = %s, want 45s", bookletConfig.PDFTimeout)
	}
	if bookletConfig.PDFConcurrency != 2 {
		t.Errorf("PDFConcurrency = %d, want 2", bookletConfig.PDFConcurrency)
	}
	if bookletConfig.PDFMaxBytes != 1024 {
		t.Errorf("PDFMaxBytes = %d, want 1024", bookletConfig.PDFMaxBytes)
	}
}

func TestBookletFromEnvAcceptsBoundaryValues(t *testing.T) {
	clearBookletEnv(t)
	t.Setenv("BOOKLET_PDF_TIMEOUT", MinBookletPDFTimeout.String())
	t.Setenv("BOOKLET_PDF_CONCURRENCY", "2")
	t.Setenv("BOOKLET_PDF_MAX_BYTES", "1")

	bookletConfig, err := BookletFromEnv()
	if err != nil {
		t.Fatalf("BookletFromEnv() error = %v", err)
	}
	if bookletConfig.PDFTimeout != MinBookletPDFTimeout {
		t.Errorf("PDFTimeout = %s, want %s", bookletConfig.PDFTimeout, MinBookletPDFTimeout)
	}
	if bookletConfig.PDFConcurrency != MaxBookletConcurrency {
		t.Errorf(
			"PDFConcurrency = %d, want %d",
			bookletConfig.PDFConcurrency,
			MaxBookletConcurrency,
		)
	}
	if bookletConfig.PDFMaxBytes != 1 {
		t.Errorf("PDFMaxBytes = %d, want 1", bookletConfig.PDFMaxBytes)
	}
}

func TestBookletFromEnvRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name string
		env  map[string]string
		want string
	}{
		{
			name: "gotenbergの描画URLがない",
			env: map[string]string{
				"BOOKLET_PDF_DRIVER":    BookletPDFDriverGotenberg,
				"BOOKLET_GOTENBERG_URL": "http://127.0.0.1:3002",
			},
			want: "render base URL",
		},
		{
			name: "gotenbergのAPI URLがない",
			env: map[string]string{
				"BOOKLET_PDF_DRIVER":      BookletPDFDriverGotenberg,
				"BOOKLET_RENDER_BASE_URL": "http://example.test",
			},
			want: "Gotenberg URL",
		},
		{
			name: "描画URLがhttpではない",
			env: map[string]string{
				"BOOKLET_PDF_DRIVER":      BookletPDFDriverGotenberg,
				"BOOKLET_RENDER_BASE_URL": "file:///tmp/booklet",
				"BOOKLET_GOTENBERG_URL":   "http://127.0.0.1:3002",
			},
			want: "http or https",
		},
		{
			name: "API URLに認証情報がある",
			env: map[string]string{
				"BOOKLET_PDF_DRIVER":      BookletPDFDriverGotenberg,
				"BOOKLET_RENDER_BASE_URL": "http://example.test",
				"BOOKLET_GOTENBERG_URL":   "http://user:pass@127.0.0.1:3002",
			},
			want: "must not include credentials",
		},
		{
			name: "API URLにクエリがある",
			env: map[string]string{
				"BOOKLET_PDF_DRIVER":      BookletPDFDriverGotenberg,
				"BOOKLET_RENDER_BASE_URL": "http://example.test",
				"BOOKLET_GOTENBERG_URL":   "http://127.0.0.1:3002?debug=1",
			},
			want: "must not include credentials",
		},
		{
			name: "タイムアウトが最小未満",
			env:  map[string]string{"BOOKLET_PDF_TIMEOUT": "4s"},
			want: "timeout",
		},
		{
			name: "同時実行数がゼロ",
			env:  map[string]string{"BOOKLET_PDF_CONCURRENCY": "0"},
			want: "concurrency",
		},
		{
			name: "同時実行数が上限超過",
			env:  map[string]string{"BOOKLET_PDF_CONCURRENCY": "3"},
			want: "concurrency",
		},
		{
			name: "最大バイト数がゼロ",
			env:  map[string]string{"BOOKLET_PDF_MAX_BYTES": "0"},
			want: "max bytes",
		},
		{
			name: "未対応ドライバ",
			env:  map[string]string{"BOOKLET_PDF_DRIVER": "chromedp"},
			want: "unsupported",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			clearBookletEnv(t)
			for key, value := range testCase.env {
				t.Setenv(key, value)
			}

			_, err := BookletFromEnv()
			if err == nil {
				t.Fatal("BookletFromEnv() error = nil, want error")
			}
			if !strings.Contains(err.Error(), testCase.want) {
				t.Errorf("BookletFromEnv() error = %q, want %q", err, testCase.want)
			}
		})
	}
}

func clearBookletEnv(t *testing.T) {
	t.Helper()

	for _, key := range []string{
		"BOOKLET_PDF_DRIVER",
		"BOOKLET_RENDER_BASE_URL",
		"BOOKLET_GOTENBERG_URL",
		"BOOKLET_PDF_TIMEOUT",
		"BOOKLET_PDF_CONCURRENCY",
		"BOOKLET_PDF_MAX_BYTES",
		"BOOKLET_CHROMIUM_PATH",
		"BOOKLET_CHROMIUM_REMOTE_URL",
		"BOOKLET_CHROMIUM_NO_SANDBOX",
	} {
		t.Setenv(key, "")
	}
}

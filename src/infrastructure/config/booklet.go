package config

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/caarlos0/env/v10"
)

const (
	BookletPDFDriverStub      = "stub"
	BookletPDFDriverGotenberg = "gotenberg"
	DefaultBookletPDFTimeout  = 30 * time.Second
	MinBookletPDFTimeout      = 5 * time.Second
	DefaultBookletConcurrency = 1
	MinBookletConcurrency     = 1
	MaxBookletConcurrency     = 2
	DefaultBookletPDFMaxBytes = int64(10485760)
)

// Booklet はしおりPDFの描画に必要な運用設定を表す。
type Booklet struct {
	PDFDriver      string        `env:"BOOKLET_PDF_DRIVER" envDefault:"stub"`
	RenderBaseURL  string        `env:"BOOKLET_RENDER_BASE_URL"`
	GotenbergURL   string        `env:"BOOKLET_GOTENBERG_URL"`
	PDFTimeout     time.Duration `env:"BOOKLET_PDF_TIMEOUT" envDefault:"30s"`
	PDFConcurrency int           `env:"BOOKLET_PDF_CONCURRENCY" envDefault:"1"`
	PDFMaxBytes    int64         `env:"BOOKLET_PDF_MAX_BYTES" envDefault:"10485760"`
}

// BookletFromEnv はしおりPDFの設定を環境変数から読み込み、検証して返す。
func BookletFromEnv() (Booklet, error) {
	var bookletConfig Booklet
	if err := env.Parse(&bookletConfig); err != nil {
		return Booklet{}, fmt.Errorf("parse booklet config: %w", err)
	}

	bookletConfig = bookletConfig.normalized()
	if err := bookletConfig.Validate(); err != nil {
		return Booklet{}, err
	}

	return bookletConfig, nil
}

func (c Booklet) normalized() Booklet {
	c.PDFDriver = strings.TrimSpace(c.PDFDriver)
	c.RenderBaseURL = strings.TrimRight(strings.TrimSpace(c.RenderBaseURL), "/")
	c.GotenbergURL = strings.TrimRight(strings.TrimSpace(c.GotenbergURL), "/")

	return c
}

// Validate は設定値がしおりPDFの運用契約を満たすことを検証する。
func (c Booklet) Validate() error {
	if c.PDFTimeout < MinBookletPDFTimeout {
		return fmt.Errorf("booklet pdf timeout must be at least %s", MinBookletPDFTimeout)
	}
	if c.PDFConcurrency < MinBookletConcurrency || c.PDFConcurrency > MaxBookletConcurrency {
		return fmt.Errorf(
			"booklet pdf concurrency must be between %d and %d",
			MinBookletConcurrency,
			MaxBookletConcurrency,
		)
	}
	if c.PDFMaxBytes < 1 {
		return fmt.Errorf("booklet pdf max bytes must be positive")
	}

	switch c.PDFDriver {
	case BookletPDFDriverStub:
		return nil
	case BookletPDFDriverGotenberg:
		if err := validateBookletURL("render base", c.RenderBaseURL); err != nil {
			return err
		}
		if err := validateBookletURL("Gotenberg", c.GotenbergURL); err != nil {
			return err
		}

		return nil
	default:
		return fmt.Errorf("unsupported booklet pdf driver: %q", c.PDFDriver)
	}
}

func validateBookletURL(name, value string) error {
	if value == "" {
		return fmt.Errorf("booklet %s URL must be set when booklet pdf driver is gotenberg", name)
	}

	parsed, err := url.ParseRequestURI(value)
	if err != nil {
		return fmt.Errorf("booklet %s URL must be a valid URL: %w", name, err)
	}
	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return fmt.Errorf("booklet %s URL must use http or https", name)
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return fmt.Errorf(
			"booklet %s URL must not include credentials, query, or fragment",
			name,
		)
	}

	return nil
}

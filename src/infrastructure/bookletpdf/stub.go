package bookletpdf

import (
	"context"
	"fmt"

	domainservice "cacao/src/domain/service"
)

// Stub はCIと開発環境で使う固定PDFのレンダラーである。
type Stub struct {
	maxBytes int64
}

// NewStub は固定PDFを返すレンダラーを生成する。
func NewStub(maxBytes int64) *Stub {
	return &Stub{maxBytes: maxBytes}
}

var _ domainservice.BookletRenderer = (*Stub)(nil)

// Render は最小の有効なA5 PDFを即時に返す。
func (s *Stub) Render(
	ctx context.Context,
	_ domainservice.BookletRenderRequest,
) (domainservice.RenderedBooklet, error) {
	if err := ctx.Err(); err != nil {
		return domainservice.RenderedBooklet{}, fmt.Errorf("%w: %w", domainservice.ErrBookletRenderFailed, err)
	}

	booklet := domainservice.RenderedBooklet{
		Content:   append([]byte(nil), stubPDF...),
		MediaType: domainservice.BookletPDFMediaType,
	}
	if err := domainservice.ValidateRenderedBooklet(booklet, s.maxBytes); err != nil {
		return domainservice.RenderedBooklet{}, err
	}

	return booklet, nil
}

var stubPDF = []byte(
	"%PDF-1.4\n" +
		"1 0 obj\n" +
		"<< /Type /Catalog /Pages 2 0 R >>\n" +
		"endobj\n" +
		"2 0 obj\n" +
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
		"endobj\n" +
		"3 0 obj\n" +
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 419.53 595.28] >>\n" +
		"endobj\n" +
		"xref\n" +
		"0 4\n" +
		"0000000000 65535 f \n" +
		"0000000009 00000 n \n" +
		"0000000058 00000 n \n" +
		"0000000115 00000 n \n" +
		"trailer\n" +
		"<< /Size 4 /Root 1 0 R >>\n" +
		"startxref\n" +
		"192\n" +
		"%%EOF\n",
)

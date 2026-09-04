package service

import (
	"testing"

	"cacao/src/domain/value_object"
)

func TestNewBookletRenderRequest(t *testing.T) {
	seed, err := value_object.NewThemeSeed("v1-abcdef12")
	if err != nil {
		t.Fatalf("NewThemeSeed() error = %v", err)
	}

	request, err := NewBookletRenderRequest(value_object.NewID(), &seed)
	if err != nil {
		t.Fatalf("NewBookletRenderRequest() error = %v", err)
	}

	if request.JourneyID().IsEmpty() {
		t.Error("JourneyID() is empty")
	}
	gotSeed, ok := request.ThemeSeed()
	if !ok {
		t.Fatal("ThemeSeed() ok = false, want true")
	}
	if gotSeed.String() != "v1-abcdef12" {
		t.Errorf("ThemeSeed().String() = %q, want v1-abcdef12", gotSeed.String())
	}
}

func TestNewBookletRenderRequestRejectsEmptyJourneyID(t *testing.T) {
	_, err := NewBookletRenderRequest(value_object.ID{}, nil)

	if err == nil {
		t.Fatal("NewBookletRenderRequest() error = nil, want error")
	}
}

func TestValidateRenderedBooklet(t *testing.T) {
	tests := []struct {
		name      string
		booklet   RenderedBooklet
		maxBytes  int64
		wantError bool
	}{
		{
			name: "正常系: PDFヘッダと上限内のサイズを受け付ける",
			booklet: RenderedBooklet{
				Content:   []byte("%PDF-1.4\n"),
				MediaType: BookletPDFMediaType,
			},
			maxBytes: 1024,
		},
		{
			name: "異常系: PDF以外のメディアタイプを拒否する",
			booklet: RenderedBooklet{
				Content:   []byte("%PDF-1.4\n"),
				MediaType: "text/plain",
			},
			maxBytes:  1024,
			wantError: true,
		},
		{
			name: "異常系: PDFヘッダがない内容を拒否する",
			booklet: RenderedBooklet{
				Content:   []byte("not a PDF"),
				MediaType: BookletPDFMediaType,
			},
			maxBytes:  1024,
			wantError: true,
		},
		{
			name: "境界値系: 最大サイズと同じなら受け付ける",
			booklet: RenderedBooklet{
				Content:   []byte("%PDF-"),
				MediaType: BookletPDFMediaType,
			},
			maxBytes: 5,
		},
		{
			name: "境界値系: 最大サイズを1バイト超えると拒否する",
			booklet: RenderedBooklet{
				Content:   []byte("%PDF-1"),
				MediaType: BookletPDFMediaType,
			},
			maxBytes:  5,
			wantError: true,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := ValidateRenderedBooklet(testCase.booklet, testCase.maxBytes)
			if (err != nil) != testCase.wantError {
				t.Errorf("ValidateRenderedBooklet() error = %v, wantError = %v", err, testCase.wantError)
			}
		})
	}
}

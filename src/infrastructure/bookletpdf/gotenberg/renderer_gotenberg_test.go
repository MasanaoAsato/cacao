//go:build gotenberg

package gotenberg

import (
	"bytes"
	"compress/zlib"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	domainservice "cacao/src/domain/service"
	"cacao/src/infrastructure/config"
)

var (
	gotenbergObjectPattern = regexp.MustCompile(
		`(?s)([0-9]+)\s+0\s+obj(.*?)endobj`,
	)
	gotenbergPagePattern = regexp.MustCompile(
		`(?s)/Type\s*/Page(?:\s|/|>).*?/MediaBox\s*\[\s*0\s+0\s+` +
			`([0-9.]+)\s+([0-9.]+)\s*\].*?/Contents\s+([0-9]+)\s+0\s+R`,
	)
	gotenbergToUnicodePattern   = regexp.MustCompile(`/ToUnicode\s+([0-9]+)\s+0\s+R`)
	gotenbergBFCharBlockPattern = regexp.MustCompile(
		`(?s)[0-9]+\s+beginbfchar(.*?)endbfchar`,
	)
	gotenbergBFCharPairPattern = regexp.MustCompile(
		`<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>`,
	)
	gotenbergBFRangeBlockPattern = regexp.MustCompile(
		`(?s)[0-9]+\s+beginbfrange(.*?)endbfrange`,
	)
	gotenbergBFRangePattern = regexp.MustCompile(
		`<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>`,
	)
	gotenbergTextPattern = regexp.MustCompile(`<([0-9A-Fa-f]+)>\s*Tj`)
)

type inspectedGotenbergPage struct {
	width  float64
	height float64
	text   string
}

func TestRendererRenderWithGotenberg(t *testing.T) {
	gotenbergURL := os.Getenv("BOOKLET_GOTENBERG_URL")
	if gotenbergURL == "" {
		t.Skip("BOOKLET_GOTENBERG_URL is not set")
	}

	renderBaseURL := startBookletTestServer(t, "ready")
	renderer := NewRenderer(config.Booklet{
		PDFDriver:      config.BookletPDFDriverGotenberg,
		RenderBaseURL:  renderBaseURL,
		GotenbergURL:   gotenbergURL,
		PDFTimeout:     15 * time.Second,
		PDFConcurrency: 1,
		PDFMaxBytes:    10 << 20,
	})

	rendered, err := renderer.Render(context.Background(), newTestRequest(t))
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}
	if err := domainservice.ValidateRenderedBooklet(rendered, 10<<20); err != nil {
		t.Fatalf("ValidateRenderedBooklet() error = %v", err)
	}
	pages, err := inspectGotenbergPDF(rendered.Content)
	if err != nil {
		t.Fatalf("inspectGotenbergPDF() error = %v", err)
	}
	wantText := []string{
		"first booklet page",
		"second booklet page",
		"third booklet page",
	}
	if len(pages) != len(wantText) {
		t.Fatalf("PDF page count = %d, want %d", len(pages), len(wantText))
	}
	for index, page := range pages {
		if math.Abs(page.width-419.53) > 1 {
			t.Errorf("page %d width = %.2fpt, want 419.53±1pt", index+1, page.width)
		}
		if math.Abs(page.height-595.28) > 1 {
			t.Errorf("page %d height = %.2fpt, want 595.28±1pt", index+1, page.height)
		}
		if !strings.Contains(page.text, wantText[index]) {
			t.Errorf("page %d text = %q, want %q", index+1, page.text, wantText[index])
		}
	}
}

func TestRendererRenderWithGotenbergReportsPageError(t *testing.T) {
	gotenbergURL := os.Getenv("BOOKLET_GOTENBERG_URL")
	if gotenbergURL == "" {
		t.Skip("BOOKLET_GOTENBERG_URL is not set")
	}

	renderer := NewRenderer(config.Booklet{
		PDFDriver:      config.BookletPDFDriverGotenberg,
		RenderBaseURL:  startBookletTestServer(t, "error"),
		GotenbergURL:   gotenbergURL,
		PDFTimeout:     15 * time.Second,
		PDFConcurrency: 1,
		PDFMaxBytes:    10 << 20,
	})

	startedAt := time.Now()
	_, err := renderer.Render(context.Background(), newTestRequest(t))
	if err == nil {
		t.Fatal("Render() error = nil, want page error")
	}
	if elapsed := time.Since(startedAt); elapsed >= 10*time.Second {
		t.Errorf("page error took %s, want an immediate failure", elapsed)
	}
}

func TestRendererRenderWithGotenbergTimesOutWaitingForReady(t *testing.T) {
	gotenbergURL := os.Getenv("BOOKLET_GOTENBERG_URL")
	if gotenbergURL == "" {
		t.Skip("BOOKLET_GOTENBERG_URL is not set")
	}

	renderer := NewRenderer(config.Booklet{
		PDFDriver:      config.BookletPDFDriverGotenberg,
		RenderBaseURL:  startBookletTestServer(t, "preparing"),
		GotenbergURL:   gotenbergURL,
		PDFTimeout:     500 * time.Millisecond,
		PDFConcurrency: 1,
		PDFMaxBytes:    10 << 20,
	})

	_, err := renderer.Render(context.Background(), newTestRequest(t))
	if !errors.Is(err, domainservice.ErrBookletRenderTimeout) {
		t.Errorf("Render() error = %v, want ErrBookletRenderTimeout", err)
	}
}

func startBookletTestServer(t *testing.T, state string) string {
	t.Helper()

	listener, err := net.Listen("tcp4", "0.0.0.0:5175")
	if err != nil {
		t.Fatalf("net.Listen() error = %v", err)
	}
	server := &http.Server{
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
			writer.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = fmt.Fprintf(writer, `<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: A5; margin: 0; }
body { margin: 0; }
.page { box-sizing: border-box; width: 148mm; height: 210mm; break-after: page; }
.page:last-child { break-after: auto; }
</style></head>
<body><main class="booklet-shell" data-booklet-print-state="%s">
<div class="booklet-document">
<section class="page">first booklet page</section>
<section class="page">second booklet page</section>
<section class="page">third booklet page</section>
</div></main></body></html>`, state)
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		_ = server.Serve(listener)
	}()
	t.Cleanup(func() {
		shutdownContext, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownContext)
	})

	return "http://host.docker.internal:5175"
}

func inspectGotenbergPDF(content []byte) ([]inspectedGotenbergPage, error) {
	objects := make(map[int][]byte)
	for _, match := range gotenbergObjectPattern.FindAllSubmatch(content, -1) {
		number, err := strconv.Atoi(string(match[1]))
		if err != nil {
			return nil, fmt.Errorf("parse PDF object number: %w", err)
		}
		objects[number] = match[2]
	}

	characters, err := gotenbergCharacterMap(objects)
	if err != nil {
		return nil, err
	}

	pageMatches := gotenbergPagePattern.FindAllSubmatch(content, -1)
	pages := make([]inspectedGotenbergPage, 0, len(pageMatches))
	for _, match := range pageMatches {
		width, err := strconv.ParseFloat(string(match[1]), 64)
		if err != nil {
			return nil, fmt.Errorf("parse PDF page width: %w", err)
		}
		height, err := strconv.ParseFloat(string(match[2]), 64)
		if err != nil {
			return nil, fmt.Errorf("parse PDF page height: %w", err)
		}
		contentObject, err := strconv.Atoi(string(match[3]))
		if err != nil {
			return nil, fmt.Errorf("parse PDF page content object: %w", err)
		}
		stream, err := decodeGotenbergPDFStream(objects[contentObject])
		if err != nil {
			return nil, fmt.Errorf("decode PDF page stream: %w", err)
		}

		pages = append(pages, inspectedGotenbergPage{
			width:  width,
			height: height,
			text:   decodeGotenbergPageText(stream, characters),
		})
	}

	return pages, nil
}

func gotenbergCharacterMap(objects map[int][]byte) (map[string]string, error) {
	characters := make(map[string]string)
	for _, object := range objects {
		match := gotenbergToUnicodePattern.FindSubmatch(object)
		if match == nil {
			continue
		}

		objectNumber, err := strconv.Atoi(string(match[1]))
		if err != nil {
			return nil, fmt.Errorf("parse ToUnicode object number: %w", err)
		}
		stream, err := decodeGotenbergPDFStream(objects[objectNumber])
		if err != nil {
			return nil, fmt.Errorf("decode ToUnicode stream: %w", err)
		}
		if err := addGotenbergBFChars(characters, stream); err != nil {
			return nil, err
		}
		if err := addGotenbergBFRanges(characters, stream); err != nil {
			return nil, err
		}
	}

	return characters, nil
}

func addGotenbergBFChars(characters map[string]string, stream []byte) error {
	for _, block := range gotenbergBFCharBlockPattern.FindAllSubmatch(stream, -1) {
		for _, pair := range gotenbergBFCharPairPattern.FindAllSubmatch(block[1], -1) {
			decoded, err := decodeGotenbergUTF16Hex(pair[2])
			if err != nil {
				return fmt.Errorf("decode bfchar: %w", err)
			}
			characters[strings.ToUpper(string(pair[1]))] = decoded
		}
	}

	return nil
}

func addGotenbergBFRanges(characters map[string]string, stream []byte) error {
	for _, block := range gotenbergBFRangeBlockPattern.FindAllSubmatch(stream, -1) {
		for _, value := range gotenbergBFRangePattern.FindAllSubmatch(block[1], -1) {
			start, err := strconv.ParseUint(string(value[1]), 16, 32)
			if err != nil {
				return fmt.Errorf("parse bfrange start: %w", err)
			}
			end, err := strconv.ParseUint(string(value[2]), 16, 32)
			if err != nil {
				return fmt.Errorf("parse bfrange end: %w", err)
			}
			destination, err := hex.DecodeString(string(value[3]))
			if err != nil {
				return fmt.Errorf("decode bfrange destination: %w", err)
			}
			if len(destination) < 2 || len(destination)%2 != 0 {
				return fmt.Errorf("invalid bfrange destination length: %d", len(destination))
			}

			for source := start; source <= end; source++ {
				current := append([]byte(nil), destination...)
				offset := source - start
				last := uint16(current[len(current)-2])<<8 |
					uint16(current[len(current)-1])
				last += uint16(offset)
				current[len(current)-2] = byte(last >> 8)
				current[len(current)-1] = byte(last)
				characters[fmt.Sprintf("%0*X", len(value[1]), source)] =
					decodeGotenbergUTF16(current)
			}
		}
	}

	return nil
}

func decodeGotenbergPageText(stream []byte, characters map[string]string) string {
	codeLengths := make([]int, 0)
	seenLengths := make(map[int]struct{})
	for code := range characters {
		if _, exists := seenLengths[len(code)]; exists {
			continue
		}
		seenLengths[len(code)] = struct{}{}
		codeLengths = append(codeLengths, len(code))
	}
	sort.Sort(sort.Reverse(sort.IntSlice(codeLengths)))

	var text strings.Builder
	for _, match := range gotenbergTextPattern.FindAllSubmatch(stream, -1) {
		encoded := strings.ToUpper(string(match[1]))
		for len(encoded) > 0 {
			matched := false
			for _, length := range codeLengths {
				if len(encoded) < length {
					continue
				}
				if character, ok := characters[encoded[:length]]; ok {
					text.WriteString(character)
					encoded = encoded[length:]
					matched = true
					break
				}
			}
			if !matched {
				break
			}
		}
	}

	return text.String()
}

func decodeGotenbergPDFStream(object []byte) ([]byte, error) {
	streamMarker := []byte("stream")
	streamStart := bytes.Index(object, streamMarker)
	if streamStart < 0 {
		return nil, errors.New("PDF object has no stream")
	}
	streamStart += len(streamMarker)
	if len(object) > streamStart && object[streamStart] == '\r' {
		streamStart++
	}
	if len(object) > streamStart && object[streamStart] == '\n' {
		streamStart++
	}
	streamEnd := bytes.LastIndex(object, []byte("endstream"))
	if streamEnd < streamStart {
		return nil, errors.New("PDF object has invalid stream boundaries")
	}
	stream := object[streamStart:streamEnd]
	if !bytes.Contains(object[:streamStart], []byte("/FlateDecode")) {
		return stream, nil
	}

	reader, err := zlib.NewReader(bytes.NewReader(stream))
	if err != nil {
		return nil, fmt.Errorf("open zlib stream: %w", err)
	}
	defer func() {
		_ = reader.Close()
	}()

	decoded, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read zlib stream: %w", err)
	}

	return decoded, nil
}

func decodeGotenbergUTF16Hex(value []byte) (string, error) {
	decoded, err := hex.DecodeString(string(value))
	if err != nil {
		return "", err
	}

	return decodeGotenbergUTF16(decoded), nil
}

func decodeGotenbergUTF16(value []byte) string {
	codeUnits := make([]uint16, 0, len(value)/2)
	for index := 0; index+1 < len(value); index += 2 {
		codeUnits = append(
			codeUnits,
			uint16(value[index])<<8|uint16(value[index+1]),
		)
	}

	return string(utf16.Decode(codeUnits))
}

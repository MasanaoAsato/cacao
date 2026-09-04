package bookletpdf

import (
	"context"
	"errors"
	"testing"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

func TestStubRender(t *testing.T) {
	request, err := domainservice.NewBookletRenderRequest(value_object.NewID(), nil)
	if err != nil {
		t.Fatalf("NewBookletRenderRequest() error = %v", err)
	}
	renderer := NewStub(int64(len(stubPDF)))

	first, err := renderer.Render(context.Background(), request)
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}
	if err := domainservice.ValidateRenderedBooklet(first, int64(len(first.Content))); err != nil {
		t.Fatalf("ValidateRenderedBooklet() error = %v", err)
	}
	if first.MediaType != domainservice.BookletPDFMediaType {
		t.Errorf("MediaType = %q, want %q", first.MediaType, domainservice.BookletPDFMediaType)
	}

	first.Content[0] = 'x'
	second, err := renderer.Render(context.Background(), request)
	if err != nil {
		t.Fatalf("second Render() error = %v", err)
	}
	if second.Content[0] != '%' {
		t.Errorf("second Render() content was shared: first byte = %q", second.Content[0])
	}
}

func TestStubRenderReturnsContextError(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	request, err := domainservice.NewBookletRenderRequest(value_object.NewID(), nil)
	if err != nil {
		t.Fatalf("NewBookletRenderRequest() error = %v", err)
	}

	_, err = NewStub(int64(len(stubPDF))).Render(ctx, request)
	if !errors.Is(err, domainservice.ErrBookletRenderFailed) {
		t.Errorf("Render() error = %v, want ErrBookletRenderFailed", err)
	}
}

func TestStubRenderRejectsContentLargerThanConfiguredMaximum(t *testing.T) {
	request, err := domainservice.NewBookletRenderRequest(value_object.NewID(), nil)
	if err != nil {
		t.Fatalf("NewBookletRenderRequest() error = %v", err)
	}

	_, err = NewStub(int64(len(stubPDF)-1)).Render(context.Background(), request)
	if !errors.Is(err, domainservice.ErrRenderedBookletInvalid) {
		t.Errorf("Render() error = %v, want ErrRenderedBookletInvalid", err)
	}
}

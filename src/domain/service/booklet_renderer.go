package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"cacao/src/domain/value_object"
)

const BookletPDFMediaType = "application/pdf"

var (
	ErrBookletRendererBusy    = errors.New("booklet renderer busy")
	ErrBookletRenderTimeout   = errors.New("booklet render timeout")
	ErrBookletRenderFailed    = errors.New("booklet render failed")
	ErrRenderedBookletInvalid = errors.New("rendered booklet invalid")
)

// BookletRenderRequest はしおりPDFの描画条件を表す。
type BookletRenderRequest struct {
	journeyID value_object.ID
	seed      *value_object.ThemeSeed
}

// NewBookletRenderRequest は有効な描画条件を生成する。
func NewBookletRenderRequest(
	journeyID value_object.ID,
	seed *value_object.ThemeSeed,
) (BookletRenderRequest, error) {
	if journeyID.IsEmpty() {
		return BookletRenderRequest{}, errors.New("booklet render journey id must not be empty")
	}
	if seed != nil && seed.IsEmpty() {
		return BookletRenderRequest{}, errors.New("booklet render theme seed must not be empty")
	}

	return BookletRenderRequest{
		journeyID: journeyID,
		seed:      seed,
	}, nil
}

// JourneyID は描画対象の旅程IDを返す。
func (r BookletRenderRequest) JourneyID() value_object.ID {
	return r.journeyID
}

// ThemeSeed は指定済みのテーマシードを返す。
func (r BookletRenderRequest) ThemeSeed() (value_object.ThemeSeed, bool) {
	if r.seed == nil {
		return value_object.ThemeSeed{}, false
	}

	return *r.seed, true
}

// RenderedBooklet は描画済みのPDFバイト列を表す。
type RenderedBooklet struct {
	Content   []byte
	MediaType string
}

// BookletRenderer は画面をPDFへ描画するためのポートである。
type BookletRenderer interface {
	Render(ctx context.Context, request BookletRenderRequest) (RenderedBooklet, error)
}

// ValidateRenderedBooklet はPDFの最小限の形式とサイズを検証する。
func ValidateRenderedBooklet(booklet RenderedBooklet, maxBytes int64) error {
	if booklet.MediaType != BookletPDFMediaType {
		return fmt.Errorf("%w: unsupported media type %q", ErrRenderedBookletInvalid, booklet.MediaType)
	}
	if maxBytes < 1 {
		return fmt.Errorf("%w: maximum bytes must be positive", ErrRenderedBookletInvalid)
	}
	if len(booklet.Content) == 0 {
		return fmt.Errorf("%w: content must not be empty", ErrRenderedBookletInvalid)
	}
	if int64(len(booklet.Content)) > maxBytes {
		return fmt.Errorf("%w: content exceeds maximum bytes", ErrRenderedBookletInvalid)
	}
	if !bytes.HasPrefix(booklet.Content, []byte("%PDF-")) {
		return fmt.Errorf("%w: content does not begin with PDF header", ErrRenderedBookletInvalid)
	}

	return nil
}

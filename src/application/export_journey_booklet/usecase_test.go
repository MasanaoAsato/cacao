package exportjourneybooklet

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"cacao/src/application"
	"cacao/src/domain/entity"
	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

type rendererFake struct {
	err      error
	rendered domainservice.RenderedBooklet
	request  domainservice.BookletRenderRequest
	calls    int
}

func (f *rendererFake) Render(
	_ context.Context,
	request domainservice.BookletRenderRequest,
) (domainservice.RenderedBooklet, error) {
	f.calls++
	f.request = request
	return f.rendered, f.err
}

var _ domainservice.BookletRenderer = (*rendererFake)(nil)

func TestUseCaseExecute(t *testing.T) {
	journey := testkit.MustNewJourney(t)
	coverImage := readyCoverImage(t, journey.RequestID())
	renderer := &rendererFake{
		rendered: domainservice.RenderedBooklet{
			Content:   []byte("%PDF-1.4\n"),
			MediaType: domainservice.BookletPDFMediaType,
		},
	}
	useCase := NewUseCase(
		fakes.NewJourneyRepositoryWith(t, journey),
		fakes.NewJourneyImageRepositoryWith(t, coverImage),
		renderer,
	)

	output, err := useCase.Execute(context.Background(), Input{
		JourneyID: journey.ID().String(),
		Seed:      "V1-ABCDEF12",
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if got, want := string(output.Content), "%PDF-1.4\n"; got != want {
		t.Errorf("Content = %q, want %q", got, want)
	}
	if got, want := output.MediaType, domainservice.BookletPDFMediaType; got != want {
		t.Errorf("MediaType = %q, want %q", got, want)
	}
	if got, want := output.FileName, "journey-booklet-"+journey.ID().String()+".pdf"; got != want {
		t.Errorf("FileName = %q, want %q", got, want)
	}
	if renderer.calls != 1 {
		t.Fatalf("Render() calls = %d, want 1", renderer.calls)
	}
	if got, want := renderer.request.JourneyID().String(), journey.ID().String(); got != want {
		t.Errorf("render request journey ID = %q, want %q", got, want)
	}
	seed, ok := renderer.request.ThemeSeed()
	if !ok {
		t.Fatal("render request seed is missing")
	}
	if got, want := seed.String(), "v1-abcdef12"; got != want {
		t.Errorf("render request seed = %q, want %q", got, want)
	}
}

func TestUseCaseExecuteRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name  string
		input Input
	}{
		{
			name:  "異常系: UUIDではない旅程ID",
			input: Input{JourneyID: "not-a-uuid"},
		},
		{
			name: "境界値系: 7桁のテーマシード",
			input: Input{
				JourneyID: value_object.NewID().String(),
				Seed:      "v1-abcdef1",
			},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			renderer := &rendererFake{}
			useCase := NewUseCase(
				fakes.NewJourneyRepository(),
				fakes.NewJourneyImageRepository(),
				renderer,
			)

			_, err := useCase.Execute(context.Background(), testCase.input)
			if !errors.Is(err, application.ErrInvalidInput) {
				t.Errorf("Execute() error = %v, want ErrInvalidInput", err)
			}
			if renderer.calls != 0 {
				t.Errorf("Render() calls = %d, want 0", renderer.calls)
			}
		})
	}
}

func TestUseCaseExecuteChecksPrerequisites(t *testing.T) {
	journey := testkit.MustNewJourney(t)
	pendingCover := testkit.MustNewPendingImageFor(
		t,
		journey.RequestID(),
		testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1),
	)

	tests := []struct {
		name        string
		journeyRepo *fakes.FakeJourneyRepository
		imageRepo   *fakes.FakeJourneyImageRepository
		wantError   error
	}{
		{
			name:        "異常系: 旅程が存在しない",
			journeyRepo: fakes.NewJourneyRepository(),
			imageRepo:   fakes.NewJourneyImageRepository(),
			wantError:   application.ErrJourneyNotFound,
		},
		{
			name:        "異常系: 表紙画像が存在しない",
			journeyRepo: fakes.NewJourneyRepositoryWith(t, journey),
			imageRepo:   fakes.NewJourneyImageRepository(),
			wantError:   application.ErrJourneyImageNotReady,
		},
		{
			name:        "異常系: 表紙画像が未準備",
			journeyRepo: fakes.NewJourneyRepositoryWith(t, journey),
			imageRepo:   fakes.NewJourneyImageRepositoryWith(t, pendingCover),
			wantError:   application.ErrJourneyImageNotReady,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			renderer := &rendererFake{}
			useCase := NewUseCase(testCase.journeyRepo, testCase.imageRepo, renderer)

			_, err := useCase.Execute(context.Background(), Input{JourneyID: journey.ID().String()})
			if !errors.Is(err, testCase.wantError) {
				t.Errorf("Execute() error = %v, want %v", err, testCase.wantError)
			}
			if renderer.calls != 0 {
				t.Errorf("Render() calls = %d, want 0", renderer.calls)
			}
		})
	}
}

func TestUseCaseExecuteMapsRendererErrors(t *testing.T) {
	journey := testkit.MustNewJourney(t)
	coverImage := readyCoverImage(t, journey.RequestID())
	tests := []struct {
		name      string
		renderErr error
		wantError error
	}{
		{
			name:      "異常系: 同時実行枠が埋まっている",
			renderErr: fmt.Errorf("%w: one active render", domainservice.ErrBookletRendererBusy),
			wantError: application.ErrBookletRendererBusy,
		},
		{
			name:      "異常系: 描画がタイムアウトする",
			renderErr: fmt.Errorf("%w: %w", domainservice.ErrBookletRenderTimeout, context.DeadlineExceeded),
			wantError: application.ErrBookletRenderFailed,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			renderer := &rendererFake{err: testCase.renderErr}
			useCase := NewUseCase(
				fakes.NewJourneyRepositoryWith(t, journey),
				fakes.NewJourneyImageRepositoryWith(t, coverImage),
				renderer,
			)

			_, err := useCase.Execute(context.Background(), Input{JourneyID: journey.ID().String()})
			if !errors.Is(err, testCase.wantError) {
				t.Errorf("Execute() error = %v, want %v", err, testCase.wantError)
			}
		})
	}
}

func readyCoverImage(t *testing.T, requestID value_object.ID) entity.JourneyImage {
	t.Helper()

	image := testkit.MustNewPendingImageFor(
		t,
		requestID,
		testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1),
	)
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := image.Complete(
		testkit.MustNewAssetReference(t),
		value_object.ImageVisualStyleEditorialPhotograph,
	); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}

	return image
}

package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	exportjourneybooklet "cacao/src/application/export_journey_booklet"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/bookletpdf"
	"cacao/src/infrastructure/config"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"

	"github.com/gin-gonic/gin"
)

func TestBookletPDFEndpointWithStubRenderer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	journey := testkit.MustNewJourney(t)
	coverImage := testkit.MustNewPendingImageFor(
		t,
		journey.RequestID(),
		testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1),
	)
	if err := coverImage.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := coverImage.Complete(testkit.MustNewAssetReference(t)); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}

	useCase := exportjourneybooklet.NewUseCase(
		fakes.NewJourneyRepositoryWith(t, journey),
		fakes.NewJourneyImageRepositoryWith(t, coverImage),
		bookletpdf.NewStub(config.DefaultBookletPDFMaxBytes),
	)
	router := NewRouter(Dependencies{ExportJourneyBooklet: useCase})
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/journeys/"+journey.ID().String()+"/booklet.pdf?seed=v1-abcdef12",
		nil,
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if got, want := response.Header().Get("Content-Type"), "application/pdf"; got != want {
		t.Errorf("Content-Type = %q, want %q", got, want)
	}
	if got, want := response.Header().Get("Content-Disposition"), "attachment; filename=\"journey-booklet-"+journey.ID().String()+".pdf\""; got != want {
		t.Errorf("Content-Disposition = %q, want %q", got, want)
	}
	if got, want := response.Header().Get("Cache-Control"), "no-store"; got != want {
		t.Errorf("Cache-Control = %q, want %q", got, want)
	}
	if !strings.HasPrefix(response.Body.String(), "%PDF-") {
		t.Errorf("response body does not begin with PDF header")
	}
}

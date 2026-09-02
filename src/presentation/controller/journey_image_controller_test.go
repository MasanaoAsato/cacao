package controller

import (
	"bytes"
	"cacao/src/application/readmodel"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"cacao/src/application"
	getjourneyimage "cacao/src/application/get_journey_image"
	getjourneyimagecontent "cacao/src/application/get_journey_image_content"
	listjourneyimages "cacao/src/application/list_journey_images"
	requestjourneyimages "cacao/src/application/request_journey_images"
	retryjourneyimage "cacao/src/application/retry_journey_image"

	"github.com/gin-gonic/gin"
)

type imageRequestUseCaseMock struct {
	output requestjourneyimages.Output
	err    error
	input  requestjourneyimages.Input
}

func (m *imageRequestUseCaseMock) Execute(
	_ context.Context,
	input requestjourneyimages.Input,
) (requestjourneyimages.Output, error) {
	m.input = input
	return m.output, m.err
}

type imageListUseCaseMock struct {
	output listjourneyimages.Output
	err    error
}

func (m *imageListUseCaseMock) Execute(
	_ context.Context,
	_ listjourneyimages.Input,
) (listjourneyimages.Output, error) {
	return m.output, m.err
}

type imageGetUseCaseMock struct {
	output getjourneyimage.Output
	err    error
}

func (m *imageGetUseCaseMock) Execute(
	_ context.Context,
	_ getjourneyimage.Input,
) (getjourneyimage.Output, error) {
	return m.output, m.err
}

type imageContentUseCaseMock struct {
	content []byte
	err     error
}

func (m *imageContentUseCaseMock) Execute(
	_ context.Context,
	_ getjourneyimagecontent.Input,
) (getjourneyimagecontent.Output, error) {
	if m.err != nil {
		return getjourneyimagecontent.Output{}, m.err
	}

	return getjourneyimagecontent.Output{
		Content:   io.NopCloser(bytes.NewReader(m.content)),
		MediaType: "image/png",
		ETag:      "image-1",
	}, nil
}

type imageRetryUseCaseMock struct {
	output retryjourneyimage.Output
	err    error
}

func (m *imageRetryUseCaseMock) Execute(
	_ context.Context,
	_ retryjourneyimage.Input,
) (retryjourneyimage.Output, error) {
	return m.output, m.err
}

func TestHandleRequestJourneyImagesReturnsAcceptedWithPollingHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useCase := &imageRequestUseCaseMock{
		output: requestjourneyimages.Output{
			JourneyRequestID: "request-1",
			Images: []readmodel.JourneyImageDTO{
				{ID: "image-1", Slot: readmodel.SlotDTO{Purpose: "cover", Ordinal: 1}, Status: "pending"},
			},
		},
	}
	router := gin.New()
	router.POST("/api/v1/journey-requests/:request_id/images", HandleRequestJourneyImages(useCase))

	body := []byte(`{"slots":[{"purpose":"cover","ordinal":1},{"purpose":"illustration","ordinal":1},{"purpose":"illustration","ordinal":2},{"purpose":"illustration","ordinal":3}]}`)
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/journey-requests/request-1/images",
		bytes.NewReader(body),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d: %s", response.Code, http.StatusAccepted, response.Body.String())
	}
	if response.Header().Get("Location") != "/api/v1/journey-requests/request-1/images" {
		t.Errorf("Location = %q", response.Header().Get("Location"))
	}
	if response.Header().Get("Retry-After") != "2" {
		t.Errorf("Retry-After = %q, want 2", response.Header().Get("Retry-After"))
	}
	if len(useCase.input.Slots) != 4 {
		t.Fatalf("slot count = %d, want 4", len(useCase.input.Slots))
	}

	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["images"] == nil {
		t.Fatal("images is missing")
	}
}

func TestHandleRequestJourneyImagesRejectsInvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/images", HandleRequestJourneyImages(&imageRequestUseCaseMock{}))

	request := httptest.NewRequest(http.MethodPost, "/images", bytes.NewBufferString("invalid"))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte("invalid input")) {
		t.Fatalf("response = %s, want invalid input", response.Body.String())
	}
}

func TestHandleGetJourneyImageContentSupportsETag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useCase := &imageContentUseCaseMock{content: []byte("png-content")}
	router := gin.New()
	router.GET("/images/:image_id/content", HandleGetJourneyImageContent(useCase))

	request := httptest.NewRequest(http.MethodGet, "/images/image-1/content", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if response.Header().Get("ETag") != `"image-1"` {
		t.Errorf("ETag = %q, want %q", response.Header().Get("ETag"), `"image-1"`)
	}
	if response.Header().Get("Cache-Control") != "max-age=86400, immutable" {
		t.Errorf("Cache-Control = %q", response.Header().Get("Cache-Control"))
	}
	if response.Body.String() != "png-content" {
		t.Errorf("body = %q, want png-content", response.Body.String())
	}

	notModified := httptest.NewRequest(http.MethodGet, "/images/image-1/content", nil)
	notModified.Header.Set("If-None-Match", `"image-1"`)
	notModifiedResponse := httptest.NewRecorder()
	router.ServeHTTP(notModifiedResponse, notModified)
	if notModifiedResponse.Code != http.StatusNotModified {
		t.Fatalf("conditional status = %d, want %d", notModifiedResponse.Code, http.StatusNotModified)
	}
}

func TestNewRouterRegistersImageRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := NewRouter(Dependencies{
		Images: ImageRoutes{
			Request: &imageRequestUseCaseMock{},
			List:    &imageListUseCaseMock{},
			Get:     &imageGetUseCaseMock{},
			Content: &imageContentUseCaseMock{},
			Retry:   &imageRetryUseCaseMock{},
		},
	})

	cases := []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/api/v1/journey-requests/request-1/images"},
		{method: http.MethodGet, path: "/api/v1/journey-requests/request-1/images"},
		{method: http.MethodGet, path: "/api/v1/journey-images/image-1"},
		{method: http.MethodGet, path: "/api/v1/journey-images/image-1/content"},
		{method: http.MethodPost, path: "/api/v1/journey-images/image-1/retry"},
	}
	for _, testCase := range cases {
		t.Run(testCase.method+testCase.path, func(t *testing.T) {
			request := httptest.NewRequest(testCase.method, testCase.path, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code == http.StatusNotFound {
				t.Fatalf("route %s %s is not registered", testCase.method, testCase.path)
			}
		})
	}
}

func TestHandleRequestJourneyImagesMapsApplicationError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/images", HandleRequestJourneyImages(&imageRequestUseCaseMock{
		err: application.ErrRequestNotFound,
	}))

	request := httptest.NewRequest(
		http.MethodPost,
		"/images",
		bytes.NewBufferString(`{"slots":[{"purpose":"cover","ordinal":1}]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
	}
}

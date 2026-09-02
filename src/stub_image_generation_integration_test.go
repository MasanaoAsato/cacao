//go:build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourneyimage "cacao/src/application/generate_journey_image"
	getjourneyimage "cacao/src/application/get_journey_image"
	getjourneyimagecontent "cacao/src/application/get_journey_image_content"
	listjourneyimages "cacao/src/application/list_journey_images"
	requestjourneyimages "cacao/src/application/request_journey_images"
	retryjourneyimage "cacao/src/application/retry_journey_image"
	domainservice "cacao/src/domain/service"
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/database"
	"cacao/src/infrastructure/event"
	"cacao/src/infrastructure/imagegen"
	"cacao/src/infrastructure/imagestore/fsstore"
	"cacao/src/infrastructure/repository/postgres"
	"cacao/src/infrastructure/worker"
	"cacao/src/presentation/controller"
)

func TestStubImageGenerationHTTPIntegration(t *testing.T) {
	databaseConfig, err := config.DatabaseFromEnv()
	if err != nil {
		t.Fatalf("config.DatabaseFromEnv() error = %v", err)
	}
	db, err := database.CreateGORMClient(context.Background(), databaseConfig)
	if err != nil {
		t.Fatalf("database.CreateGORMClient() error = %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB() error = %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	requestRepo := postgres.NewJourneyRequestRepository(db)
	imageRepo := postgres.NewJourneyImageRepository(db)
	storage, err := fsstore.New(config.ImageStorage{
		Driver: config.ImageStorageFilesystem,
		Root:   t.TempDir(),
		Limits: config.ImageLimits{MaxBytes: 20 * 1024 * 1024, MaxWidth: 4096, MaxHeight: 4096, MaxPixels: 16 * 1024 * 1024},
	})
	if err != nil {
		t.Fatalf("fsstore.New() error = %v", err)
	}
	t.Cleanup(func() { _ = storage.Close() })

	imageGenerator := newBlockingIntegrationImageGenerator(imagegen.NewStub())
	t.Cleanup(imageGenerator.releaseGeneration)
	generateImageUC, err := generatejourneyimage.NewUseCase(
		imageRepo,
		requestRepo,
		imageGenerator,
		storage,
		generatejourneyimage.Config{
			GenerationTimeout: time.Second,
			LeaseDuration:     2 * time.Second,
		},
	)
	if err != nil {
		t.Fatalf("generatejourneyimage.NewUseCase() error = %v", err)
	}
	imageWorker, err := worker.NewJourneyImageWorker(
		worker.Config{
			PollInterval:      100 * time.Millisecond,
			BatchSize:         1,
			Concurrency:       1,
			RecoveryBatchSize: 1,
		},
		imageRepo,
		generateImageUC,
	)
	if err != nil {
		t.Fatalf("worker.NewJourneyImageWorker() error = %v", err)
	}

	stopPolling := make(chan struct{})
	workerResult := make(chan error, 1)
	go func() {
		workerResult <- imageWorker.Run(context.Background(), stopPolling)
	}()
	defer func() {
		close(stopPolling)
		select {
		case <-workerResult:
		case <-time.After(5 * time.Second):
			t.Error("image worker did not stop within 5s")
		}
	}()

	createRequestUC := createjourneyrequest.NewUseCase(requestRepo, event.NewPublisherMock())
	requestImagesUC := requestjourneyimages.NewUseCase(requestRepo, imageRepo)
	listImagesUC := listjourneyimages.NewUseCase(requestRepo, imageRepo)
	getImageUC := getjourneyimage.NewUseCase(imageRepo)
	getContentUC := getjourneyimagecontent.NewUseCase(imageRepo, storage)
	retryImageUC := retryjourneyimage.NewUseCase(imageRepo)
	router := controller.NewRouter(controller.Dependencies{
		CreateJourneyRequest: createRequestUC,
		Images: controller.ImageRoutes{
			Request: requestImagesUC,
			List:    listImagesUC,
			Get:     getImageUC,
			Content: getContentUC,
			Retry:   retryImageUC,
		},
	})
	server := httptest.NewServer(router)
	defer server.Close()

	requestID := createJourneyRequestHTTP(t, server.Client(), server.URL)
	imageRequestBody := []byte(`{"slots":[{"purpose":"cover","ordinal":1}]}`)
	statusCode, firstResponse := requestJourneyImagesHTTP(t, server.Client(), server.URL, requestID, imageRequestBody)
	if statusCode != http.StatusAccepted {
		t.Fatalf("request images status = %d, want %d", statusCode, http.StatusAccepted)
	}
	if len(firstResponse.Images) != 1 {
		t.Fatalf("requested image count = %d, want 1", len(firstResponse.Images))
	}
	if firstResponse.Images[0].Status != "pending" {
		t.Fatalf("initial image status = %q, want pending", firstResponse.Images[0].Status)
	}
	imageID := firstResponse.Images[0].ID

	imageGenerator.waitStarted(t)
	processingResponse := listJourneyImagesHTTP(t, server.Client(), server.URL, requestID)
	if len(processingResponse.Images) != 1 {
		t.Fatalf("processing image count = %d, want 1", len(processingResponse.Images))
	}
	if processingResponse.Images[0].Status != "processing" {
		t.Fatalf("processing image status = %q, want processing", processingResponse.Images[0].Status)
	}
	imageGenerator.releaseGeneration()

	readyImage := waitForReadyImage(t, server.Client(), server.URL, requestID)
	if readyImage.ID != imageID {
		t.Fatalf("ready image ID = %q, want %q", readyImage.ID, imageID)
	}
	if readyImage.ContentURL == nil {
		t.Fatal("ready image content_url is nil")
	}

	assertImageContentHTTP(t, server.Client(), server.URL+*readyImage.ContentURL, imageID)

	duplicateStatus, duplicateResponse := requestJourneyImagesHTTP(
		t,
		server.Client(),
		server.URL,
		requestID,
		imageRequestBody,
	)
	if duplicateStatus != http.StatusOK {
		t.Fatalf("duplicate request status = %d, want %d", duplicateStatus, http.StatusOK)
	}
	if len(duplicateResponse.Images) != 1 || duplicateResponse.Images[0].ID != imageID {
		t.Fatalf("duplicate image response = %+v, want same image ID %q", duplicateResponse.Images, imageID)
	}
}

func TestStubImageGenerationProcessIntegration(t *testing.T) {
	app := startIntegrationApp(t)
	client := &http.Client{Timeout: 5 * time.Second}
	baseURL := "http://127.0.0.1:8080"

	requestID := createJourneyRequestHTTP(t, client, baseURL)
	imageRequestBody := []byte(`{"slots":[{"purpose":"cover","ordinal":1}]}`)
	statusCode, firstResponse := requestJourneyImagesHTTP(t, client, baseURL, requestID, imageRequestBody)
	if statusCode != http.StatusAccepted {
		t.Fatalf("process request images status = %d, want %d", statusCode, http.StatusAccepted)
	}
	if len(firstResponse.Images) != 1 {
		t.Fatalf("process requested image count = %d, want 1", len(firstResponse.Images))
	}

	readyImage := waitForReadyImage(t, client, baseURL, requestID)
	if readyImage.ContentURL == nil {
		t.Fatal("process ready image content_url is nil")
	}
	assertImageContentHTTP(t, client, baseURL+*readyImage.ContentURL, readyImage.ID)

	app.stop(t)
}

type blockingIntegrationImageGenerator struct {
	inner       domainservice.ImageGenerator
	started     chan struct{}
	release     chan struct{}
	startedOnce sync.Once
	releaseOnce sync.Once
}

func newBlockingIntegrationImageGenerator(
	inner domainservice.ImageGenerator,
) *blockingIntegrationImageGenerator {
	return &blockingIntegrationImageGenerator{
		inner:   inner,
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
}

func (g *blockingIntegrationImageGenerator) Generate(
	ctx context.Context,
	brief domainservice.ImageBrief,
) (domainservice.GeneratedImage, error) {
	g.startedOnce.Do(func() { close(g.started) })
	select {
	case <-g.release:
		return g.inner.Generate(ctx, brief)
	case <-ctx.Done():
		return domainservice.GeneratedImage{}, ctx.Err()
	}
}

func (g *blockingIntegrationImageGenerator) waitStarted(t *testing.T) {
	t.Helper()
	select {
	case <-g.started:
	case <-time.After(5 * time.Second):
		t.Fatal("stub image generation did not start within 5s")
	}
}

func (g *blockingIntegrationImageGenerator) releaseGeneration() {
	g.releaseOnce.Do(func() { close(g.release) })
}

func assertImageContentHTTP(
	t *testing.T,
	client *http.Client,
	contentURL string,
	imageID string,
) {
	t.Helper()
	request, err := http.NewRequest(http.MethodGet, contentURL, nil)
	if err != nil {
		t.Fatalf("create content request: %v", err)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("get image content: %v", err)
	}
	content, readErr := io.ReadAll(response.Body)
	closeErr := response.Body.Close()
	if readErr != nil || closeErr != nil {
		t.Fatalf("read image content: read=%v close=%v", readErr, closeErr)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("content status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if response.Header.Get("Content-Type") != "image/png" {
		t.Errorf("content type = %q, want image/png", response.Header.Get("Content-Type"))
	}
	if response.Header.Get("ETag") != fmt.Sprintf("%q", imageID) {
		t.Errorf("content ETag = %q, want %q", response.Header.Get("ETag"), fmt.Sprintf("%q", imageID))
	}
	decoded, format, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		t.Fatalf("decode image content: %v", err)
	}
	if format != "png" {
		t.Errorf("decoded image format = %q, want png", format)
	}
	if decoded.Bounds().Dx() < 1 || decoded.Bounds().Dy() < 1 {
		t.Errorf("decoded image bounds = %v, want a non-empty image", decoded.Bounds())
	}
}

type integrationProcess struct {
	cmd    *exec.Cmd
	output *bytes.Buffer
	done   chan struct{}
	mu     sync.Mutex
	err    error
}

func startIntegrationApp(t *testing.T) *integrationProcess {
	t.Helper()
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller() failed")
	}
	sourceDir := filepath.Dir(sourceFile)
	binaryPath := filepath.Join(t.TempDir(), "cacao")
	build := exec.Command("go", "build", "-o", binaryPath, ".")
	build.Dir = sourceDir
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build integration app: %v: %s", err, output)
	}

	command := exec.Command(binaryPath)
	command.Dir = sourceDir
	environment := os.Environ()
	for key, value := range map[string]string{
		"IMAGE_GENERATOR_DRIVER":      "stub",
		"LLM_DRIVER":                  "stub",
		"IMAGE_STORAGE_DRIVER":        "filesystem",
		"IMAGE_STORAGE_ROOT":          t.TempDir(),
		"IMAGE_GENERATION_TIMEOUT":    "1s",
		"IMAGE_WORKER_POLL_INTERVAL":  "1s",
		"IMAGE_WORKER_LEASE_DURATION": "2s",
	} {
		environment = setIntegrationEnv(environment, key, value)
	}
	command.Env = environment
	output := &bytes.Buffer{}
	command.Stdout = output
	command.Stderr = output
	if err := command.Start(); err != nil {
		t.Fatalf("start integration app: %v", err)
	}

	process := &integrationProcess{
		cmd:    command,
		output: output,
		done:   make(chan struct{}),
	}
	go func() {
		err := command.Wait()
		process.mu.Lock()
		process.err = err
		process.mu.Unlock()
		close(process.done)
	}()
	t.Cleanup(func() { process.stop(t) })
	process.waitUntilReady(t, "http://127.0.0.1:8080")

	return process
}

func setIntegrationEnv(environment []string, key string, value string) []string {
	prefix := key + "="
	for index, setting := range environment {
		if strings.HasPrefix(setting, prefix) {
			environment[index] = prefix + value
			return environment
		}
	}

	return append(environment, prefix+value)
}

func (p *integrationProcess) waitUntilReady(t *testing.T, baseURL string) {
	t.Helper()
	client := &http.Client{Timeout: time.Second}
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-p.done:
			t.Fatalf("integration app exited before ready: %v\n%s", p.processError(), p.output.String())
		default:
		}

		request, err := http.NewRequest(http.MethodGet, baseURL+"/api/v1/journey-requests", nil)
		if err != nil {
			t.Fatalf("create readiness request: %v", err)
		}
		response, err := client.Do(request)
		if err == nil {
			_, _ = io.Copy(io.Discard, response.Body)
			_ = response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("integration app did not become ready within 15s: %s", p.output.String())
}

func (p *integrationProcess) stop(t *testing.T) {
	t.Helper()
	select {
	case <-p.done:
		return
	default:
	}
	if err := p.cmd.Process.Signal(syscall.SIGTERM); err != nil {
		select {
		case <-p.done:
			return
		default:
			t.Errorf("send SIGTERM to integration app: %v", err)
		}
	}
	select {
	case <-p.done:
	case <-time.After(15 * time.Second):
		_ = p.cmd.Process.Kill()
		<-p.done
		t.Errorf("integration app did not stop within 15s")
	}
	if err := p.processError(); err != nil {
		t.Errorf("integration app exited with error: %v\n%s", err, p.output.String())
	}
}

func (p *integrationProcess) processError() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.err
}

type integrationImageListResponse struct {
	Images []integrationImageResponse `json:"images"`
}

type integrationImageResponse struct {
	ID         string  `json:"id"`
	Status     string  `json:"status"`
	ContentURL *string `json:"content_url"`
}

func createJourneyRequestHTTP(t *testing.T, client *http.Client, baseURL string) string {
	t.Helper()

	body := []byte(`{"departure_city":"東京","departure_country":"日本","destination_city":"沖縄","destination_country":"日本","start_date":"2026-08-01T00:00:00Z","end_date":"2026-08-03T00:00:00Z","amount":100000,"currency":"JPY"}`)
	request, err := http.NewRequest(http.MethodPost, baseURL+"/api/v1/journey-requests", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create journey request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("post journey request: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("create journey request status = %d: %s", response.StatusCode, data)
	}

	var payload struct {
		RequestID string `json:"request_id"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("decode create journey request: %v", err)
	}
	if payload.RequestID == "" {
		t.Fatal("create journey request returned empty ID")
	}

	return payload.RequestID
}

func requestJourneyImagesHTTP(
	t *testing.T,
	client *http.Client,
	baseURL string,
	requestID string,
	body []byte,
) (int, integrationImageListResponse) {
	t.Helper()

	request, err := http.NewRequest(
		http.MethodPost,
		baseURL+"/api/v1/journey-requests/"+requestID+"/images",
		bytes.NewReader(body),
	)
	if err != nil {
		t.Fatalf("create image request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("post image request: %v", err)
	}
	defer response.Body.Close()

	var payload integrationImageListResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("decode image request: %v", err)
	}

	return response.StatusCode, payload
}

func listJourneyImagesHTTP(
	t *testing.T,
	client *http.Client,
	baseURL string,
	requestID string,
) integrationImageListResponse {
	t.Helper()
	request, err := http.NewRequest(
		http.MethodGet,
		baseURL+"/api/v1/journey-requests/"+requestID+"/images",
		nil,
	)
	if err != nil {
		t.Fatalf("create list image request: %v", err)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("list image request: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(response.Body)
		t.Fatalf("list image status = %d, want %d: %s", response.StatusCode, http.StatusOK, data)
	}

	var payload integrationImageListResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("decode image list: %v", err)
	}

	return payload
}

func waitForReadyImage(
	t *testing.T,
	client *http.Client,
	baseURL string,
	requestID string,
) integrationImageResponse {
	t.Helper()

	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		payload := listJourneyImagesHTTP(t, client, baseURL, requestID)
		if len(payload.Images) == 1 {
			switch payload.Images[0].Status {
			case "ready":
				return payload.Images[0]
			case "failed":
				t.Fatalf("stub image generation failed")
			}
		}
		time.Sleep(100 * time.Millisecond)
	}

	t.Fatal("image did not become ready within 10s")
	return integrationImageResponse{}
}

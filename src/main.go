package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourney "cacao/src/application/generate_journey"
	generatejourneyimage "cacao/src/application/generate_journey_image"
	getjourney "cacao/src/application/get_journey"
	getjourneyimage "cacao/src/application/get_journey_image"
	getjourneyimagecontent "cacao/src/application/get_journey_image_content"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyimages "cacao/src/application/list_journey_images"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	listjourneys "cacao/src/application/list_journeys"
	requestjourneyimages "cacao/src/application/request_journey_images"
	retryjourneyimage "cacao/src/application/retry_journey_image"
	"cacao/src/infrastructure/database"
	"cacao/src/infrastructure/event"
	"cacao/src/infrastructure/repository/postgres"
	"cacao/src/infrastructure/service"
	"cacao/src/infrastructure/service/comfyui"
	"cacao/src/infrastructure/worker"
	"cacao/src/presentation/controller"

	domainservice "cacao/src/domain/service"

	"github.com/joho/godotenv"
)

const (
	serverAddress                   = ":8080"
	shutdownTimeout                 = 30 * time.Second
	defaultImageGeneratorDriverName = "stub"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	if err := loadDotEnv(); err != nil {
		return err
	}

	imageConfig, err := service.ImageConfigFromEnv()
	if err != nil {
		return fmt.Errorf("load image config: %w", err)
	}
	generator, err := newJourneyGenerator()
	if err != nil {
		return fmt.Errorf("setup journey generator: %w", err)
	}
	databaseConfig, err := database.ConfigFromEnv()
	if err != nil {
		return fmt.Errorf("load database config: %w", err)
	}

	db, err := database.CreateGORMClient(context.Background(), databaseConfig)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	databaseConnection, err := db.DB()
	if err != nil {
		return fmt.Errorf("get database connection: %w", err)
	}
	defer func() {
		if closeErr := databaseConnection.Close(); closeErr != nil {
			log.Printf("failed close database: %v", closeErr)
		}
	}()

	reqRepo := postgres.NewJourneyRequestRepository(db)
	journeyRepo := postgres.NewJourneyRepository(db)
	imageRepo := postgres.NewJourneyImageRepository(db)

	imageStorage, err := newImageStorage(imageConfig)
	if err != nil {
		return fmt.Errorf("setup image storage: %w", err)
	}
	defer closeImageStorage(imageStorage)

	imageGenerator, err := newImageGenerator(imageConfig)
	if err != nil {
		return fmt.Errorf("setup image generator: %w", err)
	}

	workerConfig := imageWorkerConfig(imageConfig)
	generateImageUC := generatejourneyimage.NewUseCase(
		imageRepo,
		reqRepo,
		imageGenerator,
		imageStorage,
		generatejourneyimage.Config{
			GenerationTimeout: workerConfig.GenerationTimeout,
			LeaseDuration:     workerConfig.LeaseDuration,
		},
	)
	imageWorker, err := worker.NewJourneyImageWorker(
		workerConfig,
		imageRepo,
		generateImageUC,
	)
	if err != nil {
		return fmt.Errorf("setup journey image worker: %w", err)
	}

	publisher := event.NewPublisherMock()
	createReqUC := createjourneyrequest.NewUseCase(reqRepo, publisher)
	generateUC := generatejourney.NewUseCase(reqRepo, journeyRepo, generator, publisher)
	getJourneyUC := getjourney.NewUseCase(journeyRepo)
	listJourneysUC := listjourneys.NewUseCase(journeyRepo)
	getReqUC := getjourneyrequest.NewUseCase(reqRepo)
	listReqUC := listjourneyrequests.NewUseCase(reqRepo)
	requestImagesUC := requestjourneyimages.NewUseCase(reqRepo, imageRepo)
	listImagesUC := listjourneyimages.NewUseCase(reqRepo, imageRepo)
	getImageUC := getjourneyimage.NewUseCase(imageRepo)
	getImageContentUC := getjourneyimagecontent.NewUseCase(imageRepo, imageStorage)
	retryImageUC := retryjourneyimage.NewUseCase(imageRepo)

	router := controller.NewRouter(
		createReqUC,
		generateUC,
		getJourneyUC,
		listJourneysUC,
		getReqUC,
		listReqUC,
		controller.ImageRoutes{
			Request: requestImagesUC,
			List:    listImagesUC,
			Get:     getImageUC,
			Content: getImageContentUC,
			Retry:   retryImageUC,
		},
	)

	server := &http.Server{
		Addr:              serverAddress,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}
	return serve(server, imageWorker)
}

func loadDotEnv() error {
	return loadDotEnvFile(".env")
}

func loadDotEnvFile(path string) error {
	if err := godotenv.Load(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("load .env: %w", err)
	}

	return nil
}

func newImageStorage(config service.ImageConfig) (domainservice.ImageStorage, error) {
	switch config.Storage.Driver {
	case "filesystem":
		return service.NewFileSystemImageStorage(config.Storage)
	default:
		return nil, fmt.Errorf("unsupported image storage driver: %q", config.Storage.Driver)
	}
}

func newImageGenerator(config service.ImageConfig) (domainservice.ImageGenerator, error) {
	switch config.GeneratorDriver {
	case defaultImageGeneratorDriverName, "":
		return service.NewImageGeneratorStub(), nil
	case "comfyui":
		return comfyui.NewGenerator(
			config.ComfyUIBaseURL,
			config.ComfyUIWorkflowPath,
			config.ComfyUIManifestPath,
		)
	default:
		return nil, fmt.Errorf("unsupported image generator driver: %q", config.GeneratorDriver)
	}
}

func imageWorkerConfig(config service.ImageConfig) worker.WorkerConfig {
	defaults := worker.DefaultWorkerConfig()
	defaults.Concurrency = config.WorkerConcurrency
	defaults.PollInterval = config.WorkerPollInterval
	defaults.GenerationTimeout = config.GenerationTimeout
	defaults.LeaseDuration = config.WorkerLeaseDuration

	return defaults
}

func closeImageStorage(storage domainservice.ImageStorage) {
	closeable, ok := storage.(interface{ Close() error })
	if !ok {
		return
	}
	if err := closeable.Close(); err != nil {
		log.Printf("failed close image storage: %v", err)
	}
}

func serve(server *http.Server, imageWorker *worker.JourneyImageWorker) error {
	if server == nil {
		return fmt.Errorf("HTTP server must not be nil")
	}
	if imageWorker == nil {
		return fmt.Errorf("journey image worker must not be nil")
	}

	workerContext, cancelWorker := context.WithCancel(context.Background())
	defer cancelWorker()
	stopPolling := make(chan struct{})
	workerResult := make(chan error, 1)
	go func() {
		workerResult <- imageWorker.Run(workerContext, stopPolling)
	}()

	serverResult := make(chan error, 1)
	go func() {
		serverResult <- server.ListenAndServe()
	}()

	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(signalChannel)

	select {
	case err := <-serverResult:
		return stopApplication(server, stopPolling, cancelWorker, workerResult, err)
	case <-signalChannel:
		return stopApplication(server, stopPolling, cancelWorker, workerResult, nil)
	}
}

func stopApplication(
	server *http.Server,
	stopPolling chan struct{},
	cancelWorker context.CancelFunc,
	workerResult <-chan error,
	serverErr error,
) error {
	close(stopPolling)

	shutdownContext, cancelShutdown := context.WithTimeout(context.Background(), shutdownTimeout)
	shutdownErr := server.Shutdown(shutdownContext)
	cancelShutdown()

	workerErr := waitForWorker(workerResult, cancelWorker)
	return errors.Join(
		normalizeServerError(serverErr),
		shutdownErr,
		workerErr,
	)
}

func waitForWorker(workerResult <-chan error, cancelWorker context.CancelFunc) error {
	return waitForWorkerWithTimeout(workerResult, cancelWorker, shutdownTimeout)
}

func waitForWorkerWithTimeout(
	workerResult <-chan error,
	cancelWorker context.CancelFunc,
	timeout time.Duration,
) error {
	select {
	case err := <-workerResult:
		return err
	case <-time.After(timeout):
		cancelWorker()
		workerErr := <-workerResult
		return errors.Join(
			fmt.Errorf("journey image worker shutdown timed out"),
			workerErr,
		)
	}
}

func normalizeServerError(err error) error {
	if err == nil || errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return fmt.Errorf("HTTP server: %w", err)
}

// newJourneyGenerator は環境変数 LLM_DRIVER で旅程生成の実装を切り替える。
func newJourneyGenerator() (domainservice.JourneyGenerator, error) {
	cfg, err := service.LLMConfigFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to load llm driver config: %w", err)
	}

	switch cfg.Driver {
	case "openai":
		aiCfg, err := service.OpenAIConfigFromEnv()
		if err != nil {
			return nil, fmt.Errorf("failed to load openai config: %w", err)
		}
		client := service.NewOpenAIClient(aiCfg)
		return service.NewJourneyGeneratorOpenAI(client, aiCfg.Model, cfg.WebSearchEnabled), nil
	case "stub", "":
		return service.NewJourneyGeneratorStub(), nil
	default:
		return nil, fmt.Errorf("unsupported LLM_DRIVER: %q", cfg.Driver)
	}
}

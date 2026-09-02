package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"

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
	domainservice "cacao/src/domain/service"
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/database"
	"cacao/src/infrastructure/event"
	"cacao/src/infrastructure/imagecontent"
	"cacao/src/infrastructure/imagegen"
	"cacao/src/infrastructure/imagegen/comfyui"
	"cacao/src/infrastructure/imagestore/fsstore"
	"cacao/src/infrastructure/journeygen"
	"cacao/src/infrastructure/repository/postgres"
	"cacao/src/infrastructure/worker"
	"cacao/src/observability"
	"cacao/src/presentation/controller"
)

// application は起動時に組み立てた依存関係のうち、main が扱う必要のあるものだけを束ねる。
type application struct {
	Router      http.Handler
	ImageWorker *worker.JourneyImageWorker

	db           *sql.DB
	imageStorage domainservice.ImageStorage
}

// Close は終了時に閉じる必要のあるリソースを解放する。
func (a *application) Close() {
	closeImageStorage(a.imageStorage)
	if a.db == nil {
		return
	}
	if err := a.db.Close(); err != nil {
		observability.LogFailure(
			context.Background(),
			slog.Default(),
			slog.LevelError,
			observability.FailureContext{Operation: "close_database"},
			err,
		)
	}
}

// buildApplication は Composition Root。環境変数から設定を読み、インフラ実装を選び、
// ユースケースへ注入してルータと worker を組み立てる。
// 設定エラーは HTTP リクエストを受け付ける前にここで検出する。
func buildApplication(ctx context.Context) (*application, error) {
	imageConfig, err := config.ImageFromEnv()
	if err != nil {
		return nil, fmt.Errorf("load image config: %w", err)
	}
	journeyGenerator, err := newJourneyGenerator()
	if err != nil {
		return nil, fmt.Errorf("setup journey generator: %w", err)
	}
	databaseConfig, err := config.DatabaseFromEnv()
	if err != nil {
		return nil, fmt.Errorf("load database config: %w", err)
	}

	db, err := database.CreateGORMClient(ctx, databaseConfig)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get database connection: %w", err)
	}
	app := &application{db: sqlDB}

	imageStorage, err := newImageStorage(imageConfig)
	if err != nil {
		app.Close()
		return nil, fmt.Errorf("setup image storage: %w", err)
	}
	app.imageStorage = imageStorage

	imageGenerator, err := newImageGenerator(imageConfig)
	if err != nil {
		app.Close()
		return nil, fmt.Errorf("setup image generator: %w", err)
	}

	requestRepo := postgres.NewJourneyRequestRepository(db)
	journeyRepo := postgres.NewJourneyRepository(db)
	imageRepo := postgres.NewJourneyImageRepository(db)
	publisher := event.NewPublisherMock()

	generateImageUC, err := generatejourneyimage.NewUseCase(
		imageRepo,
		requestRepo,
		imageGenerator,
		imageStorage,
		generatejourneyimage.Config{
			GenerationTimeout: imageConfig.GenerationTimeout,
			LeaseDuration:     imageConfig.Worker.LeaseDuration,
		},
	)
	if err != nil {
		app.Close()
		return nil, fmt.Errorf("setup generate journey image use case: %w", err)
	}
	imageWorker, err := worker.NewJourneyImageWorker(newWorkerConfig(imageConfig), imageRepo, generateImageUC)
	if err != nil {
		app.Close()
		return nil, fmt.Errorf("setup journey image worker: %w", err)
	}
	app.ImageWorker = imageWorker

	app.Router = controller.NewRouter(controller.Dependencies{
		CreateJourneyRequest: createjourneyrequest.NewUseCase(requestRepo, publisher),
		GenerateJourney:      generatejourney.NewUseCase(requestRepo, journeyRepo, journeyGenerator, publisher),
		GetJourney:           getjourney.NewUseCase(journeyRepo),
		ListJourneys:         listjourneys.NewUseCase(journeyRepo),
		GetJourneyRequest:    getjourneyrequest.NewUseCase(requestRepo),
		ListJourneyRequests:  listjourneyrequests.NewUseCase(requestRepo),
		Images: controller.ImageRoutes{
			Request: requestjourneyimages.NewUseCase(requestRepo, imageRepo),
			List:    listjourneyimages.NewUseCase(requestRepo, imageRepo),
			Get:     getjourneyimage.NewUseCase(imageRepo),
			Content: getjourneyimagecontent.NewUseCase(imageRepo, imageStorage),
			Retry:   retryjourneyimage.NewUseCase(imageRepo),
		},
	})

	return app, nil
}

// newJourneyGenerator は LLM_DRIVER に応じて旅程生成の実装を選ぶ。
func newJourneyGenerator() (domainservice.JourneyGenerator, error) {
	llmConfig, err := config.LLMFromEnv()
	if err != nil {
		return nil, fmt.Errorf("load llm config: %w", err)
	}

	switch llmConfig.Driver {
	case config.LLMDriverOpenAI:
		openAIConfig, err := config.OpenAIFromEnv()
		if err != nil {
			return nil, fmt.Errorf("load openai config: %w", err)
		}
		client := journeygen.NewOpenAIClient(openAIConfig)
		return journeygen.NewOpenAIGenerator(client, openAIConfig.Model, llmConfig.WebSearchEnabled), nil
	case config.LLMDriverOpenRouter:
		openRouterConfig, err := config.OpenRouterFromEnv()
		if err != nil {
			return nil, fmt.Errorf("load openrouter config: %w", err)
		}
		return journeygen.NewOpenRouterGenerator(openRouterConfig, llmConfig.WebSearchEnabled), nil
	case config.LLMDriverStub:
		return journeygen.NewStub(), nil
	default:
		return nil, fmt.Errorf("unsupported LLM_DRIVER: %q", llmConfig.Driver)
	}
}

// newImageGenerator は IMAGE_GENERATOR_DRIVER に応じて画像生成の実装を選ぶ。
// 画像の受け入れ上限はストレージと同じ値を渡し、生成器とストレージで判定が食い違わないようにする。
func newImageGenerator(imageConfig config.Image) (domainservice.ImageGenerator, error) {
	limits := imagecontent.Limits(imageConfig.Storage.Limits)

	switch imageConfig.GeneratorDriver {
	case config.ImageGeneratorStub:
		return imagegen.NewStub(), nil
	case config.ImageGeneratorComfyUI:
		return comfyui.NewGenerator(imageConfig.ComfyUI, limits)
	case config.ImageGeneratorOpenRouter:
		return imagegen.NewOpenRouterGenerator(imagegen.OpenRouterConfig{
			OpenRouterImage: imageConfig.OpenRouterImage,
			Timeout:         imageConfig.GenerationTimeout,
			Limits:          limits,
		})
	default:
		return nil, fmt.Errorf("unsupported image generator driver: %q", imageConfig.GeneratorDriver)
	}
}

// newImageStorage は IMAGE_STORAGE_DRIVER に応じて画像ストレージの実装を選ぶ。
func newImageStorage(imageConfig config.Image) (domainservice.ImageStorage, error) {
	switch imageConfig.Storage.Driver {
	case config.ImageStorageFilesystem:
		return fsstore.New(imageConfig.Storage)
	default:
		return nil, fmt.Errorf("unsupported image storage driver: %q", imageConfig.Storage.Driver)
	}
}

// newWorkerConfig は運用設定から worker の設定を作る。バッチサイズは worker の既定値を使う。
func newWorkerConfig(imageConfig config.Image) worker.Config {
	workerConfig := worker.DefaultConfig()
	workerConfig.Concurrency = imageConfig.Worker.Concurrency
	workerConfig.PollInterval = imageConfig.Worker.PollInterval
	return workerConfig
}

func closeImageStorage(storage domainservice.ImageStorage) {
	closeable, ok := storage.(interface{ Close() error })
	if !ok {
		return
	}
	if err := closeable.Close(); err != nil {
		observability.LogFailure(
			context.Background(),
			slog.Default(),
			slog.LevelError,
			observability.FailureContext{Operation: "close_image_storage"},
			err,
		)
	}
}

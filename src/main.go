package main

import (
	"context"
	"fmt"
	"log"

	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourney "cacao/src/application/generate_journey"
	generatejourneyimage "cacao/src/application/generate_journey_image"
	getjourney "cacao/src/application/get_journey"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	listjourneys "cacao/src/application/list_journeys"
	"cacao/src/infrastructure/database"
	"cacao/src/infrastructure/event"
	"cacao/src/infrastructure/repository/postgres"
	"cacao/src/infrastructure/service"
	"cacao/src/infrastructure/worker"
	"cacao/src/presentation/controller"

	domainservice "cacao/src/domain/service"

	"github.com/joho/godotenv"
)

func main() {
	// .env を環境変数にロードする。
	// 本番環境など .env が存在しない場合は無視して OS の環境変数のみで動かせるよう、
	// 存在しない場合はエラーにしない（ErrNotExist を許容）。
	if err := godotenv.Load(); err != nil {
		log.Printf("warning: .env file not loaded: %v", err)
	}

	ctx := context.Background()

	// 1. DB 接続（本番/開発用 GORM エンジン生成）
	cfg, err := database.ConfigFromEnv()
	if err != nil {
		log.Fatalf("failed to load database config: %v", err)
	}
	db, err := database.CreateGORMClient(ctx, cfg)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// 2. リポジトリ生成（Postgres 実装を注入）
	reqRepo := postgres.NewJourneyRequestRepository(db)
	journeyRepo := postgres.NewJourneyRepository(db)
	imageRepo := postgres.NewJourneyImageRepository(db)
	imageStorageConfig, err := service.ImageStorageConfigFromEnv()
	if err != nil {
		log.Fatalf("failed load image storage config: %v", err)
	}
	imageStorage, err := service.NewFileSystemImageStorage(imageStorageConfig)
	if err != nil {
		log.Fatalf("failed setup image storage: %v", err)
	}
	defer func() {
		if err := imageStorage.Close(); err != nil {
			log.Printf("failed close image storage: %v", err)
		}
	}()

	workerConfig := worker.DefaultWorkerConfig()
	imageGenerator := service.NewImageGeneratorStub()
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
	imageWorker, err := worker.NewJourneyImage(
		workerConfig,
		imageRepo,
		generateImageUC,
	)
	if err != nil {
		log.Fatalf("failed setup journey image worker: %v", err)
	}

	// 3. 旅程生成サービス（LLM_DRIVER で実装を切替、設計書 §8）
	generator, err := newJourneyGenerator()
	if err != nil {
		log.Fatalf("failed to setup journey generator: %v", err)
	}
	publisher := event.NewPublisherMock()

	// ユースケースの組立
	createReqUC := createjourneyrequest.NewUseCase(reqRepo, publisher)
	generateUC := generatejourney.NewUseCase(reqRepo, journeyRepo, generator, publisher)
	getJourneyUC := getjourney.NewUseCase(journeyRepo)
	listJourneysUC := listjourneys.NewUseCase(journeyRepo)
	getReqUC := getjourneyrequest.NewUseCase(reqRepo)
	listReqUC := listjourneyrequests.NewUseCase(reqRepo)

	// ルータ起動
	r := controller.NewRouter(
		createReqUC,
		generateUC,
		getJourneyUC,
		listJourneysUC,
		getReqUC,
		listReqUC,
	)
	go func() {
		if err := imageWorker.Run(ctx, nil); err != nil {
			log.Printf("journey image worker stopped: %v", err)
		}
	}()
	if err := r.Run(":8080"); err != nil {
		panic(err)
	}
}

// newJourneyGenerator は環境変数 LLM_DRIVER で旅程生成の実装を切り替える（設計書 §8）。
// "openai" のとき OpenAI 本番実装、"stub" のときスタブを返す。
// 未設定時は envDefault により "stub" となり、API Key なしのローカル開発でも動作確認できる。
func newJourneyGenerator() (domainservice.JourneyGenerator, error) {
	cfg, err := service.LLMConfigFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to load llm driver config: %w", err)
	}

	// 3 分岐（openai / stub / 未対応）かつ将来の拡張を見据えて switch を採用。
	// Go の switch は暗黙 break でフォールスルーしない点も安全。
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

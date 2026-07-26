package main

import (
	"context"
	"log"

	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	listjourneys "cacao/src/application/list_journeys"
	"cacao/src/infrastructure/database"
	"cacao/src/infrastructure/event"
	"cacao/src/infrastructure/repository/postgres"
	"cacao/src/infrastructure/service"
	"cacao/src/presentation/controller"
)

func main() {
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
	generator := service.NewJourneyGeneratorStub()
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
	if err := r.Run(":8080"); err != nil {
		panic(err)
	}
}

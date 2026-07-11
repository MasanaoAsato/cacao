package main

import (
	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	listjourneys "cacao/src/application/list_journeys"
	"cacao/src/infrastructure/event"
	"cacao/src/infrastructure/repository/memory"
	"cacao/src/infrastructure/service"
	"cacao/src/presentation/controller"
)

func main() {
	// インフラ層モックの生成
	reqRepo := memory.NewJourneyRequestRepository()
	journeyRepo := memory.NewJourneyRepository()
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
	r.Run(":8080")
}

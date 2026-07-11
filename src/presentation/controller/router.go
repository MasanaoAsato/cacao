package controller

import (
	"github.com/gin-gonic/gin"

	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	listjourneys "cacao/src/application/list_journeys"
)

// NewRouter は依存するユースケースを受け取り、Ginのルータを組み立てる。
func NewRouter(
	createReqUC createjourneyrequest.UseCase,
	generateUC generatejourney.UseCase,
	getJourneyUC getjourney.UseCase,
	listJourneysUC listjourneys.UseCase,
	getReqUC getjourneyrequest.UseCase,
	listReqUC listjourneyrequests.UseCase,
) *gin.Engine {
	r := gin.Default()
	api := r.Group("/api/v1")
	{
		api.POST("/journey-requests", HandleCreate(createReqUC))
		api.GET("/journey-requests", HandleListRequests(listReqUC))
		api.GET("/journey-requests/:id", HandleGetRequest(getReqUC))
		api.POST("/journey-requests/:id/generate", HandleGenerate(generateUC))
		api.GET("/journeys", HandleListJourneys(listJourneysUC))
		api.GET("/journeys/:id", HandleGetJourney(getJourneyUC))
	}
	return r
}

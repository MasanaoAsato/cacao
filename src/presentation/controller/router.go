package controller

import (
	getjourneyimage "cacao/src/application/get_journey_image"
	getjourneyimagecontent "cacao/src/application/get_journey_image_content"
	"github.com/gin-gonic/gin"

	createjourneyrequest "cacao/src/application/create_journey_request"
	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyimages "cacao/src/application/list_journey_images"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	listjourneys "cacao/src/application/list_journeys"
	requestjourneyimages "cacao/src/application/request_journey_images"
	retryjourneyimage "cacao/src/application/retry_journey_image"
)

// ImageRoutes は画像APIへ注入するユースケース群である。
type ImageRoutes struct {
	Request requestjourneyimages.UseCase
	List    listjourneyimages.UseCase
	Get     getjourneyimage.UseCase
	Content getjourneyimagecontent.UseCase
	Retry   retryjourneyimage.UseCase
}

// NewRouter は依存するユースケースを受け取り、Ginのルータを組み立てる。
func NewRouter(
	createReqUC createjourneyrequest.UseCase,
	generateUC generatejourney.UseCase,
	getJourneyUC getjourney.UseCase,
	listJourneysUC listjourneys.UseCase,
	getReqUC getjourneyrequest.UseCase,
	listReqUC listjourneyrequests.UseCase,
	imageRoutes ...ImageRoutes,
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
	if len(imageRoutes) > 0 {
		registerJourneyImageRoutes(api, imageRoutes[0])
	}

	return r
}

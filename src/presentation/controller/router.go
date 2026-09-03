package controller

import (
	"io"
	"log/slog"
	"net/http"

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
	"cacao/src/observability"
)

// ImageRoutes は画像APIへ注入するユースケース群である。
type ImageRoutes struct {
	Request requestjourneyimages.UseCase
	List    listjourneyimages.UseCase
	Get     getjourneyimage.UseCase
	Content getjourneyimagecontent.UseCase
	Retry   retryjourneyimage.UseCase
}

// Dependencies はルータが必要とするユースケース群である。
// 位置引数ではなくフィールド名で渡すことで、同型のインターフェースの取り違えを防ぐ。
type Dependencies struct {
	CreateJourneyRequest createjourneyrequest.UseCase
	GenerateJourney      generatejourney.UseCase
	GetJourney           getjourney.UseCase
	ListJourneys         listjourneys.UseCase
	GetJourneyRequest    getjourneyrequest.UseCase
	ListJourneyRequests  listjourneyrequests.UseCase
	Images               ImageRoutes
}

// NewRouter は依存するユースケースを受け取り、Ginのルータを組み立てる。
func NewRouter(deps Dependencies) *gin.Engine {
	r := gin.New()
	r.Use(safeRecovery())
	api := r.Group("/api/v1")
	{
		api.POST("/journey-requests", HandleCreate(deps.CreateJourneyRequest))
		api.GET("/journey-requests", HandleListRequests(deps.ListJourneyRequests))
		api.GET("/journey-requests/:id", HandleGetRequest(deps.GetJourneyRequest))
		api.POST("/journey-requests/:id/generate", HandleGenerate(deps.GenerateJourney))
		api.GET("/journeys", HandleListJourneys(deps.ListJourneys))
		api.GET("/journeys/:id", HandleGetJourney(deps.GetJourney))
	}
	registerJourneyImageRoutes(api, deps.Images)

	return r
}

func safeRecovery() gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, recovered any) {
		observability.LogRecoveredPanic(
			requestContext(c),
			slog.Default(),
			"http_panic",
			routeName(c),
			recovered,
		)
		c.AbortWithStatus(http.StatusInternalServerError)
	})
}

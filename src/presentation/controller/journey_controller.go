package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	listjourneys "cacao/src/application/list_journeys"
	"cacao/src/presentation/presenter"
)

// GenerateJourneyRequest は旅程生成リクエストのJSONボディ。
type generateJourneyRequest struct {
	// 現状はボディが不要だが、将来の拡張に備えて空構造体として定義しておく。
}

// HandleGenerate は POST /journey-requests/:id/generate のハンドラ。
func HandleGenerate(uc generatejourney.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		out, err := uc.Execute(c.Request.Context(), generatejourney.Input{RequestID: id})
		if err != nil {
			handleApplicationError(c, err)
			return
		}
		c.JSON(http.StatusCreated, presenter.CreateJourneyRequestResponse{RequestID: out.JourneyID})
	}
}

// HandleGetJourney は GET /journeys/:id のハンドラ。
func HandleGetJourney(uc getjourney.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		out, err := uc.Execute(c.Request.Context(), getjourney.Input{JourneyID: id})
		if err != nil {
			handleApplicationError(c, err)
			return
		}
		c.JSON(http.StatusOK, presenter.ToJourneyResponse(out.Journey))
	}
}

// HandleListJourneys は GET /journeys のハンドラ。
func HandleListJourneys(uc listjourneys.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		out, err := uc.Execute(c.Request.Context(), listjourneys.Input{})
		if err != nil {
			handleApplicationError(c, err)
			return
		}
		c.JSON(http.StatusOK, presenter.ToJourneyListResponse(out.Journeys))
	}
}

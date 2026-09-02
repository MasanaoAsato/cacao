package controller

import (
	"fmt"
	"io"
	"net/http"

	"cacao/src/application"
	getjourneyimage "cacao/src/application/get_journey_image"
	getjourneyimagecontent "cacao/src/application/get_journey_image_content"
	listjourneyimages "cacao/src/application/list_journey_images"
	"cacao/src/application/readmodel"
	requestjourneyimages "cacao/src/application/request_journey_images"
	retryjourneyimage "cacao/src/application/retry_journey_image"
	"cacao/src/presentation/presenter"

	"github.com/gin-gonic/gin"
)

type requestJourneyImagesRequest struct {
	Slots []imageSlotRequest `json:"slots"`
}

type imageSlotRequest struct {
	Purpose string `json:"purpose"`
	Ordinal int    `json:"ordinal"`
}

// HandleRequestJourneyImages は画像生成を冪等に要求する。
func HandleRequestJourneyImages(uc requestjourneyimages.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request requestJourneyImagesRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			handleApplicationError(c, fmt.Errorf("%w: request body: %w", application.ErrInvalidInput, err))
			return
		}

		slots := make([]requestjourneyimages.SlotInput, 0, len(request.Slots))
		for _, slot := range request.Slots {
			slots = append(slots, requestjourneyimages.SlotInput{
				Purpose: slot.Purpose,
				Ordinal: slot.Ordinal,
			})
		}
		requestID := journeyRequestID(c)
		output, err := uc.Execute(c.Request.Context(), requestjourneyimages.Input{
			RequestID: requestID,
			Slots:     slots,
		})
		if err != nil {
			handleApplicationError(c, err)
			return
		}

		if hasActiveImages(output.Images) {
			c.Header("Location", "/api/v1/journey-requests/"+requestID+"/images")
			c.Header("Retry-After", "2")
			c.JSON(http.StatusAccepted, presenter.ToRequestJourneyImagesResponse(output))
			return
		}

		c.JSON(http.StatusOK, presenter.ToRequestJourneyImagesResponse(output))
	}
}

// HandleListJourneyImages はrequest単位の画像一覧を返す。
func HandleListJourneyImages(uc listjourneyimages.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		output, err := uc.Execute(c.Request.Context(), listjourneyimages.Input{
			RequestID: journeyRequestID(c),
		})
		if err != nil {
			handleApplicationError(c, err)
			return
		}

		c.JSON(http.StatusOK, presenter.ToListJourneyImagesResponse(output))
	}
}

// HandleGetJourneyImage は画像1件の状態を返す。
func HandleGetJourneyImage(uc getjourneyimage.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		output, err := uc.Execute(c.Request.Context(), getjourneyimage.Input{
			ImageID: c.Param("image_id"),
		})
		if err != nil {
			handleApplicationError(c, err)
			return
		}

		c.JSON(http.StatusOK, presenter.ToGetJourneyImageResponse(output))
	}
}

// HandleGetJourneyImageContent はready画像のbinaryを返す。
func HandleGetJourneyImageContent(uc getjourneyimagecontent.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		output, err := uc.Execute(c.Request.Context(), getjourneyimagecontent.Input{
			ImageID: c.Param("image_id"),
		})
		if err != nil {
			handleApplicationError(c, err)
			return
		}
		defer func() {
			_ = output.Content.Close()
		}()

		etag := fmt.Sprintf("%q", output.ETag)
		c.Header("ETag", etag)
		c.Header("Cache-Control", "max-age=86400, immutable")
		if c.GetHeader("If-None-Match") == etag {
			c.Status(http.StatusNotModified)
			return
		}

		c.Header("Content-Type", output.MediaType)
		c.Status(http.StatusOK)
		_, _ = io.Copy(c.Writer, output.Content)
	}
}

// HandleRetryJourneyImage はfailed画像を再生成待ちへ戻す。
func HandleRetryJourneyImage(uc retryjourneyimage.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		output, err := uc.Execute(c.Request.Context(), retryjourneyimage.Input{
			ImageID: c.Param("image_id"),
		})
		if err != nil {
			handleApplicationError(c, err)
			return
		}

		c.JSON(http.StatusAccepted, presenter.ToRetryJourneyImageResponse(output))
	}
}

func registerJourneyImageRoutes(api *gin.RouterGroup, routes ImageRoutes) {
	if routes.Request != nil {
		api.POST("/journey-requests/:id/images", HandleRequestJourneyImages(routes.Request))
	}
	if routes.List != nil {
		api.GET("/journey-requests/:id/images", HandleListJourneyImages(routes.List))
	}
	if routes.Get != nil {
		api.GET("/journey-images/:image_id", HandleGetJourneyImage(routes.Get))
	}
	if routes.Content != nil {
		api.GET("/journey-images/:image_id/content", HandleGetJourneyImageContent(routes.Content))
	}
	if routes.Retry != nil {
		api.POST("/journey-images/:image_id/retry", HandleRetryJourneyImage(routes.Retry))
	}
}

func journeyRequestID(c *gin.Context) string {
	if requestID := c.Param("request_id"); requestID != "" {
		return requestID
	}

	return c.Param("id")
}

func hasActiveImages(images []readmodel.JourneyImageDTO) bool {
	for _, image := range images {
		if image.Status == "pending" || image.Status == "processing" {
			return true
		}
	}

	return false
}

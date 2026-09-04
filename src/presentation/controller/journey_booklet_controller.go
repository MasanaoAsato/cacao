package controller

import (
	"errors"
	"fmt"
	"net/http"

	"cacao/src/application"
	exportjourneybooklet "cacao/src/application/export_journey_booklet"

	"github.com/gin-gonic/gin"
)

// HandleExportJourneyBooklet は旅のしおりPDFをダウンロードとして返す。
func HandleExportJourneyBooklet(uc exportjourneybooklet.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		output, err := uc.Execute(c.Request.Context(), exportjourneybooklet.Input{
			JourneyID: c.Param("id"),
			Seed:      c.Query("seed"),
		})
		if err != nil {
			if errors.Is(err, application.ErrBookletRendererBusy) {
				c.Header("Retry-After", "5")
			}
			handleApplicationError(c, err)
			return
		}

		c.Header("Cache-Control", "no-store")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", output.FileName))
		c.Data(http.StatusOK, output.MediaType, output.Content)
	}
}

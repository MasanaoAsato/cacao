package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	createjourneyrequest "cacao/src/application/create_journey_request"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
	"cacao/src/presentation/presenter"
)

// createJourneyRequestRequest は POST /journey-requests のリクエストボディ。
type createJourneyRequestRequest struct {
	DepartureCity    string `json:"departure_city" binding:"required"`
	DepartureCountry string `json:"departure_country" binding:"required"`
	StartDate        string `json:"start_date" binding:"required"`
	EndDate          string `json:"end_date" binding:"required"`
	Amount           int    `json:"amount" binding:"required,min=1"`
	Currency         string `json:"currency" binding:"required"`
}

func (r createJourneyRequestRequest) toUseCaseInput() (createjourneyrequest.Input, error) {
	start, err := time.Parse(time.RFC3339, r.StartDate)
	if err != nil {
		return createjourneyrequest.Input{}, fmt.Errorf("invalid start_date: %w", err)
	}
	end, err := time.Parse(time.RFC3339, r.EndDate)
	if err != nil {
		return createjourneyrequest.Input{}, fmt.Errorf("invalid end_date: %w", err)
	}
	return createjourneyrequest.Input{
		DepartureCity:    r.DepartureCity,
		DepartureCountry: r.DepartureCountry,
		StartDate:        start,
		EndDate:          end,
		Amount:           r.Amount,
		Currency:         r.Currency,
	}, nil
}

// HandleCreate は POST /journey-requests のハンドラ。
func HandleCreate(uc createjourneyrequest.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createJourneyRequestRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid request body", Detail: err.Error()})
			return
		}

		input, err := req.toUseCaseInput()
		if err != nil {
			c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid input", Detail: err.Error()})
			return
		}

		out, err := uc.Execute(c.Request.Context(), input)
		if err != nil {
			handleApplicationError(c, err)
			return
		}

		c.JSON(http.StatusCreated, presenter.ToCreateJourneyRequestResponse(out))
	}
}

// HandleGetRequest は GET /journey-requests/:id のハンドラ。
func HandleGetRequest(uc getjourneyrequest.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		out, err := uc.Execute(c.Request.Context(), getjourneyrequest.Input{RequestID: id})
		if err != nil {
			handleApplicationError(c, err)
			return
		}
		c.JSON(http.StatusOK, presenter.ToJourneyRequestResponse(out.Request))
	}
}

// HandleListRequests は GET /journey-requests のハンドラ。
func HandleListRequests(uc listjourneyrequests.UseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		out, err := uc.Execute(c.Request.Context(), listjourneyrequests.Input{})
		if err != nil {
			handleApplicationError(c, err)
			return
		}
		c.JSON(http.StatusOK, presenter.ToJourneyRequestListResponse(out.Requests))
	}
}

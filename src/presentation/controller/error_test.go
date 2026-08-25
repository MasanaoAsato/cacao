package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"cacao/src/application"

	"github.com/gin-gonic/gin"
)

func TestHandleApplicationError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantError  string
		wantDetail string
	}{
		{
			name:       "画像がない場合は404を返す",
			err:        fmt.Errorf("getting journey image: %w", application.ErrJourneyImageNotFound),
			wantStatus: http.StatusNotFound,
			wantError:  "journey image not found",
			wantDetail: "journey image was not found",
		},
		{
			name:       "画像が未準備の場合は409を返す",
			err:        fmt.Errorf("getting journey image content: %w", application.ErrJourneyImageNotReady),
			wantStatus: http.StatusConflict,
			wantError:  "journey image not ready",
			wantDetail: "journey image is not ready",
		},
		{
			name:       "再試行できない場合は409を返す",
			err:        fmt.Errorf("retrying journey image: %w", application.ErrJourneyImageRetryNotAllowed),
			wantStatus: http.StatusConflict,
			wantError:  "journey image retry not allowed",
			wantDetail: "journey image cannot be retried",
		},
		{
			name:       "未知のエラーの場合は500を返す",
			err:        errors.New("unexpected error with database path"),
			wantStatus: http.StatusInternalServerError,
			wantError:  "internal server error",
			wantDetail: "internal server error",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			responseRecorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(responseRecorder)

			handleApplicationError(context, testCase.err)

			if responseRecorder.Code != testCase.wantStatus {
				t.Errorf("status = %d, want %d", responseRecorder.Code, testCase.wantStatus)
			}

			var response errorResponse
			if err := json.Unmarshal(responseRecorder.Body.Bytes(), &response); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if response.Error != testCase.wantError {
				t.Errorf("error = %q, want %q", response.Error, testCase.wantError)
			}
			if response.Detail != testCase.wantDetail {
				t.Errorf("detail = %q, want %q", response.Detail, testCase.wantDetail)
			}
		})
	}
}

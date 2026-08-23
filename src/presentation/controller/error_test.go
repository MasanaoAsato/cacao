package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"cacao/src/application"
)

func TestHandleApplicationError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantError  string
	}{
		{
			name:       "画像がない場合は404を返す",
			err:        fmt.Errorf("getting journey image: %w", application.ErrJourneyImageNotFound),
			wantStatus: http.StatusNotFound,
			wantError:  "journey image not found",
		},
		{
			name:       "画像が未準備の場合は409を返す",
			err:        fmt.Errorf("getting journey image content: %w", application.ErrJourneyImageNotReady),
			wantStatus: http.StatusConflict,
			wantError:  "journey image not ready",
		},
		{
			name:       "再試行できない場合は409を返す",
			err:        fmt.Errorf("retrying journey image: %w", application.ErrJourneyImageRetryNotAllowed),
			wantStatus: http.StatusConflict,
			wantError:  "journey image retry not allowed",
		},
		{
			name:       "未知のエラーの場合は500を返す",
			err:        errors.New("unexpected error"),
			wantStatus: http.StatusInternalServerError,
			wantError:  "internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			handleApplicationError(c, tt.err)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}

			var response errorResponse
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if response.Error != tt.wantError {
				t.Errorf("error = %q, want %q", response.Error, tt.wantError)
			}
			if response.Detail != tt.err.Error() {
				t.Errorf("detail = %q, want %q", response.Detail, tt.err.Error())
			}
		})
	}
}

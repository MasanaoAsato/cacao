package worker

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestJourneyImageWorkerReportErrorDoesNotLogErrorValue(t *testing.T) {
	const secret = "storage_key=/private/path api_key=secret-value"

	var logs bytes.Buffer
	worker := &JourneyImageWorker{
		logger: slog.New(slog.NewJSONHandler(&logs, nil)),
	}
	imageID := uuid.NewString()

	worker.reportError(
		context.Background(),
		"generate_journey_image",
		imageID,
		errors.New(secret),
	)

	logText := logs.String()
	for _, want := range []string{
		`"operation":"generate_journey_image"`,
		`"journey_image_id":"` + imageID + `"`,
		`"error_kind":"internal_error"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "/private/path", "secret-value"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

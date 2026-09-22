package worker

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"

	"cacao/src/observability"
)

func TestJourneyImageWorkerReportErrorLogsErrorValue(t *testing.T) {
	const detail = "generated image has unsupported media type"

	var logs bytes.Buffer
	worker := &JourneyImageWorker{
		logger: slog.New(slog.NewJSONHandler(&logs, nil)),
	}
	imageID := uuid.NewString()

	worker.reportError(
		context.Background(),
		"generate_journey_image",
		imageID,
		observability.WithSafeLogMessage(detail, errors.New("untrusted cause")),
	)

	logText := logs.String()
	for _, want := range []string{
		`"operation":"generate_journey_image"`,
		`"journey_image_id":"` + imageID + `"`,
		`"error_kind":"internal_error"`,
		`"error":"` + detail + `"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
}

func TestJourneyImageWorkerReportErrorDoesNotLogUnclassifiedError(t *testing.T) {
	const secret = "storage_key=/private/path api_key=secret-value"

	var logs bytes.Buffer
	worker := &JourneyImageWorker{
		logger: slog.New(slog.NewJSONHandler(&logs, nil)),
	}

	worker.reportError(
		context.Background(),
		"generate_journey_image",
		uuid.NewString(),
		errors.New(secret),
	)

	logText := logs.String()
	for _, forbidden := range []string{secret, "/private/path", "secret-value", `"error":`} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

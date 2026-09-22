package observability

import (
	"bytes"
	"cacao/src/infrastructure/openrouterclient"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"cacao/src/application"
	domainservice "cacao/src/domain/service"
)

func TestLogFailure(t *testing.T) {
	const secret = "api_key=secret-value prompt=private-itinerary"

	tests := []struct {
		name             string
		err              error
		failureContext   FailureContext
		wantLogFragments []string
		forbidden        []string
	}{
		{
			name: "正常系: 既知の生成タイムアウトを分類する",
			err: WithSafeLogMessage(
				"journey generation request timed out",
				fmt.Errorf(
					"generate journey: %w: %w",
					application.ErrGenerationFailed,
					context.DeadlineExceeded,
				),
			),
			failureContext: FailureContext{
				Operation: "http_request",
				Route:     "/api/v1/journey-requests/:id/generate",
				Status:    502,
			},
			wantLogFragments: []string{
				`"operation":"http_request"`,
				`"error_kind":"generation_failed"`,
				`"cause_kind":"deadline_exceeded"`,
				`"status":502`,
				`"error":"journey generation request timed out"`,
			},
		},
		{
			name: "正常系: ワーカーは具体的なエラーを出力する",
			err: WithSafeLogMessage(
				"generated image has unsupported media type",
				errors.New("untrusted cause"),
			),
			failureContext: FailureContext{
				Operation:      "generate_journey_image",
				JourneyImageID: uuid.NewString(),
			},
			wantLogFragments: []string{
				`"error_kind":"internal_error"`,
				`"cause_kind":"internal_error"`,
				`"journey_image_id":"`,
				`"error":"generated image has unsupported media type"`,
			},
		},
		{
			name: "異常系: HTTP 4xx は詳細エラーを出力しない",
			err:  errors.New(secret),
			failureContext: FailureContext{
				Operation: "http_request",
				Status:    http.StatusBadRequest,
			},
			forbidden: []string{secret, "secret-value", "private-itinerary", `"error":`},
		},
		{
			name: "異常系: 安全な診断情報を持たない HTTP 5xx は詳細エラーを出力しない",
			err:  errors.New(secret),
			failureContext: FailureContext{
				Operation: "http_request",
				Status:    http.StatusInternalServerError,
			},
			forbidden: []string{secret, "secret-value", "private-itinerary", `"error":`},
		},
		{
			name: "境界値系: nil と未検証の追加値を安全に扱う",
			failureContext: FailureContext{
				Route:          "/api/v1/journeys?token=secret-value",
				Status:         99,
				JourneyImageID: secret,
			},
			wantLogFragments: []string{
				`"operation":"unknown"`,
				`"error_kind":"unknown"`,
				`"cause_type":"<nil>"`,
			},
			forbidden: []string{"token=secret-value", "secret-value", `"status":99`, "journey_image_id"},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			var logs bytes.Buffer
			logger := slog.New(slog.NewJSONHandler(&logs, nil))

			LogFailure(
				context.Background(),
				logger,
				slog.LevelError,
				testCase.failureContext,
				testCase.err,
			)

			logText := logs.String()
			for _, want := range testCase.wantLogFragments {
				if !strings.Contains(logText, want) {
					t.Errorf("logs = %q, want fragment %q", logText, want)
				}
			}
			for _, forbidden := range testCase.forbidden {
				if strings.Contains(logText, forbidden) {
					t.Errorf("logs expose %q: %q", forbidden, logText)
				}
			}
		})
	}
}

func TestLogFailureIncludesSafeErrorDetail(t *testing.T) {
	const secret = "provider body contains private itinerary"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	cause := errors.New(secret)
	err := WithErrorDetail(
		ErrorDetailJourneyRouteParseFailed,
		cause,
	)

	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{Operation: "http_request", Status: http.StatusBadGateway},
		err,
	)

	logText := logs.String()
	if !strings.Contains(logText, `"error_detail":"journey_route_parse_failed"`) {
		t.Errorf("logs = %q, want safe error detail", logText)
	}
	if strings.Contains(logText, `"error":`) {
		t.Errorf("logs = %q, want no error text without a safe message", logText)
	}
	if strings.Contains(logText, secret) || strings.Contains(logText, "private itinerary") {
		t.Errorf("logs expose error detail: %q", logText)
	}
	if !errors.Is(err, cause) {
		t.Fatalf("WithErrorDetail() does not preserve cause: %v", err)
	}
}

func TestLogFailurePrefersSpecificSafeMessageOverErrorDetailAndBoundary(t *testing.T) {
	const secret = "api_key=secret-value provider body=private-itinerary"

	var logs bytes.Buffer
	err := WithSafeLogMessage(
		"run application failed",
		WithErrorDetail(
			ErrorDetailOpenRouterRequestFailed,
			WithSafeLogMessage("openrouter request failed", errors.New(secret)),
		),
	)
	LogFailure(
		context.Background(),
		slog.New(slog.NewJSONHandler(&logs, nil)),
		slog.LevelError,
		FailureContext{Operation: "http_request", Status: http.StatusBadGateway},
		err,
	)

	logText := logs.String()
	for _, want := range []string{
		`"error_detail":"openrouter_request_failed"`,
		`"error":"openrouter request failed"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "secret-value", "private-itinerary", "run application failed"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestSafeLogMessageUsesBoundaryMessageAsFallbackForJoinedErrors(t *testing.T) {
	const secret = "authorization=Bearer secret-value"
	cause := errors.New(secret)
	err := WithSafeLogMessage("serve application failed", errors.Join(cause, context.Canceled))

	if got := SafeLogMessage(err); got != "serve application failed" {
		t.Fatalf("SafeLogMessage() = %q, want boundary fallback", got)
	}
	if !errors.Is(err, cause) || !errors.Is(err, context.Canceled) {
		t.Fatalf("SafeLogMessage wrapper does not preserve joined causes: %v", err)
	}
}

func TestWithErrorDetailPreservesCause(t *testing.T) {
	cause := errors.New("provider body contains private itinerary")
	err := WithErrorDetail(ErrorDetailOpenRouterRequestFailed, cause)

	if !errors.Is(err, cause) {
		t.Fatalf("WithErrorDetail() does not preserve cause: %v", err)
	}
	if got := ErrorDetail(err); got != string(ErrorDetailOpenRouterRequestFailed) {
		t.Fatalf("ErrorDetail() = %q, want %q", got, ErrorDetailOpenRouterRequestFailed)
	}
	if got := ErrorDetail(WithErrorDetail(ErrorDetailCode("unapproved"), cause)); got != "" {
		t.Fatalf("ErrorDetail() = %q for unapproved detail, want empty", got)
	}
}

func TestLogFailureRejectsUntrustedContextValues(t *testing.T) {
	const secretOperation = "api_key_private_itinerary"
	const secretRoute = "/api/v1/journeys/private-itinerary"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{
			Operation: secretOperation,
			Route:     secretRoute,
			Status:    http.StatusInternalServerError,
		},
		WithOperation(secretOperation, errors.New("internal failure")),
	)

	logText := logs.String()
	if !strings.Contains(logText, `"operation":"unknown"`) {
		t.Errorf("logs = %q, want unknown operation", logText)
	}
	for _, forbidden := range []string{secretOperation, secretRoute, "private-itinerary", `"route":`, `"source_operation":`} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestWithOperationPreservesOnlyApprovedOperations(t *testing.T) {
	original := errors.New("database failure")
	tests := []struct {
		name      string
		operation string
		want      string
	}{
		{
			name:      "正常系: リポジトリ操作を保持する",
			operation: "find_journey",
			want:      "find_journey",
		},
		{
			name:      "正常系: OpenRouter画像生成操作を保持する",
			operation: "openrouter_generate_image",
			want:      "openrouter_generate_image",
		},
		{
			name:      "異常系: 空の操作名を捨てる",
			operation: "",
			want:      "",
		},
		{
			name:      "境界値系: 許可リスト外の操作名を捨てる",
			operation: "private_itinerary",
			want:      "",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := WithOperation(testCase.operation, original)
			if !errors.Is(err, original) {
				t.Errorf("WithOperation() must preserve original error: %v", err)
			}
			if got := SourceOperation(err); got != testCase.want {
				t.Errorf("SourceOperation() = %q, want %q", got, testCase.want)
			}
		})
	}
}

func TestLogRecoveredPanicDoesNotLogValue(t *testing.T) {
	const secret = "authorization=Bearer secret-value"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	LogRecoveredPanic(
		context.Background(),
		logger,
		"http_panic",
		"/api/v1/journeys/:id",
		errors.New(secret),
	)

	logText := logs.String()
	if !strings.Contains(logText, `"panic_type":"*errors.errorString"`) {
		t.Errorf("logs = %q, want panic type", logText)
	}
	if !strings.Contains(logText, `"stack":"goroutine `) {
		t.Errorf("logs = %q, want stack trace", logText)
	}
	if strings.Contains(logText, secret) || strings.Contains(logText, "secret-value") {
		t.Errorf("logs expose panic value: %q", logText)
	}
}

func TestCauseTypePrefersNonSentinelCause(t *testing.T) {
	providerError := &testProviderError{message: "provider response contains private data"}
	err := fmt.Errorf("generate journey: %w: %w", application.ErrGenerationFailed, providerError)

	if got, want := causeType(err), fmt.Sprintf("%T", providerError); got != want {
		t.Errorf("causeType() = %q, want %q", got, want)
	}
}

func TestLogFailureIncludesApprovedProviderDetails(t *testing.T) {
	const secret = "api_key=secret-value provider_body=private-itinerary"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	err := WithOperation(
		"openrouter_send_chat_completion",
		fmt.Errorf(
			"generate journey: %w: %w",
			application.ErrGenerationFailed,
			openrouterclient.WrapRequestError(sdkerrors.NewAPIError("request rejected", http.StatusTooManyRequests, secret, nil)),
		),
	)

	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{Operation: "http_request", Status: http.StatusBadGateway},
		err,
	)

	logText := logs.String()
	for _, want := range []string{
		`"source_operation":"openrouter_send_chat_completion"`,
		`"provider_status":429`,
		`"provider_error_class":"rate_limited"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "secret-value", "private-itinerary"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestLogFailureIncludesOpenRouterImageProviderDetails(t *testing.T) {
	const secret = "api_key=secret-value provider_body=private-itinerary"
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	err := WithOperation(
		"openrouter_generate_image",
		openrouterclient.WrapRequestError(sdkerrors.NewAPIError("image request rejected", http.StatusTooManyRequests, secret, nil)),
	)

	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{Operation: "generate_journey_image", Status: http.StatusBadGateway},
		err,
	)

	logText := logs.String()
	for _, want := range []string{
		`"source_operation":"openrouter_generate_image"`,
		`"provider_status":429`,
		`"provider_error_class":"rate_limited"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "secret-value", "private-itinerary"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestLogFailureIncludesPostgresSQLStateWithoutDetails(t *testing.T) {
	const secret = "Key (journey_id)=(private-itinerary) already exists"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	err := WithOperation(
		"save_journey",
		fmt.Errorf(
			"save journey: %w: %w",
			application.ErrDuplicateID,
			&pgconn.PgError{Code: "23505", Detail: secret},
		),
	)

	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{Operation: "http_request", Status: http.StatusConflict},
		err,
	)

	logText := logs.String()
	for _, want := range []string{
		`"source_operation":"save_journey"`,
		`"postgres_sqlstate":"23505"`,
		`"error_kind":"duplicate_id"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "private-itinerary", "journey_id"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestProviderErrorDetails(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		wantClass string
		err       error
	}{
		{
			name:      "認証失敗: 401",
			status:    http.StatusUnauthorized,
			wantClass: "authentication_failed",
		},
		{
			name:      "レート制限: 429",
			status:    http.StatusTooManyRequests,
			wantClass: "rate_limited",
		},
		{
			name:      "プロバイダー障害: 503",
			status:    http.StatusServiceUnavailable,
			wantClass: "provider_server_error",
		},
		{
			name:      "typed forbidden response: 403",
			status:    http.StatusForbidden,
			wantClass: "authentication_failed",
			err:       openrouterclient.WrapRequestError(&sdkerrors.ForbiddenResponseError{}),
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := testCase.err
			if err == nil {
				err = openrouterclient.WrapRequestError(sdkerrors.NewAPIError("provider error", testCase.status, "api_key=[REDACTED:API key param]", nil))
			}

			status, errorClass, ok := providerErrorDetails(err)
			if !ok {
				t.Fatal("providerErrorDetails() ok = false, want true")
			}
			if status != testCase.status {
				t.Errorf("status = %d, want %d", status, testCase.status)
			}
			if errorClass != testCase.wantClass {
				t.Errorf("error class = %q, want %q", errorClass, testCase.wantClass)
			}
		})
	}
}

type testProviderError struct {
	message string
}

func (e *testProviderError) Error() string {
	return e.message
}

func TestLogFailureIncludesSafeBookletContext(t *testing.T) {
	var logs bytes.Buffer
	journeyID := uuid.NewString()
	err := WithSafeLogMessage(
		"gotenberg request timed out",
		fmt.Errorf(
			"gotenberg request timed out: %w: %w",
			application.ErrBookletRenderFailed,
			domainservice.ErrBookletRenderTimeout,
		),
	)

	LogFailure(
		context.Background(),
		slog.New(slog.NewJSONHandler(&logs, nil)),
		slog.LevelError,
		FailureContext{
			JourneyID: journeyID,
			Operation: "render_booklet_pdf",
			ThemeSeed: "V2-ABCDEF12",
		},
		err,
	)

	logText := logs.String()
	for _, fragment := range []string{
		"\"operation\":\"render_booklet_pdf\"",
		"\"journey_id\":\"" + journeyID + "\"",
		"\"theme_seed\":\"v2-abcdef12\"",
		"\"error_kind\":\"booklet_render_failed\"",
		"\"cause_kind\":\"booklet_render_timeout\"",
		"\"error\":\"gotenberg request timed out\"",
	} {
		if !strings.Contains(logText, fragment) {
			t.Errorf("logs = %q, want fragment %q", logText, fragment)
		}
	}
}

func TestLogFailureDoesNotIncludeInvalidThemeSeed(t *testing.T) {
	var logs bytes.Buffer

	LogFailure(
		context.Background(),
		slog.New(slog.NewJSONHandler(&logs, nil)),
		slog.LevelError,
		FailureContext{
			Operation: "render_booklet_pdf",
			ThemeSeed: "v1-abcdef12",
		},
		application.ErrInvalidInput,
	)

	if logText := logs.String(); strings.Contains(logText, "theme_seed") {
		t.Errorf("logs contain invalid theme seed: %q", logText)
	}
}

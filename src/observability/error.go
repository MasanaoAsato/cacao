package observability

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"cacao/src/application"
	domainservice "cacao/src/domain/service"
)

var safeLogOperations = map[string]struct{}{
	"http_request":                    {},
	"http_panic":                      {},
	"run_application":                 {},
	"close_database":                  {},
	"close_image_storage":             {},
	"find_pending_journey_images":     {},
	"generate_journey_image":          {},
	"find_expired_journey_images":     {},
	"fail_expired_journey_image":      {},
	"save_expired_journey_image":      {},
	"save_journey":                    {},
	"save_journey_request":            {},
	"save_journey_image":              {},
	"claim_journey_image":             {},
	"find_journey_request":            {},
	"list_journey_requests":           {},
	"delete_journey_request":          {},
	"find_journey":                    {},
	"find_journey_by_request":         {},
	"list_journeys":                   {},
	"delete_journey":                  {},
	"find_journey_image":              {},
	"list_journey_images":             {},
	"find_journey_image_slot":         {},
	"delete_journey_image":            {},
	"openrouter_send_chat_completion": {},
	"openrouter_generate_image":       {},
}

var safeRoutes = map[string]struct{}{
	"/api/v1/journey-requests":                 {},
	"/api/v1/journey-requests/:id":             {},
	"/api/v1/journey-requests/:id/generate":    {},
	"/api/v1/journey-requests/:id/images":      {},
	"/api/v1/journeys":                         {},
	"/api/v1/journeys/:id":                     {},
	"/api/v1/journey-images/:image_id":         {},
	"/api/v1/journey-images/:image_id/content": {},
	"/api/v1/journey-images/:image_id/retry":   {},
}

// FailureContext は機微情報を含めずに失敗を識別するログ項目である。
type FailureContext struct {
	Operation      string
	Route          string
	Status         int
	JourneyImageID string
}

// ErrorDetailCode は構造化失敗ログに記録できる固定の原因コードである。
// 外部プロバイダーの本文やユーザー入力はこの型の値にしない。
type ErrorDetailCode string

const (
	ErrorDetailOpenRouterRequestFailed                   ErrorDetailCode = "openrouter_request_failed"
	ErrorDetailOpenRouterResponseMissingChatResult       ErrorDetailCode = "openrouter_response_missing_chat_result"
	ErrorDetailOpenRouterResponseNoChoices               ErrorDetailCode = "openrouter_response_no_choices"
	ErrorDetailOpenRouterResponseEmptyMessageContent     ErrorDetailCode = "openrouter_response_empty_message_content"
	ErrorDetailOpenRouterResponseMessageContentNotString ErrorDetailCode = "openrouter_response_message_content_not_string"
	ErrorDetailJourneyRouteParseFailed                   ErrorDetailCode = "journey_route_parse_failed"
	ErrorDetailImageProviderTimeout                      ErrorDetailCode = "image_provider_timeout"
	ErrorDetailImageProviderUnavailable                  ErrorDetailCode = "image_provider_unavailable"
	ErrorDetailImageGenerationRejected                   ErrorDetailCode = "image_generation_rejected"
	ErrorDetailGeneratedImageInvalid                     ErrorDetailCode = "generated_image_invalid"
)

type safeErrorDetailCarrier interface {
	SafeLogErrorDetail() ErrorDetailCode
}

// WithErrorDetail は allowlist 済みの固定原因コードを error chain に付与する。
func WithErrorDetail(detail ErrorDetailCode, err error) error {
	if err == nil || !isSafeErrorDetail(detail) {
		return err
	}
	return &errorDetailError{detail: detail, cause: err}
}

type errorDetailError struct {
	detail ErrorDetailCode
	cause  error
}

func (e *errorDetailError) Error() string {
	if e.cause == nil {
		return string(e.detail)
	}
	return e.cause.Error()
}

func (e *errorDetailError) Unwrap() error {
	return e.cause
}

func (e *errorDetailError) SafeLogErrorDetail() ErrorDetailCode {
	return e.detail
}

// ErrorDetail は error chain から allowlist 済みの原因コードだけを返す。
func ErrorDetail(err error) string {
	var carrier safeErrorDetailCarrier
	if !errors.As(err, &carrier) || carrier == nil {
		return ""
	}
	detail := carrier.SafeLogErrorDetail()
	if !isSafeErrorDetail(detail) {
		return ""
	}
	return string(detail)
}

func isSafeErrorDetail(detail ErrorDetailCode) bool {
	switch detail {
	case ErrorDetailOpenRouterRequestFailed,
		ErrorDetailOpenRouterResponseMissingChatResult,
		ErrorDetailOpenRouterResponseNoChoices,
		ErrorDetailOpenRouterResponseEmptyMessageContent,
		ErrorDetailOpenRouterResponseMessageContentNotString,
		ErrorDetailJourneyRouteParseFailed,
		ErrorDetailImageProviderTimeout,
		ErrorDetailImageProviderUnavailable,
		ErrorDetailImageGenerationRejected,
		ErrorDetailGeneratedImageInvalid:
		return true
	default:
		return false
	}
}

// LogFailure は error の本文を出力せず、分類済みの失敗イベントを記録する。
func LogFailure(
	ctx context.Context,
	logger *slog.Logger,
	level slog.Level,
	failureContext FailureContext,
	err error,
) {
	if ctx == nil {
		ctx = context.Background()
	}
	if logger == nil {
		logger = slog.Default()
	}

	attrs := []slog.Attr{
		slog.String("operation", safeOperation(failureContext.Operation)),
		slog.String("error_kind", errorKind(err)),
		slog.String("cause_kind", causeKind(err)),
		slog.String("cause_type", causeType(err)),
	}
	if route := safeRoute(failureContext.Route); route != "" {
		attrs = append(attrs, slog.String("route", route))
	}
	if status := safeStatus(failureContext.Status); status != 0 {
		attrs = append(attrs, slog.Int("status", status))
	}
	if imageID := safeUUID(failureContext.JourneyImageID); imageID != "" {
		attrs = append(attrs, slog.String("journey_image_id", imageID))
	}
	if SourceOperation := SourceOperation(err); SourceOperation != "" {
		attrs = append(attrs, slog.String("source_operation", SourceOperation))
	}
	if detail := ErrorDetail(err); detail != "" {
		attrs = append(attrs, slog.String("error_detail", detail))
	}
	if status, errorClass, ok := providerErrorDetails(err); ok {
		attrs = append(
			attrs,
			slog.Int("provider_status", status),
			slog.String("provider_error_class", errorClass),
		)
	}
	if sqlState := PostgresSQLState(err); sqlState != "" {
		attrs = append(attrs, slog.String("postgres_sqlstate", sqlState))
	}

	logger.LogAttrs(ctx, level, "operation failed", attrs...)
}

// LogRecoveredPanic は panic 値を文字列化せず、安全な情報だけを記録する。
func LogRecoveredPanic(
	ctx context.Context,
	logger *slog.Logger,
	operation string,
	route string,
	recovered any,
) {
	if ctx == nil {
		ctx = context.Background()
	}
	if logger == nil {
		logger = slog.Default()
	}

	attrs := []slog.Attr{
		slog.String("operation", safeOperation(operation)),
		slog.String("panic_type", fmt.Sprintf("%T", recovered)),
	}
	if safeRoute := safeRoute(route); safeRoute != "" {
		attrs = append(attrs, slog.String("route", safeRoute))
	}

	logger.LogAttrs(ctx, slog.LevelError, "panic recovered", attrs...)
}

// errorKind はアプリケーション契約上の失敗分類を返す。
func errorKind(err error) string {
	switch {
	case err == nil:
		return "unknown"
	case errors.Is(err, application.ErrInvalidInput):
		return "invalid_input"
	case errors.Is(err, application.ErrJourneyNotFound):
		return "journey_not_found"
	case errors.Is(err, application.ErrRequestNotFound):
		return "journey_request_not_found"
	case errors.Is(err, application.ErrJourneyImageNotFound):
		return "journey_image_not_found"
	case errors.Is(err, application.ErrJourneyImageNotReady):
		return "journey_image_not_ready"
	case errors.Is(err, application.ErrJourneyImageRetryNotAllowed):
		return "journey_image_retry_not_allowed"
	case errors.Is(err, application.ErrGenerationFailed):
		return "generation_failed"
	case errors.Is(err, application.ErrDuplicateID):
		return "duplicate_id"
	default:
		return "internal_error"
	}
}

// causeKind は error chain の安全な技術分類を返す。
func causeKind(err error) string {
	switch {
	case err == nil:
		return "unknown"
	case errors.Is(err, context.Canceled):
		return "context_canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "deadline_exceeded"
	case errors.Is(err, domainservice.ErrImageGeneratorTimeout):
		return "image_generator_timeout"
	case errors.Is(err, domainservice.ErrImageGeneratorUnavailable):
		return "image_generator_unavailable"
	case errors.Is(err, domainservice.ErrImageGenerationRejected):
		return "image_generation_rejected"
	case errors.Is(err, domainservice.ErrGeneratedImageInvalid):
		return "generated_image_invalid"
	}

	var networkError net.Error
	if errors.As(err, &networkError) {
		if networkError.Timeout() {
			return "network_timeout"
		}
		return "network_error"
	}

	var pathError *os.PathError
	if errors.As(err, &pathError) {
		return "filesystem_error"
	}

	return "internal_error"
}

// causeType は error chain の根本原因の Go 型名だけを返す。
func causeType(err error) string {
	causes := rootCauses(err, 0)
	if len(causes) == 0 {
		return "<nil>"
	}
	for _, cause := range causes {
		if !isClassificationSentinel(cause) {
			return fmt.Sprintf("%T", cause)
		}
	}
	return fmt.Sprintf("%T", causes[0])
}

func rootCauses(err error, depth int) []error {
	const maximumUnwrapDepth = 16

	if err == nil || depth == maximumUnwrapDepth {
		return nil
	}

	if multi, ok := err.(interface{ Unwrap() []error }); ok {
		var causes []error
		for _, cause := range multi.Unwrap() {
			causes = append(causes, rootCauses(cause, depth+1)...)
		}
		if len(causes) > 0 {
			return causes
		}
	}

	if single, ok := err.(interface{ Unwrap() error }); ok {
		if cause := single.Unwrap(); cause != nil {
			return rootCauses(cause, depth+1)
		}
	}

	return []error{err}
}

func isClassificationSentinel(err error) bool {
	return errors.Is(err, application.ErrInvalidInput) ||
		errors.Is(err, application.ErrJourneyNotFound) ||
		errors.Is(err, application.ErrRequestNotFound) ||
		errors.Is(err, application.ErrJourneyImageNotFound) ||
		errors.Is(err, application.ErrJourneyImageNotReady) ||
		errors.Is(err, application.ErrJourneyImageRetryNotAllowed) ||
		errors.Is(err, application.ErrGenerationFailed) ||
		errors.Is(err, application.ErrDuplicateID) ||
		errors.Is(err, domainservice.ErrImageGeneratorTimeout) ||
		errors.Is(err, domainservice.ErrImageGeneratorUnavailable) ||
		errors.Is(err, domainservice.ErrImageGenerationRejected) ||
		errors.Is(err, domainservice.ErrGeneratedImageInvalid)
}

type safeOperationCarrier interface {
	SafeLogOperation() string
}

type operationError struct {
	operation string
	cause     error
}

func (e *operationError) Error() string {
	return e.operation + ": " + e.cause.Error()
}

func (e *operationError) Unwrap() error {
	return e.cause
}

func (e *operationError) SafeLogOperation() string {
	return e.operation
}

// WithOperation はエラーに固定の処理名を付与し、安全なログ属性として利用できるようにする。
func WithOperation(operation string, err error) error {
	if err == nil {
		return nil
	}
	if operation = safeSourceOperation(operation); operation == "" {
		return err
	}
	return &operationError{operation: operation, cause: err}
}

// SourceOperation は error chain に含まれる許可済みの処理名を返す。
func SourceOperation(err error) string {
	var carrier safeOperationCarrier
	if !errors.As(err, &carrier) {
		return ""
	}
	return safeSourceOperation(carrier.SafeLogOperation())
}

// providerErrorDetails は外部プロバイダーの安全な HTTP 分類だけを返す。
func providerErrorDetails(err error) (int, string, bool) {
	if status, ok := providerStatusCode(err); ok {
		return status, providerErrorClass(status), true
	}
	return 0, "", false
}

// providerStatusCarrier はプロバイダーの HTTP ステータスを保持するエラーが満たす契約。
// SDK 固有の型にはここでは依存せず、各クライアントパッケージが実装する。
type providerStatusCarrier interface {
	ProviderStatusCode() int
}

func providerStatusCode(err error) (int, bool) {
	var carrier providerStatusCarrier
	if !errors.As(err, &carrier) || carrier == nil {
		return 0, false
	}
	if status := safeStatus(carrier.ProviderStatusCode()); status != 0 {
		return status, true
	}
	return 0, false
}

// PostgresSQLState は PostgreSQL の SQLSTATE だけを返す。
func PostgresSQLState(err error) string {
	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) || pgError == nil {
		return ""
	}
	if !isSQLState(pgError.Code) {
		return ""
	}
	return pgError.Code
}

func providerErrorClass(status int) string {
	const providerServerErrorMinimum = 500

	switch {
	case status == 401 || status == 403:
		return "authentication_failed"
	case status == 429:
		return "rate_limited"
	case status >= providerServerErrorMinimum:
		return "provider_server_error"
	default:
		return "provider_client_error"
	}
}

func safeSourceOperation(operation string) string {
	if _, ok := safeLogOperations[operation]; !ok {
		return ""
	}
	return operation
}

func isSQLState(code string) bool {
	if len(code) != 5 {
		return false
	}
	for _, character := range code {
		if (character < '0' || character > '9') && (character < 'A' || character > 'Z') {
			return false
		}
	}
	return true
}

func safeOperation(operation string) string {
	if operation = safeSourceOperation(operation); operation == "" {
		return "unknown"
	}
	return operation
}

func safeRoute(route string) string {
	if _, ok := safeRoutes[route]; !ok {
		return ""
	}
	return route
}

func safeStatus(status int) int {
	if status < 100 || status > 599 {
		return 0
	}
	return status
}

func safeUUID(value string) string {
	id, err := uuid.Parse(value)
	if err != nil {
		return ""
	}
	return id.String()
}

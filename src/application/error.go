package application

import "errors"

var (
	ErrInvalidInput                = errors.New("invalid input")
	ErrJourneyNotFound             = errors.New("journey not found")
	ErrRequestNotFound             = errors.New("journey request not found")
	ErrJourneyImageNotFound        = errors.New("journey image not found")
	ErrJourneyImageNotReady        = errors.New("journey image not ready")
	ErrJourneyImageRetryNotAllowed = errors.New("journey image retry not allowed")
	ErrGenerationFailed            = errors.New("journey generation failed")
	ErrDuplicateID                 = errors.New("duplicate id")
)

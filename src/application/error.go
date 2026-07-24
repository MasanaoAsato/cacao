package application

import "errors"

var (
	ErrInvalidInput     = errors.New("invalid input")
	ErrJourneyNotFound  = errors.New("journey not found")
	ErrRequestNotFound  = errors.New("journey request not found")
	ErrGenerationFailed = errors.New("journey generation failed")
	ErrDuplicateID      = errors.New("duplicate id")
)

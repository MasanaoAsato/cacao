package event

import (
	"testing"

	"cacao/src/domain/value_object"
)

func TestNewJourneyRequested(t *testing.T) {
	requestID := value_object.NewID()

	event := NewJourneyRequested(requestID)

	if !event.RequestID().Equals(requestID) {
		t.Fatal("RequestID mismatch")
	}
	if event.OccurredAt().IsZero() {
		t.Fatal("OccurredAt must not be zero")
	}
}

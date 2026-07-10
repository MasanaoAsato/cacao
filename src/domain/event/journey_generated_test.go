package event

import (
	"testing"

	"cacao/src/domain/value_object"
)

func TestNewJourneyGenerated(t *testing.T) {
	journeyID := value_object.NewID()
	requestID := value_object.NewID()

	event := NewJourneyGenerated(journeyID, requestID)

	if !event.JourneyID().Equals(journeyID) {
		t.Fatal("JourneyID mismatch")
	}
	if !event.RequestID().Equals(requestID) {
		t.Fatal("RequestID mismatch")
	}
	if event.OccurredAt().IsZero() {
		t.Fatal("OccurredAt must not be zero")
	}
}

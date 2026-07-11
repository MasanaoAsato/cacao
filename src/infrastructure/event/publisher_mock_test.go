package event

import (
	"context"
	"errors"
	"testing"

	"cacao/src/domain/event"
	"cacao/src/domain/value_object"
)

func TestPublisherMock_PublishAndEvents(t *testing.T) {
	publisher := NewPublisherMock()
	ctx := context.Background()
	e1 := event.NewJourneyRequested(value_object.NewID())
	e2 := event.NewJourneyGenerated(value_object.NewID(), value_object.NewID())

	if err := publisher.Publish(ctx, e1); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}
	if err := publisher.Publish(ctx, e2); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	events := publisher.Events()
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}
	if !events[0].OccurredAt().Equal(e1.OccurredAt()) {
		t.Errorf("first event mismatch")
	}
	if !events[1].OccurredAt().Equal(e2.OccurredAt()) {
		t.Errorf("second event mismatch")
	}
}

func TestPublisherMock_Publish_Error(t *testing.T) {
	publisher := NewPublisherMock()
	publisher.ErrOn = errors.New("injected error")
	ctx := context.Background()

	err := publisher.Publish(ctx, event.NewJourneyRequested(value_object.NewID()))
	if !errors.Is(err, publisher.ErrOn) {
		t.Errorf("expected injected error, got %v", err)
	}
}

func TestPublisherMock_Reset(t *testing.T) {
	publisher := NewPublisherMock()
	ctx := context.Background()

	if err := publisher.Publish(ctx, event.NewJourneyRequested(value_object.NewID())); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}
	publisher.Reset()

	if len(publisher.Events()) != 0 {
		t.Errorf("expected 0 events after reset, got %d", len(publisher.Events()))
	}
}

func TestPublisherMock_Events_ReturnsCopy(t *testing.T) {
	publisher := NewPublisherMock()
	ctx := context.Background()
	if err := publisher.Publish(ctx, event.NewJourneyRequested(value_object.NewID())); err != nil {
		t.Fatalf("Publish failed: %v", err)
	}

	events := publisher.Events()
	events = append(events, event.NewJourneyRequested(value_object.NewID()))

	if len(publisher.Events()) != 1 {
		t.Errorf("expected internal events unchanged, got %d", len(publisher.Events()))
	}
}

func TestPublisherMock_ConcurrentPublish(t *testing.T) {
	publisher := NewPublisherMock()
	ctx := context.Background()

	done := make(chan struct{})
	for i := 0; i < 10; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			if err := publisher.Publish(ctx, event.NewJourneyRequested(value_object.NewID())); err != nil {
				t.Errorf("Publish failed: %v", err)
			}
		}()
	}
	for i := 0; i < 10; i++ {
		<-done
	}

	if len(publisher.Events()) != 10 {
		t.Errorf("expected 10 events, got %d", len(publisher.Events()))
	}
}

package entity

import (
	"cacao/src/domain/value_object"
	"fmt"
	"time"
)

type Leg struct {
	id       value_object.ID
	from     value_object.Endpoint
	to       value_object.Endpoint
	mode     value_object.TransportMode
	duration time.Duration
	cost     value_object.Money
}

func NewLeg(id value_object.ID, from value_object.Endpoint, to value_object.Endpoint, mode value_object.TransportMode, duration time.Duration, cost value_object.Money) (Leg, error) {
	if id.IsEmpty() {
		return Leg{}, fmt.Errorf("leg id must not be empty")
	}
	if from.Equals(to) {
		return Leg{}, fmt.Errorf("leg from and to must differ")
	}
	if duration <= 0 {
		return Leg{}, fmt.Errorf("leg duration must be positive, got %v", duration)
	}

	return Leg{
		id:       id,
		from:     from,
		to:       to,
		mode:     mode,
		duration: duration,
		cost:     cost,
	}, nil
}

func (l Leg) ID() value_object.ID {
	return l.id
}

func (l Leg) From() value_object.Endpoint {
	return l.from
}

func (l Leg) To() value_object.Endpoint {
	return l.to
}

func (l Leg) Mode() value_object.TransportMode {
	return l.mode
}

func (l Leg) Duration() time.Duration {
	return l.duration
}

func (l Leg) Cost() value_object.Money {
	return l.cost
}

func (l Leg) Equals(other Leg) bool {
	return l.id.Equals(other.id)
}

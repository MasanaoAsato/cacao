package value_object

import "fmt"

type TransportMode string

const (
	TransportModeWalk    TransportMode = "walk"
	TransportModeTrain   TransportMode = "train"
	TransportModeBus     TransportMode = "bus"
	TransportModeCar     TransportMode = "car"
	TransportModeTaxi    TransportMode = "taxi"
	TransportModeBicycle TransportMode = "bicycle"
	TransportModeFlight  TransportMode = "flight"
	TransportModeFerry   TransportMode = "ferry"
	TransportModeOther   TransportMode = "other"
)

var validTransportModes = map[TransportMode]struct{}{
	TransportModeWalk:    {},
	TransportModeTrain:   {},
	TransportModeBus:     {},
	TransportModeCar:     {},
	TransportModeTaxi:    {},
	TransportModeBicycle: {},
	TransportModeFlight:  {},
	TransportModeFerry:   {},
	TransportModeOther:   {},
}

func NewTransportMode(s string) (TransportMode, error) {
	m := TransportMode(s)
	if _, ok := validTransportModes[m]; !ok {
		return "", fmt.Errorf("invalid transport mode: %q", s)
	}

	return m, nil
}

func (t TransportMode) String() string {
	return string(t)
}

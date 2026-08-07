package value_object

import (
	"fmt"
	"strings"
)

type Destination struct {
	city    string
	country string
}

func NewDestination(city, country string) (Destination, error) {
	trimmedCity := strings.TrimSpace(city)
	if trimmedCity == "" {
		return Destination{}, fmt.Errorf("city must not be empty")
	}
	return Destination{
		city:    trimmedCity,
		country: strings.TrimSpace(country),
	}, nil
}

func (d Destination) City() string {
	return d.city
}

func (d Destination) Country() string {
	return d.country
}

func (d Destination) String() string {
	if d.country == "" {
		return d.city
	}
	return fmt.Sprintf("%s, %s", d.city, d.country)
}

func (d Destination) Equals(other Destination) bool {
	return d.city == other.city && d.country == other.country
}

// Package readmodel はユースケースが返す読み取り専用 DTO と、
// エンティティから DTO への変換を1箇所にまとめる。
// 複数のユースケースが同じ集約を返すため、DTO の定義と変換は共有する。
package readmodel

import (
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// JourneyDTO は Journey エンティティの読み取り専用表現。
type JourneyDTO struct {
	ID        string
	RequestID string
	DayCount  int
	Days      []ItineraryDayDTO
}

// ItineraryDayDTO は ItineraryDay エンティティの読み取り専用表現。
type ItineraryDayDTO struct {
	ID    string
	Date  time.Time
	Spots []SpotDTO
	Legs  []LegDTO
}

// SpotDTO は Spot エンティティの読み取り専用表現。
type SpotDTO struct {
	ID            string
	Name          string
	Description   string
	StartAt       time.Time
	EstimatedCost MoneyDTO
}

// LegDTO は Leg エンティティの読み取り専用表現。
type LegDTO struct {
	ID              string
	From            EndpointDTO
	To              EndpointDTO
	Mode            string
	DurationMinutes int
	EstimatedCost   MoneyDTO
}

// MoneyDTO は Money 値オブジェクトの読み取り専用表現。
type MoneyDTO struct {
	Amount   int
	Currency string
}

// EndpointDTO は Endpoint 値オブジェクトの読み取り専用表現。
type EndpointDTO struct {
	SpotID string // スポット参照時はスポット ID、旅程外地点では空文字
	Label  string // 表示名。スポット参照時はユースケースがスポット名を解決して設定
}

// NewJourneyDTO は Journey を DTO に変換する。
func NewJourneyDTO(journey entity.Journey) JourneyDTO {
	days := journey.Days()
	dayDTOs := make([]ItineraryDayDTO, 0, len(days))
	for _, day := range days {
		dayDTOs = append(dayDTOs, NewItineraryDayDTO(day))
	}

	return JourneyDTO{
		ID:        journey.ID().String(),
		RequestID: journey.RequestID().String(),
		DayCount:  journey.DayCount(),
		Days:      dayDTOs,
	}
}

// NewJourneyDTOs は Journey のスライスを DTO のスライスに変換する。
func NewJourneyDTOs(journeys []entity.Journey) []JourneyDTO {
	dtos := make([]JourneyDTO, 0, len(journeys))
	for _, journey := range journeys {
		dtos = append(dtos, NewJourneyDTO(journey))
	}
	return dtos
}

// NewItineraryDayDTO は ItineraryDay を DTO に変換する。
// Endpoint の Label は日内のスポット名から解決する（プレゼンターは「ただ写すだけ」に保つ）。
func NewItineraryDayDTO(day entity.ItineraryDay) ItineraryDayDTO {
	spots := day.Spots()
	spotDTOs := make([]SpotDTO, 0, len(spots))
	spotNames := make(map[string]string, len(spots))
	for _, spot := range spots {
		spotDTOs = append(spotDTOs, NewSpotDTO(spot))
		spotNames[spot.ID().String()] = spot.Name()
	}

	legs := day.Legs()
	legDTOs := make([]LegDTO, 0, len(legs))
	for _, leg := range legs {
		legDTOs = append(legDTOs, newLegDTO(leg, spotNames))
	}

	return ItineraryDayDTO{
		ID:    day.ID().String(),
		Date:  day.Date(),
		Spots: spotDTOs,
		Legs:  legDTOs,
	}
}

// NewSpotDTO は Spot を DTO に変換する。
func NewSpotDTO(spot entity.Spot) SpotDTO {
	return SpotDTO{
		ID:            spot.ID().String(),
		Name:          spot.Name(),
		Description:   spot.Description(),
		StartAt:       spot.StartAt(),
		EstimatedCost: NewMoneyDTO(spot.EstimatedCost()),
	}
}

func newLegDTO(leg entity.Leg, spotNames map[string]string) LegDTO {
	return LegDTO{
		ID:   leg.ID().String(),
		From: newEndpointDTO(leg.From(), spotNames),
		To:   newEndpointDTO(leg.To(), spotNames),
		Mode: leg.Mode().String(),
		// Duration() はナノ秒精度だが、ドメイン層で「分」単位で生成・保持されるため分に変換する。
		DurationMinutes: int(leg.Duration().Minutes()),
		EstimatedCost:   NewMoneyDTO(leg.Cost()),
	}
}

// newEndpointDTO は Endpoint を DTO に変換する。
// スポット参照時は SpotID を設定し、Label をスポット名から解決する。
// 旅程外地点（名前付き）は SpotID を空にし、Label に元の地点名を設定する。
func newEndpointDTO(endpoint value_object.Endpoint, spotNames map[string]string) EndpointDTO {
	if endpoint.IsSpot() {
		id := endpoint.SpotID()
		return EndpointDTO{
			SpotID: id.String(),
			Label:  spotNames[id.String()],
		}
	}
	return EndpointDTO{
		SpotID: "",
		Label:  endpoint.Label(),
	}
}

// NewMoneyDTO は Money を DTO に変換する。
func NewMoneyDTO(money value_object.Money) MoneyDTO {
	return MoneyDTO{
		Amount:   money.Amount(),
		Currency: money.Currency().Code(),
	}
}

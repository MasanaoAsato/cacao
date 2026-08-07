package postgres

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
	"cmp"
	"fmt"
	"slices"
	"time"
)

func journeyRequestToModel(jr entity.JourneyRequest) (JourneyRequestModel, error) {
	if jr.ID().IsEmpty() {
		return JourneyRequestModel{}, fmt.Errorf("journey request id is empty")
	}

	period := jr.Period()
	budget := jr.Budget()
	departure := jr.Departure()
	destination := jr.Destination()

	return JourneyRequestModel{
		ID:                 jr.ID().String(),
		DepartureCity:      departure.City(),
		DepartureCountry:   departure.Country(),
		DestinationCity:    destination.City(),
		DestinationCountry: destination.Country(),
		StartDate:          period.StartDate(),
		EndDate:            period.EndDate(),
		BudgetAmount:       budget.Amount(),
		BudgetCurrency:     budget.Currency().Code(),
	}, nil
}

func modelToJourneyRequest(m JourneyRequestModel) (entity.JourneyRequest, error) {
	id, err := value_object.NewIDFromString(m.ID)
	if err != nil {
		return entity.JourneyRequest{}, fmt.Errorf("journey request id: %w", err)
	}

	departure, err := value_object.NewDeparture(m.DepartureCity, m.DepartureCountry)
	if err != nil {
		return entity.JourneyRequest{}, fmt.Errorf("departure: %w", err)
	}

	destination, err := value_object.NewDestination(m.DestinationCity, m.DestinationCountry)
	if err != nil {
		return entity.JourneyRequest{}, fmt.Errorf("destination: %w", err)
	}

	period, err := value_object.NewPeriod(m.StartDate, m.EndDate)
	if err != nil {
		return entity.JourneyRequest{}, fmt.Errorf("period: %w", err)
	}

	currency, err := value_object.NewCurrency(m.BudgetCurrency)
	if err != nil {
		return entity.JourneyRequest{}, fmt.Errorf("currency: %w", err)
	}
	budget, err := value_object.NewMoney(m.BudgetAmount, currency)
	if err != nil {
		return entity.JourneyRequest{}, fmt.Errorf("budget: %w", err)
	}

	return entity.NewJourneyRequest(id, departure, destination, period, budget)
}

func journeyToModel(j entity.Journey) (JourneyModel, error) {
	if j.ID().IsEmpty() {
		return JourneyModel{}, fmt.Errorf("journey id is empty")
	}
	if j.RequestID().IsEmpty() {
		return JourneyModel{}, fmt.Errorf("journey request id is empty")
	}

	days := j.Days()
	dayModels := make([]ItineraryDayModel, 0, len(days))

	for _, day := range days {
		dm, err := itineraryDayToModel(j.ID(), day)
		if err != nil {
			return JourneyModel{}, fmt.Errorf("convert day %s: %w", day.ID().String(), err)
		}
		dayModels = append(dayModels, dm)
	}
	return JourneyModel{
		ID:               j.ID().String(),
		JourneyRequestID: j.RequestID().String(),
		Days:             dayModels,
	}, nil
}

func modelToJourney(m JourneyModel) (entity.Journey, error) {
	// 1. ID を value_object.NewIDFromString で復元
	id, err := value_object.NewIDFromString(m.ID)
	if err != nil {
		return entity.Journey{}, fmt.Errorf("journey id: %w", err)
	}
	requestID, err := value_object.NewIDFromString(m.JourneyRequestID)
	if err != nil {
		return entity.Journey{}, fmt.Errorf("journey request id: %w", err)
	}

	// 2. 各 ItineraryDayModel -> entity.ItineraryDay (NewItineraryDay 呼出)
	//    (内部で 3. 各 SpotModel -> entity.Spot (NewSpot 呼出) も行う)
	days := make([]entity.ItineraryDay, 0, len(m.Days))
	for _, dm := range m.Days {
		day, err := modelToItineraryDay(dm)
		if err != nil {
			return entity.Journey{}, fmt.Errorf("convert day %s: %w", dm.ID, err)
		}
		days = append(days, day)
	}

	// 4. 最後に entity.NewJourney で集約全体を再構築（不変条件再検証）
	// journeys テーブルは期間カラムを持たないため、日程の最小日〜最大日から
	// Period を復元する。これにより「全日程が期間内」という不変条件を満たしつつ、
	// ID の有効性・日程の重複など残りの不変条件を NewJourney に再検証させる。
	period, err := periodFromDays(days)
	if err != nil {
		return entity.Journey{}, err
	}

	return entity.NewJourney(id, requestID, period, days)
}

// modelToItineraryDay は ItineraryDayModel から entity.ItineraryDay を復元する。
// 子の SpotModel を entity.Spot に、LegModel を entity.Leg に変換し、
// NewItineraryDay で連鎖不変条件（legs がスポット列を辿るチェーン）を再検証する。
// これにより、DB 上の legs が壊れていてもドメイン層で検出できる。
func modelToItineraryDay(m ItineraryDayModel) (entity.ItineraryDay, error) {
	id, err := value_object.NewIDFromString(m.ID)
	if err != nil {
		return entity.ItineraryDay{}, fmt.Errorf("itinerary day id: %w", err)
	}

	spots := make([]entity.Spot, 0, len(m.Spots))
	for _, sm := range m.Spots {
		spot, err := modelToSpot(sm)
		if err != nil {
			return entity.ItineraryDay{}, fmt.Errorf("convert spot %s: %w", sm.ID, err)
		}
		spots = append(spots, spot)
	}

	// NewItineraryDay は spots を StartAt 昇順に整列するため、Leg も同じ順序で生成する必要がある。
	// モデル側の並びが逆順でも、先にソートしておけば連鎖検証が壊れない。
	slices.SortStableFunc(spots, func(a, b entity.Spot) int {
		return a.StartAt().Compare(b.StartAt())
	})

	// legs は Seq 昇順（0,1,2,...）で復元する。Seq は日内の区間順序を示すため、
	// DB 側の並び順に依存せず必ず順序どおりに並べる。
	legModels := make([]LegModel, len(m.Legs))
	copy(legModels, m.Legs)
	slices.SortStableFunc(legModels, func(a, b LegModel) int {
		return cmp.Compare(a.Seq, b.Seq)
	})

	legs := make([]entity.Leg, 0, len(legModels))
	for _, lm := range legModels {
		leg, err := modelToLeg(lm)
		if err != nil {
			return entity.ItineraryDay{}, fmt.Errorf("convert leg %s: %w", lm.ID, err)
		}
		legs = append(legs, leg)
	}

	// スポット列と対になるよう、legs が連鎖をなしているかを NewItineraryDay で再検証する。
	return entity.NewItineraryDay(id, m.Date, spots, legs)
}

// modelToLeg は LegModel から entity.Leg を復元し、NewLeg で不変条件を再検証する。
func modelToLeg(m LegModel) (entity.Leg, error) {
	id, err := value_object.NewIDFromString(m.ID)
	if err != nil {
		return entity.Leg{}, fmt.Errorf("leg id: %w", err)
	}

	// from は from_spot_id が非 NULL ならスポット参照、NULL なら from_label を使う。
	// 両方空（from_spot_id が NULL かつ from_label が空）は、名前付き Endpoint の
	// 生成時にエラーになり、DB の破損として検出される。
	var from value_object.Endpoint
	if m.FromSpotID != nil {
		fromID, err := value_object.NewIDFromString(*m.FromSpotID)
		if err != nil {
			return entity.Leg{}, fmt.Errorf("leg from spot id: %w", err)
		}
		from, err = value_object.NewSpotEndpoint(fromID)
		if err != nil {
			return entity.Leg{}, fmt.Errorf("leg from endpoint: %w", err)
		}
	} else {
		from, err = value_object.NewNamedEndpoint(m.FromLabel)
		if err != nil {
			return entity.Leg{}, fmt.Errorf("leg from endpoint: %w", err)
		}
	}

	toID, err := value_object.NewIDFromString(m.ToSpotID)
	if err != nil {
		return entity.Leg{}, fmt.Errorf("leg to spot id: %w", err)
	}
	to, err := value_object.NewSpotEndpoint(toID)
	if err != nil {
		return entity.Leg{}, fmt.Errorf("leg to endpoint: %w", err)
	}

	mode, err := value_object.NewTransportMode(m.TransportMode)
	if err != nil {
		return entity.Leg{}, fmt.Errorf("leg transport mode: %w", err)
	}

	currency, err := value_object.NewCurrency(m.Currency)
	if err != nil {
		return entity.Leg{}, fmt.Errorf("leg currency: %w", err)
	}
	cost, err := value_object.NewMoney(m.Amount, currency)
	if err != nil {
		return entity.Leg{}, fmt.Errorf("leg cost: %w", err)
	}

	return entity.NewLeg(id, from, to, mode, time.Duration(m.DurationMinutes)*time.Minute, cost)
}

// modelToSpot は SpotModel から entity.Spot を復元する。
// Amount/Currency の2カラムから value_object.Money を組み立て直す。
func modelToSpot(m SpotModel) (entity.Spot, error) {
	id, err := value_object.NewIDFromString(m.ID)
	if err != nil {
		return entity.Spot{}, fmt.Errorf("spot id: %w", err)
	}

	currency, err := value_object.NewCurrency(m.Currency)
	if err != nil {
		return entity.Spot{}, fmt.Errorf("currency: %w", err)
	}
	cost, err := value_object.NewMoney(m.Amount, currency)
	if err != nil {
		return entity.Spot{}, fmt.Errorf("estimated cost: %w", err)
	}

	return entity.NewSpot(id, m.Name, m.Description, m.StartAt, cost)
}

// periodFromDays は日程の最小日〜最大日から Period を復元する。
// journeys テーブルは期間カラムを持たないため、集約内の日程から導出する。
func periodFromDays(days []entity.ItineraryDay) (value_object.Period, error) {
	if len(days) == 0 {
		return value_object.Period{}, fmt.Errorf("journey must have at least one day")
	}

	start := days[0].Date()
	end := days[0].Date()
	for _, d := range days[1:] {
		if d.Date().Before(start) {
			start = d.Date()
		}
		if d.Date().After(end) {
			end = d.Date()
		}
	}
	return value_object.NewPeriod(start, end)
}

func itineraryDayToModel(journeyID value_object.ID, d entity.ItineraryDay) (ItineraryDayModel, error) {
	if d.ID().IsEmpty() {
		return ItineraryDayModel{}, fmt.Errorf("itinerary day id is empty")
	}

	spots := d.Spots()
	spotModels := make([]SpotModel, 0, len(spots))
	for _, spot := range spots {
		sm, err := spotToModel(d.ID(), spot)
		if err != nil {
			return ItineraryDayModel{}, fmt.Errorf("convert spot %s: %w", spot.ID().String(), err)
		}
		spotModels = append(spotModels, sm)
	}

	// legs は Legs() の順（連鎖順）に Seq = 0,1,2,... を振って展開する。
	// Seq は復元時に区間順序を保証するための明示的なカラムであるため、
	// DB の並び順に依存させず、必ずこの連鎖順で採番する。
	legs := d.Legs()
	legModels := make([]LegModel, 0, len(legs))
	for seq, leg := range legs {
		lm, err := legToModel(d.ID(), seq, leg)
		if err != nil {
			return ItineraryDayModel{}, fmt.Errorf("convert leg %s: %w", leg.ID().String(), err)
		}
		legModels = append(legModels, lm)
	}

	return ItineraryDayModel{
		ID:        d.ID().String(),
		JourneyID: journeyID.String(),
		Date:      d.Date(),
		Spots:     spotModels,
		Legs:      legModels,
	}, nil
}

// legToModel は entity.Leg を LegModel に変換する。
// seq は日内の区間順序（0始まり）。itineraryDayToModel が Legs() の順で振る。
func legToModel(itineraryDayID value_object.ID, seq int, l entity.Leg) (LegModel, error) {
	if l.ID().IsEmpty() {
		return LegModel{}, fmt.Errorf("leg id is empty")
	}
	if itineraryDayID.IsEmpty() {
		return LegModel{}, fmt.Errorf("itinerary day id is empty")
	}

	// from はスポット参照なら from_spot_id に、旅程外地点なら from_label に展開する。
	var fromSpotID *string
	fromLabel := ""
	from := l.From()
	if from.IsSpot() {
		id := from.SpotID().String()
		fromSpotID = &id
	} else {
		fromLabel = from.Label()
	}

	cost := l.Cost()
	return LegModel{
		ID:              l.ID().String(),
		ItineraryDayID:  itineraryDayID.String(),
		Seq:             seq,
		FromSpotID:      fromSpotID,
		FromLabel:       fromLabel,
		ToSpotID:        l.To().SpotID().String(),
		TransportMode:   l.Mode().String(),
		DurationMinutes: int(l.Duration() / time.Minute),
		Amount:          cost.Amount(),
		Currency:        cost.Currency().Code(),
	}, nil
}

func spotToModel(itineraryDayID value_object.ID, s entity.Spot) (SpotModel, error) {
	if s.ID().IsEmpty() {
		return SpotModel{}, fmt.Errorf("spot id is empty")
	}

	cost := s.EstimatedCost()
	return SpotModel{
		ID:             s.ID().String(),
		ItineraryDayID: itineraryDayID.String(),
		Name:           s.Name(),
		Description:    s.Description(),
		StartAt:        s.StartAt(),
		Amount:         cost.Amount(),
		Currency:       cost.Currency().Code(),
	}, nil
}

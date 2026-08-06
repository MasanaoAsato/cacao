package postgres

import (
	"strings"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// validSpotModel はテスト用の有効な SpotModel を生成する。
// id / startAt を引数で差し替えられるようにしている。
func validSpotModel(id string, startAt time.Time) SpotModel {
	return SpotModel{
		ID:             id,
		ItineraryDayID: value_object.NewID().String(),
		Name:           "東京タワー",
		Description:    "展望台に登る",
		StartAt:        startAt,
		Amount:         1000,
		Currency:       "JPY",
	}
}

// validLegModels はテスト用の有効な LegModel を生成する。
// 1つのスポットに対応する「名前付き地点 → スポット」の1本を seq: 0 で返す。
// itineraryDayID / toSpotID を引数で差し替えられるようにしている。
func validLegModels(itineraryDayID, toSpotID string) []LegModel {
	fromLabel := "出発地"
	return []LegModel{
		{
			ID:              value_object.NewID().String(),
			ItineraryDayID:  itineraryDayID,
			Seq:             0,
			FromSpotID:      nil,
			FromLabel:       fromLabel,
			ToSpotID:        toSpotID,
			TransportMode:   "walk",
			DurationMinutes: 1,
			Amount:          0,
			Currency:        "JPY",
		},
	}
}

// validJourneyModel はテスト用の有効な JourneyModel を生成する。
// 2日分の日程と各日1件のスポットを持つ。
// 各日のスポットに対応する LegModel（seq: 0）を1本ずつ持つ。
func validJourneyModel() JourneyModel {
	day1ID := value_object.NewID().String()
	day2ID := value_object.NewID().String()
	spot1ID := value_object.NewID().String()
	spot2ID := value_object.NewID().String()

	day1 := ItineraryDayModel{
		ID:        day1ID,
		JourneyID: "",
		Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		Spots: []SpotModel{
			{
				ID:             spot1ID,
				ItineraryDayID: day1ID,
				Name:           "浅草寺",
				Description:    "雷門をくぐる",
				StartAt:        time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC),
				Amount:         0,
				Currency:       "JPY",
			},
		},
		Legs: validLegModels(day1ID, spot1ID),
	}
	day2 := ItineraryDayModel{
		ID:        day2ID,
		JourneyID: "",
		Date:      time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC),
		Spots: []SpotModel{
			{
				ID:             spot2ID,
				ItineraryDayID: day2ID,
				Name:           "東京スカイツリー",
				Description:    "展望台に登る",
				StartAt:        time.Date(2026, 8, 2, 13, 0, 0, 0, time.UTC),
				Amount:         2100,
				Currency:       "JPY",
			},
		},
		Legs: validLegModels(day2ID, spot2ID),
	}

	journeyID := value_object.NewID().String()
	day1.JourneyID = journeyID
	day2.JourneyID = journeyID

	return JourneyModel{
		ID:               journeyID,
		JourneyRequestID: value_object.NewID().String(),
		Days:             []ItineraryDayModel{day1, day2},
	}
}

func TestModelToJourney(t *testing.T) {
	t.Run("正常系: 有効な JourneyModel を復元できる", func(t *testing.T) {
		m := validJourneyModel()

		journey, err := modelToJourney(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if journey.ID().String() != m.ID {
			t.Fatalf("ID() = %q, want %q", journey.ID().String(), m.ID)
		}
		if journey.RequestID().String() != m.JourneyRequestID {
			t.Fatalf("RequestID() = %q, want %q", journey.RequestID().String(), m.JourneyRequestID)
		}
		if journey.DayCount() != 2 {
			t.Fatalf("DayCount() = %d, want %d", journey.DayCount(), 2)
		}

		days := journey.Days()
		if !days[0].Date().Equal(m.Days[0].Date) {
			t.Fatalf("days[0].Date() = %v, want %v", days[0].Date(), m.Days[0].Date)
		}
		spots := days[0].Spots()
		if len(spots) != 1 {
			t.Fatalf("len(days[0].Spots()) = %d, want %d", len(spots), 1)
		}
		if spots[0].Name() != "浅草寺" {
			t.Fatalf("spots[0].Name() = %q, want %q", spots[0].Name(), "浅草寺")
		}
		if spots[0].EstimatedCost().Amount() != 0 {
			t.Fatalf("spots[0].EstimatedCost().Amount() = %d, want %d", spots[0].EstimatedCost().Amount(), 0)
		}
		if spots[0].EstimatedCost().Currency().Code() != "JPY" {
			t.Fatalf("spots[0].EstimatedCost().Currency().Code() = %q, want %q", spots[0].EstimatedCost().Currency().Code(), "JPY")
		}
	})

	t.Run("正常系: entity -> model -> entity のラウンドトリップで一致する", func(t *testing.T) {
		m := validJourneyModel()
		want, err := modelToJourney(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		remodel, err := journeyToModel(want)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		got, err := modelToJourney(remodel)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !got.ID().Equals(want.ID()) {
			t.Fatalf("ID mismatch: got %q, want %q", got.ID().String(), want.ID().String())
		}
		if !got.RequestID().Equals(want.RequestID()) {
			t.Fatalf("RequestID mismatch: got %q, want %q", got.RequestID().String(), want.RequestID().String())
		}
		if got.DayCount() != want.DayCount() {
			t.Fatalf("DayCount() = %d, want %d", got.DayCount(), want.DayCount())
		}
		for i, day := range got.Days() {
			wantDay := want.Days()[i]
			if !day.ID().Equals(wantDay.ID()) {
				t.Fatalf("days[%d].ID mismatch: got %q, want %q", i, day.ID().String(), wantDay.ID().String())
			}
			if !day.Date().Equal(wantDay.Date()) {
				t.Fatalf("days[%d].Date() = %v, want %v", i, day.Date(), wantDay.Date())
			}
		}
	})

	t.Run("異常系: ID が不正な UUID", func(t *testing.T) {
		m := validJourneyModel()
		m.ID = "not-a-uuid"

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for invalid id, got nil")
		}
		if !strings.Contains(err.Error(), "journey id") {
			t.Fatalf("expected journey id related error, got %v", err)
		}
	})

	t.Run("異常系: JourneyRequestID が不正な UUID", func(t *testing.T) {
		m := validJourneyModel()
		m.JourneyRequestID = "not-a-uuid"

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for invalid request id, got nil")
		}
		if !strings.Contains(err.Error(), "journey request id") {
			t.Fatalf("expected request id related error, got %v", err)
		}
	})

	t.Run("異常系: 日程が0件", func(t *testing.T) {
		m := validJourneyModel()
		m.Days = nil

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for empty days, got nil")
		}
	})

	t.Run("異常系: 日程の ID が不正な UUID", func(t *testing.T) {
		m := validJourneyModel()
		m.Days[0].ID = "not-a-uuid"

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for invalid day id, got nil")
		}
		if !strings.Contains(err.Error(), "itinerary day id") {
			t.Fatalf("expected day id related error, got %v", err)
		}
	})

	t.Run("異常系: スポットの ID が不正な UUID", func(t *testing.T) {
		m := validJourneyModel()
		m.Days[0].Spots[0].ID = "not-a-uuid"

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for invalid spot id, got nil")
		}
		if !strings.Contains(err.Error(), "spot id") {
			t.Fatalf("expected spot id related error, got %v", err)
		}
	})

	t.Run("異常系: スポットの通貨コードが不正", func(t *testing.T) {
		m := validJourneyModel()
		m.Days[0].Spots[0].Currency = "JP"

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for invalid currency, got nil")
		}
		if !strings.Contains(err.Error(), "currency") {
			t.Fatalf("expected currency related error, got %v", err)
		}
	})

	t.Run("異常系: スポットの金額が負", func(t *testing.T) {
		m := validJourneyModel()
		m.Days[0].Spots[0].Amount = -1

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for negative amount, got nil")
		}
		if !strings.Contains(err.Error(), "estimated cost") {
			t.Fatalf("expected cost related error, got %v", err)
		}
	})

	t.Run("異常系: スポット名が空", func(t *testing.T) {
		m := validJourneyModel()
		m.Days[0].Spots[0].Name = ""

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for empty spot name, got nil")
		}
	})

	t.Run("異常系: 日程の日付が重複", func(t *testing.T) {
		m := validJourneyModel()
		m.Days[1].Date = m.Days[0].Date

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for duplicate date, got nil")
		}
		if !strings.Contains(err.Error(), "duplicate date") {
			t.Fatalf("expected duplicate date error, got %v", err)
		}
	})

	t.Run("境界値: 日程1日・スポット0件はエラーになる", func(t *testing.T) {
		dayID := value_object.NewID().String()
		journeyID := value_object.NewID().String()
		m := JourneyModel{
			ID:               journeyID,
			JourneyRequestID: value_object.NewID().String(),
			Days: []ItineraryDayModel{
				{
					ID:        dayID,
					JourneyID: journeyID,
					Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
					Spots:     nil,
				},
			},
		}

		_, err := modelToJourney(m)
		if err == nil {
			t.Fatal("expected error for empty spots, got nil")
		}
		if !strings.Contains(err.Error(), "at least one spot") {
			t.Fatalf("expected spots-required error, got %v", err)
		}
	})

	t.Run("境界値: 日程が日付順でなくても昇順に整列される", func(t *testing.T) {
		m := validJourneyModel()
		// モデル側で日付の逆順に入れ替える
		m.Days[0], m.Days[1] = m.Days[1], m.Days[0]

		journey, err := modelToJourney(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		days := journey.Days()
		if days[0].Date().After(days[1].Date()) {
			t.Fatalf("days are not sorted: days[0] = %v, days[1] = %v", days[0].Date(), days[1].Date())
		}
	})

	t.Run("境界値: スポットが startAt 昇順に整列される", func(t *testing.T) {
		dayID := value_object.NewID().String()
		journeyID := value_object.NewID().String()
		later := validSpotModel(value_object.NewID().String(), time.Date(2026, 8, 1, 15, 0, 0, 0, time.UTC))
		later.ItineraryDayID = dayID
		earlier := validSpotModel(value_object.NewID().String(), time.Date(2026, 8, 1, 9, 0, 0, 0, time.UTC))
		earlier.ItineraryDayID = dayID

		// seq:1 の Leg は from を earlier スポット参照で作るため、アドレスを取る。
		fromSpotID := earlier.ID
		m := JourneyModel{
			ID:               journeyID,
			JourneyRequestID: value_object.NewID().String(),
			Days: []ItineraryDayModel{
				{
					ID:        dayID,
					JourneyID: journeyID,
					Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
					// モデル側では startAt の逆順に並べておく。
					// 復元時に spots は startAt 昇順、legs は seq 昇順に整列され、
					// 連鎖不変条件を満たす（出発地 → earlier → later）。
					Spots: []SpotModel{later, earlier},
					Legs: []LegModel{
						{
							ID:              value_object.NewID().String(),
							ItineraryDayID:  dayID,
							Seq:             0,
							FromSpotID:      nil,
							FromLabel:       "出発地",
							ToSpotID:        earlier.ID,
							TransportMode:   "walk",
							DurationMinutes: 1,
							Amount:          0,
							Currency:        "JPY",
						},
						{
							ID:              value_object.NewID().String(),
							ItineraryDayID:  dayID,
							Seq:             1,
							FromSpotID:      &fromSpotID,
							FromLabel:       "",
							ToSpotID:        later.ID,
							TransportMode:   "walk",
							DurationMinutes: 1,
							Amount:          0,
							Currency:        "JPY",
						},
					},
				},
			},
		}

		journey, err := modelToJourney(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		spots := journey.Days()[0].Spots()
		if len(spots) != 2 {
			t.Fatalf("len(spots) = %d, want %d", len(spots), 2)
		}
		if spots[0].ID().String() != earlier.ID {
			t.Fatalf("spots[0] should be the earlier one, got %q", spots[0].ID().String())
		}
		if spots[0].StartAt().After(spots[1].StartAt()) {
			t.Fatalf("spots are not sorted: spots[0] = %v, spots[1] = %v", spots[0].StartAt(), spots[1].StartAt())
		}
	})
}

// mustNewSpot はテスト用の entity.Spot を生成する。
// startAt を引数で差し替えられるようにしている。
func mustNewSpot(t *testing.T, id value_object.ID, startAt time.Time) entity.Spot {
	t.Helper()

	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	cost, err := value_object.NewMoney(1000, currency)
	if err != nil {
		t.Fatalf("failed to create money: %v", err)
	}

	spot, err := entity.NewSpot(id, "東京タワー", "展望台に登る", startAt, cost)
	if err != nil {
		t.Fatalf("failed to create spot: %v", err)
	}
	return spot
}

// mustNewLeg はテスト用の entity.Leg を生成する。
// from / to を引数で差し替えられるようにしている。
func mustNewLeg(t *testing.T, id value_object.ID, from, to value_object.Endpoint) entity.Leg {
	t.Helper()

	mode, err := value_object.NewTransportMode("train")
	if err != nil {
		t.Fatalf("failed to create transport mode: %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	cost, err := value_object.NewMoney(240, currency)
	if err != nil {
		t.Fatalf("failed to create money: %v", err)
	}

	leg, err := entity.NewLeg(id, from, to, mode, 25*time.Minute, cost)
	if err != nil {
		t.Fatalf("failed to create leg: %v", err)
	}
	return leg
}

func TestLegToModel(t *testing.T) {
	t.Run("正常系: 名前付き起点の Leg をモデルに変換できる", func(t *testing.T) {
		dayID := value_object.NewID()
		spot := mustNewSpot(t, value_object.NewID(), time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC))
		from, err := value_object.NewNamedEndpoint("出発地")
		if err != nil {
			t.Fatalf("failed to create named endpoint: %v", err)
		}
		to, err := value_object.NewSpotEndpoint(spot.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		leg := mustNewLeg(t, value_object.NewID(), from, to)

		m, err := legToModel(dayID, 0, leg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if m.ID != leg.ID().String() {
			t.Errorf("ID = %q, want %q", m.ID, leg.ID().String())
		}
		if m.ItineraryDayID != dayID.String() {
			t.Errorf("ItineraryDayID = %q, want %q", m.ItineraryDayID, dayID.String())
		}
		if m.Seq != 0 {
			t.Errorf("Seq = %d, want %d", m.Seq, 0)
		}
		if m.FromSpotID != nil {
			t.Errorf("FromSpotID = %v, want nil", *m.FromSpotID)
		}
		if m.FromLabel != "出発地" {
			t.Errorf("FromLabel = %q, want %q", m.FromLabel, "出発地")
		}
		if m.ToSpotID != spot.ID().String() {
			t.Errorf("ToSpotID = %q, want %q", m.ToSpotID, spot.ID().String())
		}
		if m.TransportMode != "train" {
			t.Errorf("TransportMode = %q, want %q", m.TransportMode, "train")
		}
		if m.DurationMinutes != 25 {
			t.Errorf("DurationMinutes = %d, want %d", m.DurationMinutes, 25)
		}
		if m.Amount != 240 {
			t.Errorf("Amount = %d, want %d", m.Amount, 240)
		}
		if m.Currency != "JPY" {
			t.Errorf("Currency = %q, want %q", m.Currency, "JPY")
		}
	})

	t.Run("正常系: スポット起点の Leg をモデルに変換できる", func(t *testing.T) {
		dayID := value_object.NewID()
		prevSpot := mustNewSpot(t, value_object.NewID(), time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC))
		spot := mustNewSpot(t, value_object.NewID(), time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC))
		from, err := value_object.NewSpotEndpoint(prevSpot.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		to, err := value_object.NewSpotEndpoint(spot.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		leg := mustNewLeg(t, value_object.NewID(), from, to)

		m, err := legToModel(dayID, 1, leg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if m.Seq != 1 {
			t.Errorf("Seq = %d, want %d", m.Seq, 1)
		}
		if m.FromSpotID == nil || *m.FromSpotID != prevSpot.ID().String() {
			t.Errorf("FromSpotID = %v, want %q", m.FromSpotID, prevSpot.ID().String())
		}
		if m.FromLabel != "" {
			t.Errorf("FromLabel = %q, want empty", m.FromLabel)
		}
		if m.ToSpotID != spot.ID().String() {
			t.Errorf("ToSpotID = %q, want %q", m.ToSpotID, spot.ID().String())
		}
	})

	t.Run("異常系: Leg の ID が空", func(t *testing.T) {
		dayID := value_object.NewID()
		// 空 ID の Leg を作るため、エンティティコンストラクタは通らずに構造体ゼロ値を直接渡す。
		// legToModel は先に l.ID().IsEmpty() を検証するため、from/to がゼロ値でもその前にエラーになる。
		leg := entity.Leg{}

		_, err := legToModel(dayID, 0, leg)
		if err == nil {
			t.Fatal("expected error for empty leg id, got nil")
		}
		if !strings.Contains(err.Error(), "leg id is empty") {
			t.Fatalf("expected leg id error, got %v", err)
		}
	})
}

func TestModelToLeg(t *testing.T) {
	t.Run("正常系: 名前付き起点のモデルを Leg に復元できる", func(t *testing.T) {
		spotID := value_object.NewID().String()
		m := LegModel{
			ID:              value_object.NewID().String(),
			ItineraryDayID:  value_object.NewID().String(),
			Seq:             0,
			FromSpotID:      nil,
			FromLabel:       "出発地",
			ToSpotID:        spotID,
			TransportMode:   "train",
			DurationMinutes: 25,
			Amount:          240,
			Currency:        "JPY",
		}

		leg, err := modelToLeg(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if leg.ID().String() != m.ID {
			t.Errorf("ID() = %q, want %q", leg.ID().String(), m.ID)
		}
		if leg.From().IsSpot() {
			t.Errorf("From().IsSpot() = true, want false")
		}
		if leg.From().Label() != "出発地" {
			t.Errorf("From().Label() = %q, want %q", leg.From().Label(), "出発地")
		}
		if !leg.To().IsSpot() || leg.To().SpotID().String() != spotID {
			t.Errorf("To() = %v, want spot endpoint %q", leg.To(), spotID)
		}
		if leg.Mode().String() != "train" {
			t.Errorf("Mode() = %q, want %q", leg.Mode().String(), "train")
		}
		if leg.Duration() != 25*time.Minute {
			t.Errorf("Duration() = %v, want %v", leg.Duration(), 25*time.Minute)
		}
		if leg.Cost().Amount() != 240 || leg.Cost().Currency().Code() != "JPY" {
			t.Errorf("Cost() = %v, want 240 JPY", leg.Cost())
		}
	})

	t.Run("正常系: スポット起点のモデルを Leg に復元できる", func(t *testing.T) {
		prevSpotID := value_object.NewID().String()
		m := LegModel{
			ID:              value_object.NewID().String(),
			ItineraryDayID:  value_object.NewID().String(),
			Seq:             1,
			FromSpotID:      &prevSpotID,
			FromLabel:       "",
			ToSpotID:        value_object.NewID().String(),
			TransportMode:   "walk",
			DurationMinutes: 1,
			Amount:          0,
			Currency:        "JPY",
		}

		leg, err := modelToLeg(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !leg.From().IsSpot() || leg.From().SpotID().String() != prevSpotID {
			t.Errorf("From() = %v, want spot endpoint %q", leg.From(), prevSpotID)
		}
		if leg.From().Label() != "" {
			t.Errorf("From().Label() = %q, want empty", leg.From().Label())
		}
	})

	t.Run("異常系: from が両方空（スポット参照も名前なしも無い）", func(t *testing.T) {
		m := LegModel{
			ID:              value_object.NewID().String(),
			ItineraryDayID:  value_object.NewID().String(),
			Seq:             0,
			FromSpotID:      nil,
			FromLabel:       "",
			ToSpotID:        value_object.NewID().String(),
			TransportMode:   "walk",
			DurationMinutes: 1,
			Amount:          0,
			Currency:        "JPY",
		}

		_, err := modelToLeg(m)
		if err == nil {
			t.Fatal("expected error for empty from, got nil")
		}
		if !strings.Contains(err.Error(), "from endpoint") {
			t.Fatalf("expected from endpoint error, got %v", err)
		}
	})

	t.Run("異常系: to のスポット ID が不正な UUID", func(t *testing.T) {
		fromLabel := "出発地"
		m := LegModel{
			ID:              value_object.NewID().String(),
			ItineraryDayID:  value_object.NewID().String(),
			Seq:             0,
			FromSpotID:      nil,
			FromLabel:       fromLabel,
			ToSpotID:        "not-a-uuid",
			TransportMode:   "walk",
			DurationMinutes: 1,
			Amount:          0,
			Currency:        "JPY",
		}

		_, err := modelToLeg(m)
		if err == nil {
			t.Fatal("expected error for invalid to spot id, got nil")
		}
		if !strings.Contains(err.Error(), "to spot id") {
			t.Fatalf("expected to spot id error, got %v", err)
		}
	})

	t.Run("異常系: 移動手段が不正", func(t *testing.T) {
		fromLabel := "出発地"
		m := LegModel{
			ID:              value_object.NewID().String(),
			ItineraryDayID:  value_object.NewID().String(),
			Seq:             0,
			FromSpotID:      nil,
			FromLabel:       fromLabel,
			ToSpotID:        value_object.NewID().String(),
			TransportMode:   "teleport",
			DurationMinutes: 1,
			Amount:          0,
			Currency:        "JPY",
		}

		_, err := modelToLeg(m)
		if err == nil {
			t.Fatal("expected error for invalid transport mode, got nil")
		}
		if !strings.Contains(err.Error(), "transport mode") {
			t.Fatalf("expected transport mode error, got %v", err)
		}
	})
}

func TestModelToItineraryDay_Legs(t *testing.T) {
	t.Run("正常系: legs が seq 昇順に復元される", func(t *testing.T) {
		dayID := value_object.NewID().String()
		journeyID := value_object.NewID().String()
		spot1ID := value_object.NewID()
		spot2ID := value_object.NewID()
		spot1 := mustNewSpot(t, spot1ID, time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC))
		spot2 := mustNewSpot(t, spot2ID, time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC))
		spot1IDStr := spot1ID.String()
		spot2IDStr := spot2ID.String()

		// モデル側は seq を逆順（1, 0）で持たせても、復元時に seq 昇順に並ぶことを検証する。
		dayModel := ItineraryDayModel{
			ID:        dayID,
			JourneyID: journeyID,
			Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
			Spots: []SpotModel{
				{
					ID:             spot1IDStr,
					ItineraryDayID: dayID,
					Name:           "spot1",
					Description:    "",
					StartAt:        spot1.StartAt(),
					Amount:         1000,
					Currency:       "JPY",
				},
				{
					ID:             spot2IDStr,
					ItineraryDayID: dayID,
					Name:           "spot2",
					Description:    "",
					StartAt:        spot2.StartAt(),
					Amount:         1000,
					Currency:       "JPY",
				},
			},
			Legs: []LegModel{
				{
					ID:              value_object.NewID().String(),
					ItineraryDayID:  dayID,
					Seq:             1,
					FromSpotID:      &spot1IDStr,
					FromLabel:       "",
					ToSpotID:        spot2IDStr,
					TransportMode:   "walk",
					DurationMinutes: 1,
					Amount:          0,
					Currency:        "JPY",
				},
				{
					ID:              value_object.NewID().String(),
					ItineraryDayID:  dayID,
					Seq:             0,
					FromSpotID:      nil,
					FromLabel:       "出発地",
					ToSpotID:        spot1IDStr,
					TransportMode:   "walk",
					DurationMinutes: 1,
					Amount:          0,
					Currency:        "JPY",
				},
			},
		}

		day, err := modelToItineraryDay(dayModel)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		legs := day.Legs()
		if len(legs) != 2 {
			t.Fatalf("len(legs) = %d, want %d", len(legs), 2)
		}
		// seq:0 の区間が先頭に来ていること（出発地 → spot1）
		if legs[0].From().IsSpot() || !legs[0].To().SpotID().Equals(spot1ID) {
			t.Errorf("legs[0] should be 出発地→spot1, got from=%v to=%v", legs[0].From(), legs[0].To())
		}
		// seq:1 の区間が2番目に来ていること（spot1 → spot2）
		if !legs[1].From().IsSpot() || !legs[1].From().SpotID().Equals(spot1ID) || !legs[1].To().SpotID().Equals(spot2ID) {
			t.Errorf("legs[1] should be spot1→spot2, got from=%v to=%v", legs[1].From(), legs[1].To())
		}
	})

	t.Run("異常系: legs が連鎖を壊している（DB 破損を検出）", func(t *testing.T) {
		dayID := value_object.NewID().String()
		journeyID := value_object.NewID().String()
		spot1ID := value_object.NewID()
		spot2ID := value_object.NewID()
		spot1 := mustNewSpot(t, spot1ID, time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC))
		spot2 := mustNewSpot(t, spot2ID, time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC))
		spot1IDStr := spot1ID.String()
		otherID := value_object.NewID().String()

		// legs[0] の to が spot1 ではなく無関係なスポットを指している（連鎖断絶）。
		dayModel := ItineraryDayModel{
			ID:        dayID,
			JourneyID: journeyID,
			Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
			Spots: []SpotModel{
				{
					ID:             spot1IDStr,
					ItineraryDayID: dayID,
					Name:           "spot1",
					Description:    "",
					StartAt:        spot1.StartAt(),
					Amount:         1000,
					Currency:       "JPY",
				},
				{
					ID:             spot2.ID().String(),
					ItineraryDayID: dayID,
					Name:           "spot2",
					Description:    "",
					StartAt:        spot2.StartAt(),
					Amount:         1000,
					Currency:       "JPY",
				},
			},
			Legs: []LegModel{
				{
					ID:              value_object.NewID().String(),
					ItineraryDayID:  dayID,
					Seq:             0,
					FromSpotID:      nil,
					FromLabel:       "出発地",
					ToSpotID:        otherID, // どのスポットも指していない
					TransportMode:   "walk",
					DurationMinutes: 1,
					Amount:          0,
					Currency:        "JPY",
				},
				{
					ID:              value_object.NewID().String(),
					ItineraryDayID:  dayID,
					Seq:             1,
					FromSpotID:      &spot1IDStr,
					FromLabel:       "",
					ToSpotID:        spot2.ID().String(),
					TransportMode:   "walk",
					DurationMinutes: 1,
					Amount:          0,
					Currency:        "JPY",
				},
			},
		}

		_, err := modelToItineraryDay(dayModel)
		if err == nil {
			t.Fatal("expected error for broken leg chain, got nil")
		}
		if !strings.Contains(err.Error(), "must point to spot") {
			t.Fatalf("expected chain validation error, got %v", err)
		}
	})
}

func TestLegRoundTrip(t *testing.T) {
	t.Run("正常系: entity -> model -> entity で一致する", func(t *testing.T) {
		spot := mustNewSpot(t, value_object.NewID(), time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC))
		from, err := value_object.NewNamedEndpoint("大阪（出発地）")
		if err != nil {
			t.Fatalf("failed to create named endpoint: %v", err)
		}
		to, err := value_object.NewSpotEndpoint(spot.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		want := mustNewLeg(t, value_object.NewID(), from, to)

		m, err := legToModel(value_object.NewID(), 0, want)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		got, err := modelToLeg(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !got.ID().Equals(want.ID()) {
			t.Errorf("ID mismatch: got %q, want %q", got.ID().String(), want.ID().String())
		}
		if !got.From().Equals(want.From()) {
			t.Errorf("From mismatch: got %v, want %v", got.From(), want.From())
		}
		if !got.To().Equals(want.To()) {
			t.Errorf("To mismatch: got %v, want %v", got.To(), want.To())
		}
		if got.Mode() != want.Mode() {
			t.Errorf("Mode mismatch: got %q, want %q", got.Mode(), want.Mode())
		}
		if got.Duration() != want.Duration() {
			t.Errorf("Duration mismatch: got %v, want %v", got.Duration(), want.Duration())
		}
		if !got.Cost().Equals(want.Cost()) {
			t.Errorf("Cost mismatch: got %v, want %v", got.Cost(), want.Cost())
		}
	})
}

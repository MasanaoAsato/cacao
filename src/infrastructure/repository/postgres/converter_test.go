package postgres

import (
	"strings"
	"testing"
	"time"

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

// validJourneyModel はテスト用の有効な JourneyModel を生成する。
// 2日分の日程と各日1件のスポットを持つ。
func validJourneyModel() JourneyModel {
	day1ID := value_object.NewID().String()
	day2ID := value_object.NewID().String()

	day1 := ItineraryDayModel{
		ID:        day1ID,
		JourneyID: "",
		Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		Spots: []SpotModel{
			{
				ID:             value_object.NewID().String(),
				ItineraryDayID: day1ID,
				Name:           "浅草寺",
				Description:    "雷門をくぐる",
				StartAt:        time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC),
				Amount:         0,
				Currency:       "JPY",
			},
		},
	}
	day2 := ItineraryDayModel{
		ID:        day2ID,
		JourneyID: "",
		Date:      time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC),
		Spots: []SpotModel{
			{
				ID:             value_object.NewID().String(),
				ItineraryDayID: day2ID,
				Name:           "東京スカイツリー",
				Description:    "展望台に登る",
				StartAt:        time.Date(2026, 8, 2, 13, 0, 0, 0, time.UTC),
				Amount:         2100,
				Currency:       "JPY",
			},
		},
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

	t.Run("境界値: 日程1日・スポット0件でも復元できる", func(t *testing.T) {
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

		journey, err := modelToJourney(m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if journey.DayCount() != 1 {
			t.Fatalf("DayCount() = %d, want %d", journey.DayCount(), 1)
		}
		if len(journey.Days()[0].Spots()) != 0 {
			t.Fatalf("len(days[0].Spots()) = %d, want %d", len(journey.Days()[0].Spots()), 0)
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

		m := JourneyModel{
			ID:               journeyID,
			JourneyRequestID: value_object.NewID().String(),
			Days: []ItineraryDayModel{
				{
					ID:        dayID,
					JourneyID: journeyID,
					Date:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
					// モデル側では startAt の逆順に並べておく
					Spots: []SpotModel{later, earlier},
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

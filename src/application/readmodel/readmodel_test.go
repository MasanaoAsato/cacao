package readmodel

import (
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/internal/testkit"
)

func TestNewJourneyDTO(t *testing.T) {
	t.Run("正常系: 日・スポット・区間が DTO に写される", func(t *testing.T) {
		journey := testkit.MustNewJourney(t)

		dto := NewJourneyDTO(journey)

		if dto.ID != journey.ID().String() {
			t.Fatalf("ID = %q, want %q", dto.ID, journey.ID().String())
		}
		if dto.RequestID != journey.RequestID().String() {
			t.Fatalf("RequestID mismatch")
		}
		if dto.DayCount != 1 || len(dto.Days) != 1 {
			t.Fatalf("DayCount = %d, len(Days) = %d, want 1/1", dto.DayCount, len(dto.Days))
		}
		day := dto.Days[0]
		if len(day.Spots) != 1 || len(day.Legs) != 1 {
			t.Fatalf("spots = %d, legs = %d, want 1/1", len(day.Spots), len(day.Legs))
		}
		if day.Spots[0].Name != "東京タワー" {
			t.Fatalf("spot name = %q", day.Spots[0].Name)
		}
		if day.Spots[0].EstimatedCost != (MoneyDTO{Amount: 1000, Currency: "JPY"}) {
			t.Fatalf("estimated cost = %+v", day.Spots[0].EstimatedCost)
		}
		leg := day.Legs[0]
		if leg.From.SpotID != "" || leg.From.Label != "出発地" {
			t.Fatalf("from = %+v, want named endpoint 出発地", leg.From)
		}
		if leg.To.SpotID != day.Spots[0].ID || leg.To.Label != "東京タワー" {
			t.Fatalf("to = %+v, want spot endpoint resolved to 東京タワー", leg.To)
		}
		if leg.Mode != "walk" || leg.DurationMinutes != 1 {
			t.Fatalf("mode = %q, duration = %d", leg.Mode, leg.DurationMinutes)
		}
	})

	t.Run("境界値系: 複数スポットの区間ラベルが前のスポット名に解決される", func(t *testing.T) {
		date := testkit.DefaultPeriodStart
		first := testkit.MustNewSpot(t, "A", date.Add(9*time.Hour), testkit.MustNewMoney(t, 0, "JPY"))
		second := testkit.MustNewSpot(t, "B", date.Add(12*time.Hour), testkit.MustNewMoney(t, 0, "JPY"))
		day := testkit.MustNewItineraryDay(t, date, []entity.Spot{first, second})

		dto := NewItineraryDayDTO(day)

		if len(dto.Legs) != 2 {
			t.Fatalf("legs = %d, want 2", len(dto.Legs))
		}
		if dto.Legs[1].From.Label != "A" || dto.Legs[1].To.Label != "B" {
			t.Fatalf("leg 2 = %+v -> %+v, want A -> B", dto.Legs[1].From, dto.Legs[1].To)
		}
	})

	t.Run("境界値系: 空スライスは空の DTO スライスになる", func(t *testing.T) {
		if got := NewJourneyDTOs(nil); got == nil || len(got) != 0 {
			t.Fatalf("NewJourneyDTOs(nil) = %#v, want empty non-nil slice", got)
		}
	})
}

func TestNewJourneyRequestDTO(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)

	dto := NewJourneyRequestDTO(request)

	if dto.ID != request.ID().String() {
		t.Fatalf("ID mismatch")
	}
	if dto.Departure != "東京, 日本" || dto.Destination != "大阪, 日本" {
		t.Fatalf("departure = %q, destination = %q", dto.Departure, dto.Destination)
	}
	if !dto.Period.StartDate.Equal(testkit.DefaultPeriodStart) || !dto.Period.EndDate.Equal(testkit.DefaultPeriodEnd) {
		t.Fatalf("period = %+v", dto.Period)
	}
	if dto.Budget != (MoneyDTO{Amount: 50000, Currency: "JPY"}) {
		t.Fatalf("budget = %+v", dto.Budget)
	}
	if got := NewJourneyRequestDTOs([]entity.JourneyRequest{request}); len(got) != 1 || got[0] != dto {
		t.Fatalf("NewJourneyRequestDTOs mismatch")
	}
}

func TestNewJourneyImageDTO(t *testing.T) {
	t.Run("正常系: ready 画像は asset 情報を持つ", func(t *testing.T) {
		image := testkit.MustNewReadyImage(t)

		dto := NewJourneyImageDTO(image)

		if dto.Status != "ready" || !dto.HasContent || dto.HasFailureCode {
			t.Fatalf("dto = %+v", dto)
		}
		if !dto.HasVisualStyle || dto.VisualStyle != "editorial-photograph" {
			t.Fatalf("visual style = %q, %v", dto.VisualStyle, dto.HasVisualStyle)
		}
		if dto.MediaType != "image/jpeg" || dto.Width != 1600 || dto.Height != 900 {
			t.Fatalf("asset = %q %dx%d", dto.MediaType, dto.Width, dto.Height)
		}
		if dto.Slot != (SlotDTO{Purpose: "cover", Ordinal: 1}) || dto.AttemptCount != 1 {
			t.Fatalf("slot = %+v, attempts = %d", dto.Slot, dto.AttemptCount)
		}
	})

	t.Run("異常系: failed 画像は failure code を持ち asset を持たない", func(t *testing.T) {
		dto := NewJourneyImageDTO(testkit.MustNewFailedImage(t))

		if dto.Status != "failed" || dto.HasContent || !dto.HasFailureCode {
			t.Fatalf("dto = %+v", dto)
		}
		if dto.FailureCode != "provider_timeout" {
			t.Fatalf("failure code = %q", dto.FailureCode)
		}
	})

	t.Run("境界値系: pending 画像はどちらも持たない", func(t *testing.T) {
		dto := NewJourneyImageDTO(testkit.MustNewPendingImage(t))

		if dto.Status != "pending" || dto.HasContent || dto.HasVisualStyle || dto.HasFailureCode || dto.AttemptCount != 0 {
			t.Fatalf("dto = %+v", dto)
		}
		if got := NewJourneyImageDTOs(nil); got == nil || len(got) != 0 {
			t.Fatalf("NewJourneyImageDTOs(nil) = %#v", got)
		}
	})
}

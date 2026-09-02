// Package testkit はテストで使うエンティティのビルダーとリポジトリのフェイクをまとめる。
// 各テストパッケージが同じヘルパーを個別に持たないようにするための共有コードであり、
// 本番コードからは参照しない。
package testkit

import (
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// DefaultPeriodStart / DefaultPeriodEnd はビルダー既定の旅行期間（2026-07-07〜07-09）。
var (
	DefaultPeriodStart = time.Date(2026, time.July, 7, 0, 0, 0, 0, time.UTC)
	DefaultPeriodEnd   = time.Date(2026, time.July, 9, 0, 0, 0, 0, time.UTC)
)

// MustNewMoney は通貨コードと金額から Money を作る。
func MustNewMoney(t testing.TB, amount int, code string) value_object.Money {
	t.Helper()
	currency, err := value_object.NewCurrency(code)
	if err != nil {
		t.Fatalf("NewCurrency(%q) error = %v", code, err)
	}
	money, err := value_object.NewMoney(amount, currency)
	if err != nil {
		t.Fatalf("NewMoney(%d, %q) error = %v", amount, code, err)
	}
	return money
}

// MustNewPeriod は開始日と終了日から Period を作る。
func MustNewPeriod(t testing.TB, start, end time.Time) value_object.Period {
	t.Helper()
	period, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	return period
}

// MustNewJourneyRequest は東京→大阪、2026-07-07〜07-09、予算 50,000 JPY のリクエストを作る。
func MustNewJourneyRequest(t testing.TB) entity.JourneyRequest {
	t.Helper()
	return MustNewJourneyRequestWithPeriod(t, DefaultPeriodStart, DefaultPeriodEnd)
}

// MustNewJourneyRequestWithPeriod は期間を指定して JourneyRequest を作る。
func MustNewJourneyRequestWithPeriod(t testing.TB, start, end time.Time) entity.JourneyRequest {
	t.Helper()
	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("NewDeparture() error = %v", err)
	}
	destination, err := value_object.NewDestination("大阪", "日本")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	request, err := entity.NewJourneyRequest(
		value_object.NewID(),
		departure,
		destination,
		MustNewPeriod(t, start, end),
		MustNewMoney(t, 50000, "JPY"),
	)
	if err != nil {
		t.Fatalf("NewJourneyRequest() error = %v", err)
	}
	return request
}

// MustNewSpot は指定日時に始まる Spot を作る。
func MustNewSpot(t testing.TB, name string, startAt time.Time, cost value_object.Money) entity.Spot {
	t.Helper()
	spot, err := entity.NewSpot(value_object.NewID(), name, name+"の説明", startAt, cost)
	if err != nil {
		t.Fatalf("NewSpot(%q) error = %v", name, err)
	}
	return spot
}

// MustNewLegsForSpots は spots と同数の Leg を「出発地→spots[0]→spots[1]→…」の連鎖で作る。
// すべて徒歩・1分・0 JPY。
func MustNewLegsForSpots(t testing.TB, spots []entity.Spot) []entity.Leg {
	t.Helper()
	if len(spots) == 0 {
		return nil
	}
	mode, err := value_object.NewTransportMode("walk")
	if err != nil {
		t.Fatalf("NewTransportMode() error = %v", err)
	}
	zeroCost := MustNewMoney(t, 0, "JPY")
	legs := make([]entity.Leg, len(spots))
	for i, spot := range spots {
		var from value_object.Endpoint
		if i == 0 {
			from, err = value_object.NewNamedEndpoint("出発地")
		} else {
			from, err = value_object.NewSpotEndpoint(spots[i-1].ID())
		}
		if err != nil {
			t.Fatalf("leg %d: from endpoint error = %v", i+1, err)
		}
		to, err := value_object.NewSpotEndpoint(spot.ID())
		if err != nil {
			t.Fatalf("leg %d: to endpoint error = %v", i+1, err)
		}
		leg, err := entity.NewLeg(value_object.NewID(), from, to, mode, time.Minute, zeroCost)
		if err != nil {
			t.Fatalf("NewLeg(%d) error = %v", i+1, err)
		}
		legs[i] = leg
	}
	return legs
}

// MustNewItineraryDay は spots に対応する Leg を自動生成して ItineraryDay を作る。
func MustNewItineraryDay(t testing.TB, date time.Time, spots []entity.Spot) entity.ItineraryDay {
	t.Helper()
	day, err := entity.NewItineraryDay(value_object.NewID(), date, spots, MustNewLegsForSpots(t, spots))
	if err != nil {
		t.Fatalf("NewItineraryDay() error = %v", err)
	}
	return day
}

// MustNewJourney は 2026-07-07 に東京タワー1件を訪れる1日旅程を作る。
func MustNewJourney(t testing.TB) entity.Journey {
	t.Helper()
	return MustNewJourneyForRequest(t, value_object.NewID())
}

// MustNewJourneyForRequest は requestID に紐づく1日旅程を作る。
func MustNewJourneyForRequest(t testing.TB, requestID value_object.ID) entity.Journey {
	t.Helper()
	date := DefaultPeriodStart
	spot := MustNewSpot(t, "東京タワー", date.Add(10*time.Hour), MustNewMoney(t, 1000, "JPY"))
	day := MustNewItineraryDay(t, date, []entity.Spot{spot})
	journey, err := entity.NewJourney(
		value_object.NewID(),
		requestID,
		MustNewPeriod(t, date, date),
		[]entity.ItineraryDay{day},
	)
	if err != nil {
		t.Fatalf("NewJourney() error = %v", err)
	}
	return journey
}

// MustNewImageSlot は用途と序数から ImageSlot を作る。
func MustNewImageSlot(t testing.TB, purpose value_object.ImagePurpose, ordinal int) value_object.ImageSlot {
	t.Helper()
	slot, err := value_object.NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	return slot
}

// MustNewAssetReference は 1600x900 の JPEG を指す ImageAssetReference を作る。
func MustNewAssetReference(t testing.TB) value_object.ImageAssetReference {
	t.Helper()
	ref, err := value_object.NewImageAssetReference("images/test.jpg", "image/jpeg", 1600, 900)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	return ref
}

// MustNewPendingImage は cover/1 スロットの pending 画像を作る。requestID は新規発行。
func MustNewPendingImage(t testing.TB) entity.JourneyImage {
	t.Helper()
	return MustNewPendingImageFor(t, value_object.NewID(), MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
}

// MustNewPendingImageFor は requestID とスロットを指定して pending 画像を作る。
func MustNewPendingImageFor(t testing.TB, requestID value_object.ID, slot value_object.ImageSlot) entity.JourneyImage {
	t.Helper()
	image, err := entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
	return image
}

// MustNewProcessingImage は1回 Start した processing 画像を作る。
func MustNewProcessingImage(t testing.TB) entity.JourneyImage {
	t.Helper()
	image := MustNewPendingImage(t)
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	return image
}

// MustNewReadyImage は1回の試行で ready になった画像を作る。
func MustNewReadyImage(t testing.TB) entity.JourneyImage {
	t.Helper()
	image := MustNewProcessingImage(t)
	if err := image.Complete(MustNewAssetReference(t)); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}
	return image
}

// MustNewFailedImage は1回の試行で provider_timeout により failed になった画像を作る。
func MustNewFailedImage(t testing.TB) entity.JourneyImage {
	t.Helper()
	image := MustNewProcessingImage(t)
	if err := image.Fail(mustFailureCode(t)); err != nil {
		t.Fatalf("Fail() error = %v", err)
	}
	return image
}

// MustNewFailedImageAtLimit は試行上限まで失敗し、もう Retry できない failed 画像を作る。
func MustNewFailedImageAtLimit(t testing.TB) entity.JourneyImage {
	t.Helper()
	image := MustNewPendingImage(t)
	failureCode := mustFailureCode(t)
	for attempt := 1; attempt <= entity.MaxImageGenerationAttempts; attempt++ {
		if err := image.Start(); err != nil {
			t.Fatalf("Start() error = %v", err)
		}
		if err := image.Fail(failureCode); err != nil {
			t.Fatalf("Fail() error = %v", err)
		}
		if attempt == entity.MaxImageGenerationAttempts {
			break
		}
		if err := image.Retry(); err != nil {
			t.Fatalf("Retry() error = %v", err)
		}
	}
	return image
}

func mustFailureCode(t testing.TB) value_object.ImageFailureCode {
	t.Helper()
	code, err := value_object.NewImageFailureCode("provider_timeout")
	if err != nil {
		t.Fatalf("NewImageFailureCode() error = %v", err)
	}
	return code
}

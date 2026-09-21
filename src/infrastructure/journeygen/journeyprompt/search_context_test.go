package journeyprompt

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/websearch"
	"strings"
	"testing"
	"time"
)

func TestSearchQueriesAndContext(t *testing.T) {
	request := newSearchContextTestRequest(t)
	queries := SearchQueries(request)
	wantQueries := []string{
		"大阪 日本 観光地 穴場 営業情報",
		"大阪 日本 2026-08-01 2026-08-03 イベント",
		"東京 日本 から 大阪 日本 交通",
	}
	if len(queries) != len(wantQueries) {
		t.Fatalf("query count = %d, want %d", len(queries), len(wantQueries))
	}
	for index, want := range wantQueries {
		if queries[index] != want {
			t.Errorf("queries[%d] = %q, want %q", index, queries[index], want)
		}
	}

	prompt := AppendSearchContext("journey prompt", []websearch.Result{{
		Title:   "資料タイトル",
		URL:     "https://example.com/reference",
		Snippet: "資料本文",
	}})
	for _, fragment := range []string{"journey prompt", "[資料 1]", "資料タイトル", "https://example.com/reference", "資料本文", "[/資料 1]"} {
		if !strings.Contains(prompt, fragment) {
			t.Errorf("prompt does not contain %q", fragment)
		}
	}
	if !strings.Contains(SystemInstructionWithSearchSafety(), "未信頼データ") {
		t.Error("system instruction does not state that search material is untrusted")
	}
}

func newSearchContextTestRequest(t *testing.T) entity.JourneyRequest {
	t.Helper()
	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("NewDeparture() error = %v", err)
	}
	destination, err := value_object.NewDestination("大阪", "日本")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	period, err := value_object.NewPeriod(
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("NewCurrency() error = %v", err)
	}
	budget, err := value_object.NewMoney(10000, currency)
	if err != nil {
		t.Fatalf("NewMoney() error = %v", err)
	}
	request, err := entity.NewJourneyRequest(value_object.NewID(), departure, destination, period, budget)
	if err != nil {
		t.Fatalf("NewJourneyRequest() error = %v", err)
	}
	return request
}

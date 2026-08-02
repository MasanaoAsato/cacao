package prompt

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// mustBuildRequest はテスト用の JourneyRequest を生成するヘルパー。
// 値オブジェクト側でバリデーション済みの値のみ渡すため、ここでは失敗しない前提とする。
func mustBuildRequest(t *testing.T, start, end time.Time, amount int, currency string) entity.JourneyRequest {
	t.Helper()

	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("failed to create departure: %v", err)
	}
	period, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}
	cur, err := value_object.NewCurrency(currency)
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	budget, err := value_object.NewMoney(amount, cur)
	if err != nil {
		t.Fatalf("failed to create money: %v", err)
	}

	request, err := entity.NewJourneyRequest(value_object.NewID(), departure, period, budget)
	if err != nil {
		t.Fatalf("failed to create journey request: %v", err)
	}
	return request
}

func TestBuildJourneyPrompt(t *testing.T) {
	t.Run("正常系: 条件・作成ルール・出力形式がすべて含まれる", func(t *testing.T) {
		start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)
		request := mustBuildRequest(t, start, end, 30000, "JPY")

		prompt, err := BuildJourneyPrompt(request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// 条件セクションの確認
		for _, want := range []string{
			"出発地: 東京, 日本",
			"2026-08-01 〜 2026-08-03（3日間）",
			"総予算: JPY 30000",
		} {
			if !strings.Contains(prompt, want) {
				t.Errorf("prompt should contain %q\n--- prompt ---\n%s", want, prompt)
			}
		}

		// 作成ルールの確認（1日あたりの予算の目安と通貨指定）
		for _, want := range []string{
			"各日に1つ以上のスポット",
			"JPY 10000", // 30000 / 3日
			"JPY 建ての整数",
			"実在するもののみを使用",
		} {
			if !strings.Contains(prompt, want) {
				t.Errorf("prompt should contain %q\n--- prompt ---\n%s", want, prompt)
			}
		}

		// 出力形式（GeneratedRoute に対応する JSON）の確認
		for _, want := range []string{
			`"days"`, `"date"`, `"spots"`,
			`"name"`, `"description"`, `"startAt"`,
			`"estimatedCost"`, `"amount"`, `"currency": "JPY"`,
		} {
			if !strings.Contains(prompt, want) {
				t.Errorf("prompt should contain %q\n--- prompt ---\n%s", want, prompt)
			}
		}
	})

	t.Run("境界値: 日帰り（1日間）なら1日の予算目安は総予算と同額", func(t *testing.T) {
		day := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
		request := mustBuildRequest(t, day, day, 5000, "JPY")

		prompt, err := BuildJourneyPrompt(request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !strings.Contains(prompt, "（1日間）") {
			t.Errorf("prompt should indicate 1 day trip\n--- prompt ---\n%s", prompt)
		}
		if !strings.Contains(prompt, "JPY 5000") {
			t.Errorf("daily budget guideline should equal total budget\n--- prompt ---\n%s", prompt)
		}
	})

	t.Run("境界値: 総予算が日数で割り切れない場合は切り捨てた額を目安にする", func(t *testing.T) {
		start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)
		request := mustBuildRequest(t, start, end, 10000, "JPY")

		prompt, err := BuildJourneyPrompt(request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// 10000 / 3 = 3333（整数除算で切り捨て）
		if !strings.Contains(prompt, "JPY 3333") {
			t.Errorf("daily budget guideline should be floored\n--- prompt ---\n%s", prompt)
		}
	})

	// 異常系: BuildJourneyPrompt は error を返し得るシグネチャだが、
	// 値オブジェクト・エンティティの生成時に妥当性が保証されているため、
	// 有効な JourneyRequest からは常にプロンプトを構築でき、現状エラー経路は存在しない。
}

func TestParseGeneratedRoute(t *testing.T) {
	utc := time.UTC
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, utc)
	end := time.Date(2026, 8, 3, 0, 0, 0, 0, utc)

	t.Run("正常系: 正しい JSON を GeneratedRoute へ変換できる", func(t *testing.T) {
		request := mustBuildRequest(t, start, end, 30000, "JPY")
		content := `{
			"days": [
				{
					"date": "2026-08-01",
					"spots": [
						{"name": "浅草寺", "description": "東京最古の寺院", "startAt": "2026-08-01T09:00:00+09:00", "estimatedCost": {"amount": 0, "currency": "JPY"}},
						{"name": "東京スカイツリー", "description": "高さ634mの電波塔", "startAt": "2026-08-01T13:00:00+09:00", "estimatedCost": {"amount": 2100, "currency": "JPY"}}
					]
				},
				{
					"date": "2026-08-02",
					"spots": [
						{"name": "明治神宮", "description": "都心の森", "startAt": "2026-08-02T10:00:00+09:00", "estimatedCost": {"amount": 500, "currency": "JPY"}}
					]
				}
			]
		}`

		route, err := ParseGeneratedRoute(content, request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(route.Days) != 2 {
			t.Fatalf("expected 2 days, got %d", len(route.Days))
		}
		if got := route.Days[0].Date.Format(time.DateOnly); got != "2026-08-01" {
			t.Errorf("expected day 1 date 2026-08-01, got %s", got)
		}

		spots := route.Days[0].Spots
		if len(spots) != 2 {
			t.Fatalf("expected 2 spots on day 1, got %d", len(spots))
		}
		if spots[0].Name != "浅草寺" {
			t.Errorf("expected spot name 浅草寺, got %s", spots[0].Name)
		}
		if got := spots[0].StartAt.Format(time.RFC3339); got != "2026-08-01T09:00:00+09:00" {
			t.Errorf("expected startAt 2026-08-01T09:00:00+09:00, got %s", got)
		}
		if spots[1].EstimatedCost.Amount() != 2100 {
			t.Errorf("expected amount 2100, got %d", spots[1].EstimatedCost.Amount())
		}
		if got := spots[1].EstimatedCost.Currency().Code(); got != "JPY" {
			t.Errorf("expected currency JPY, got %s", got)
		}
	})

	t.Run("境界値: 期間の開始日・終了日ちょうどの日付は受け入れる", func(t *testing.T) {
		request := mustBuildRequest(t, start, end, 30000, "JPY")
		content := `{
			"days": [
				{"date": "2026-08-01", "spots": [{"name": "A", "description": "d", "startAt": "2026-08-01T09:00:00+09:00", "estimatedCost": {"amount": 100, "currency": "JPY"}}]},
				{"date": "2026-08-03", "spots": [{"name": "B", "description": "d", "startAt": "2026-08-03T18:00:00+09:00", "estimatedCost": {"amount": 200, "currency": "JPY"}}]}
			]
		}`

		route, err := ParseGeneratedRoute(content, request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(route.Days) != 2 {
			t.Fatalf("expected 2 days, got %d", len(route.Days))
		}
	})

	t.Run("正常系: リクエストが JST でも終了日を期間外と誤判定しない", func(t *testing.T) {
		// time.Parse(time.DateOnly) の結果は UTC となるため、そのまま比較すると
		// JST の期間終了日（例: 2026-08-03 00:00+09:00）に対して誤って期間外と判定してしまう。
		// カレンダー日を期間のタイムゾーンで解釈し直していることをこのテストで保証する。
		jst := time.FixedZone("Asia/Tokyo", 9*60*60)
		jstStart := time.Date(2026, 8, 1, 0, 0, 0, 0, jst)
		jstEnd := time.Date(2026, 8, 3, 0, 0, 0, 0, jst)
		request := mustBuildRequest(t, jstStart, jstEnd, 30000, "JPY")
		content := `{
			"days": [
				{"date": "2026-08-03", "spots": [{"name": "横浜中華街", "description": "食べ歩き", "startAt": "2026-08-03T12:00:00+09:00", "estimatedCost": {"amount": 3000, "currency": "JPY"}}]}
			]
		}`

		route, err := ParseGeneratedRoute(content, request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got := route.Days[0].Date.Format(time.DateOnly); got != "2026-08-03" {
			t.Errorf("expected date 2026-08-03, got %s", got)
		}
	})

	t.Run("異常系", func(t *testing.T) {
		request := mustBuildRequest(t, start, end, 30000, "JPY")
		spot := `"spots": [{"name": "浅草寺", "description": "d", "startAt": "2026-08-01T09:00:00+09:00", "estimatedCost": {"amount": 100, "currency": "JPY"}}]`

		tests := []struct {
			name    string
			content string
			wantErr string
		}{
			{"JSON が壊れている", `{"days": [`, "failed to decode"},
			{"日付フォーマットが不正", `{"days": [{"date": "2026/08/01", ` + spot + `}]}`, "invalid date"},
			{"期間外の日付", `{"days": [{"date": "2026-08-04", ` + spot + `}]}`, "out of travel period"},
			{"開始時刻フォーマットが不正", `{"days": [{"date": "2026-08-01", "spots": [{"name": "A", "description": "d", "startAt": "9時", "estimatedCost": {"amount": 100, "currency": "JPY"}}]}]}`, "invalid startAt"},
			{"通貨が予算と不一致", `{"days": [{"date": "2026-08-01", "spots": [{"name": "A", "description": "d", "startAt": "2026-08-01T09:00:00+09:00", "estimatedCost": {"amount": 100, "currency": "USD"}}]}]}`, "does not match budget currency"},
			{"金額が負", `{"days": [{"date": "2026-08-01", "spots": [{"name": "A", "description": "d", "startAt": "2026-08-01T09:00:00+09:00", "estimatedCost": {"amount": -100, "currency": "JPY"}}]}]}`, "non-negative"},
			{"スポット名が空", `{"days": [{"date": "2026-08-01", "spots": [{"name": "", "description": "d", "startAt": "2026-08-01T09:00:00+09:00", "estimatedCost": {"amount": 100, "currency": "JPY"}}]}]}`, "name must not be empty"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				_, err := ParseGeneratedRoute(tt.content, request)
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.wantErr)
				}
				if !strings.Contains(err.Error(), tt.wantErr) {
					t.Errorf("expected error containing %q, got %q", tt.wantErr, err.Error())
				}
			})
		}
	})

	t.Run("境界値: days が空ならエラー", func(t *testing.T) {
		request := mustBuildRequest(t, start, end, 30000, "JPY")
		_, err := ParseGeneratedRoute(`{"days": []}`, request)
		if err == nil || !strings.Contains(err.Error(), "no days") {
			t.Errorf("expected no days error, got %v", err)
		}
	})

	t.Run("境界値: スポットが0件の日はエラー", func(t *testing.T) {
		request := mustBuildRequest(t, start, end, 30000, "JPY")
		content := `{"days": [{"date": "2026-08-01", "spots": []}]}`
		_, err := ParseGeneratedRoute(content, request)
		if err == nil || !strings.Contains(err.Error(), "no spots") {
			t.Errorf("expected no spots error, got %v", err)
		}
	})
}

func TestRouteJSONSchema(t *testing.T) {
	t.Run("正常系: strict モードの制約を満たし、routeJSON と対応する構造を返す", func(t *testing.T) {
		schemaJSON, err := json.Marshal(RouteJSONSchema())
		if err != nil {
			t.Fatalf("RouteJSONSchema should be marshalable: %v", err)
		}

		// strict モードの制約: 全オブジェクトで全フィールドが required かつ additionalProperties: false。
		// フィールド名は routeJSON（LLM 応答の受け皿 DTO）の JSON タグと一致させる。
		want := `{
			"type": "object",
			"properties": {
				"days": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"date": {"type": "string", "description": "YYYY-MM-DD 形式の日付"},
							"spots": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"name": {"type": "string", "description": "スポット名"},
										"description": {"type": "string", "description": "スポットの説明（1〜2文）"},
										"startAt": {"type": "string", "description": "RFC 3339 形式の訪問開始時刻"},
										"estimatedCost": {
											"type": "object",
											"properties": {
												"amount": {"type": "integer"},
												"currency": {"type": "string"}
											},
											"required": ["amount", "currency"],
											"additionalProperties": false
										}
									},
									"required": ["name", "description", "startAt", "estimatedCost"],
									"additionalProperties": false
								}
							}
						},
						"required": ["date", "spots"],
						"additionalProperties": false
					}
				}
			},
			"required": ["days"],
			"additionalProperties": false
		}`

		// JSON 文字列同士の比較ではキー順に依存してしまうため、
		// いったん map にデコードしてから reflect.DeepEqual で構造比較する。
		var gotMap, wantMap map[string]any
		if err := json.Unmarshal(schemaJSON, &gotMap); err != nil {
			t.Fatalf("failed to unmarshal schema: %v", err)
		}
		if err := json.Unmarshal([]byte(want), &wantMap); err != nil {
			t.Fatalf("failed to unmarshal expected schema: %v", err)
		}
		if !reflect.DeepEqual(gotMap, wantMap) {
			t.Errorf("schema mismatch\n got: %s\nwant: %s", schemaJSON, want)
		}
	})

	// 異常系・境界値系: RouteJSONSchema は引数を取らず常に同じスキーマを返す純粋関数のため、
	// エラー経路・境界値は存在しない。
}

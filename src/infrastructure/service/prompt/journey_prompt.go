package prompt

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"encoding/json"
	"fmt"
	"time"
)

// SystemInstruction は LLM に送るシステムプロンプトを返す。
func SystemInstruction() string {
	return systemInstruction
}

// BuildJourneyPrompt は JourneyRequest の条件から LLM へ送るプロンプトを組み立てる。
// LLM には出力形式の項で示した JSON（service.GeneratedRoute に対応）のみを
// 返すよう指示しており、呼び出し側はその JSON をパースして旅程を復元する。
func BuildJourneyPrompt(request entity.JourneyRequest) (string, error) {
	departure := request.Departure().String()
	period := request.Period()
	days := period.Days()
	budget := request.Budget()
	currency := budget.Currency().Code()

	// 1日あたりの予算の目安。総予算を日数で割った額で、
	// LLM が各日のスポット費用を配分する際の基準として提示する。
	dailyBudget := budget.Amount() / days

	prompt := fmt.Sprintf(`以下の条件で旅行の旅程を作成してください。

# 条件
- 出発地: %s
- 旅行期間: %s 〜 %s（%d日間）
- 総予算: %s（旅行全体の上限額）

# 作成ルール
1. 各日に1つ以上のスポット（訪問先・アクティビティ）を設定すること
2. 1日あたりの予算の目安は %s %d とし、各日のスポット費用の合計がこれを超えないこと
3. 全日程のスポット費用の合計が総予算を超えないこと
4. スポットの費用はすべて %s 建ての整数で記載すること
5. 各スポットには訪問開始時刻を設定し、1日の中で時系列が前後しないこと
6. 出発地から無理なく移動できる範囲のスポットを選ぶこと
7. 有名な観光地だけでなく穴場も織り交ぜ、同じ条件でも毎回異なるユニークな旅程にすること
8. すべてのスポット名・施設名は実在するもののみを使用すること。自信がない場合は Web Search で確認すること

# 出力形式
以下の JSON のみを出力すること。説明文・Markdown・コードフェンスは一切付けないこと。

{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "spots": [
        {
          "name": "スポット名",
          "description": "スポットの説明（1〜2文）",
          "startAt": "RFC 3339 形式の現地時刻（例: 2026-08-01T09:00:00+09:00）",
          "estimatedCost": { "amount": 金額の整数, "currency": "%s" }
        }
      ]
    }
  ]
}
`,
		departure,
		period.StartDate().Format(time.DateOnly),
		period.EndDate().Format(time.DateOnly),
		days,
		budget.String(),
		currency, dailyBudget,
		currency,
		currency,
	)

	return prompt, nil
}

// routeJSON は LLM 応答 JSON の受け皿となる中間構造体（DTO）。
// service.GeneratedRoute は Money などの値オブジェクトを含み直接 Unmarshal できないため、
// いったんプリミティブな形で受けてからコンストラクタ経由で値オブジェクトに変換する。
// LLM の出力形式と一緒に変化する技術的関心事なので、このパッケージに閉じ込める（非公開）。
type routeJSON struct {
	Days []dayJSON `json:"days"`
}

type dayJSON struct {
	Date  string     `json:"date"`
	Spots []spotJSON `json:"spots"`
}

type spotJSON struct {
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	StartAt       string    `json:"startAt"`
	EstimatedCost moneyJSON `json:"estimatedCost"`
}

type moneyJSON struct {
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
}

// ParseGeneratedRoute は LLM 応答の JSON 文字列を GeneratedRoute へデコードする。
// LLM の出力は鵜呑みにせず、request を基準に以下を検証する。
//   - 日付が YYYY-MM-DD 形式で、旅行期間（request.Period()）内であること
//   - 各日に1つ以上のスポットがあり、スポット名が空でないこと
//   - 開始時刻が RFC 3339 形式であること
//   - 通貨が予算の通貨（request.Budget().Currency()）と一致すること
//   - 金額が0以上であること（value_object.NewMoney が保証）
func ParseGeneratedRoute(content string, request entity.JourneyRequest) (service.GeneratedRoute, error) {
	var raw routeJSON
	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("failed to decode LLM response as JSON: %w", err)
	}
	if len(raw.Days) == 0 {
		return service.GeneratedRoute{}, fmt.Errorf("LLM response contains no days")
	}

	period := request.Period()
	wantCurrency := request.Budget().Currency()

	days := make([]service.GeneratedDay, 0, len(raw.Days))
	for i, d := range raw.Days {
		date, err := parseDateInPeriod(d.Date, period)
		if err != nil {
			return service.GeneratedRoute{}, fmt.Errorf("day %d: %w", i+1, err)
		}
		if len(d.Spots) == 0 {
			return service.GeneratedRoute{}, fmt.Errorf("day %d (%s): no spots", i+1, d.Date)
		}

		spots := make([]service.GeneratedSpot, 0, len(d.Spots))
		for j, s := range d.Spots {
			spot, err := parseSpot(s, wantCurrency)
			if err != nil {
				return service.GeneratedRoute{}, fmt.Errorf("day %d spot %d: %w", i+1, j+1, err)
			}
			spots = append(spots, spot)
		}
		days = append(days, service.GeneratedDay{Date: date, Spots: spots})
	}

	return service.GeneratedRoute{Days: days}, nil
}

// parseDateInPeriod は "YYYY-MM-DD" 形式の日付文字列をパースし、旅行期間内であることを検証する。
// パース結果は UTC となるため、期間のタイムゾーンに合わせてカレンダー日を解釈し直してから比較する
// （例: 期間が JST なのに UTC 午夜で比較すると、終了日が期間外と誤判定されるのを防ぐ）。
func parseDateInPeriod(dateStr string, period value_object.Period) (time.Time, error) {
	parsed, err := time.Parse(time.DateOnly, dateStr)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date %q (expect YYYY-MM-DD): %w", dateStr, err)
	}

	loc := period.StartDate().Location()
	date := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, loc)
	if date.Before(period.StartDate()) || date.After(period.EndDate()) {
		return time.Time{}, fmt.Errorf(
			"date %s is out of travel period (%s 〜 %s)",
			dateStr,
			period.StartDate().Format(time.DateOnly),
			period.EndDate().Format(time.DateOnly),
		)
	}
	return date, nil
}

// parseSpot は DTO のスポットを検証しながら service.GeneratedSpot へ変換する。
func parseSpot(s spotJSON, wantCurrency value_object.Currency) (service.GeneratedSpot, error) {
	if s.Name == "" {
		return service.GeneratedSpot{}, fmt.Errorf("spot name must not be empty")
	}

	startAt, err := time.Parse(time.RFC3339, s.StartAt)
	if err != nil {
		return service.GeneratedSpot{}, fmt.Errorf("invalid startAt %q (expect RFC 3339): %w", s.StartAt, err)
	}

	currency, err := value_object.NewCurrency(s.EstimatedCost.Currency)
	if err != nil {
		return service.GeneratedSpot{}, err
	}
	if !currency.Equals(wantCurrency) {
		return service.GeneratedSpot{}, fmt.Errorf(
			"currency %q does not match budget currency %q",
			currency.Code(), wantCurrency.Code(),
		)
	}

	cost, err := value_object.NewMoney(s.EstimatedCost.Amount, currency)
	if err != nil {
		return service.GeneratedSpot{}, err
	}

	return service.GeneratedSpot{
		Name:          s.Name,
		Description:   s.Description,
		StartAt:       startAt,
		EstimatedCost: cost,
	}, nil
}

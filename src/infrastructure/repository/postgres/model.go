package postgres

import "time"

// JourneyRequestModel は journey.journey_requests テーブルの1行に対応する GORM モデル。
// entity.JourneyRequest とは別物であり、converter.go で相互変換する。
//
// DepartureCity/Country・StartDate/EndDate・BudgetAmount/Currency はそれぞれ
// value_object.Departure, Period, Money をカラム展開したもの。
// 値オブジェクトを正規化することで BETWEEN・GROUP BY 等の検索が直接書ける。
type JourneyRequestModel struct {
	ID               string    `gorm:"primaryKey;type:uuid"`
	DepartureCity    string    `gorm:"column:departure_city"`
	DepartureCountry string    `gorm:"column:departure_country"`
	StartDate        time.Time `gorm:"column:start_date;type:date"`
	EndDate          time.Time `gorm:"column:end_date;type:date"`
	BudgetAmount     int       `gorm:"column:budget_amount"`
	BudgetCurrency   string    `gorm:"column:budget_currency;type:varchar(3)"`
	CreatedAt        time.Time `gorm:"column:created_at;type:timestamptz"`
	UpdatedAt        time.Time `gorm:"column:updated_at;type:timestamptz"`
}

func (JourneyRequestModel) TableName() string { return "journey.journey_requests" }

// JourneyModel は journey.journeys テーブルの1行に対応する GORM モデル。
// entity.Journey とは別物であり、converter.go で相互変換する。
// 集約ルート。Days (ItineraryDayModel) を介して集約全体を Preload で取得する。
type JourneyModel struct {
	ID               string              `gorm:"primaryKey;type:uuid"`
	JourneyRequestID string              `gorm:"column:journey_request_id;type:uuid;index"`
	Days             []ItineraryDayModel `gorm:"foreignKey:JourneyID;constraint:OnDelete:CASCADE"`
	CreatedAt        time.Time           `gorm:"column:created_at;type:timestamptz"`
	UpdatedAt        time.Time           `gorm:"column:updated_at;type:timestamptz"`
}

func (JourneyModel) TableName() string { return "journey.journeys" }

// ItineraryDayModel は journey.itinerary_days テーブルの1行に対応する GORM モデル。
// entity.ItineraryDay とは別物であり、converter.go で相互変換する。
// Date は日付のみ（時刻は不要）なので DB 型は DATE。Spots (SpotModel) を子に持つ。
type ItineraryDayModel struct {
	ID        string      `gorm:"primaryKey;type:uuid"`
	JourneyID string      `gorm:"column:journey_id;type:uuid"`
	Date      time.Time   `gorm:"column:date;type:date"`
	Spots     []SpotModel `gorm:"foreignKey:ItineraryDayID;constraint:OnDelete:CASCADE"`
	CreatedAt time.Time   `gorm:"column:created_at;type:timestamptz"`
	UpdatedAt time.Time   `gorm:"column:updated_at;type:timestamptz"`
}

func (ItineraryDayModel) TableName() string { return "journey.itinerary_days" }

// SpotModel は journey.spots テーブルの1行に対応する GORM モデル。
// entity.Spot とは別物であり、converter.go で相互変換する。
//
// Amount と Currency は entity.Spot.EstimatedCost() (value_object.Money) を
// 2カラムに正規化したもの。値オブジェクトのまま保存すると検索性が落ちるため。
type SpotModel struct {
	ID             string    `gorm:"primaryKey;type:uuid"`
	ItineraryDayID string    `gorm:"column:itinerary_day_id;type:uuid;index"`
	Name           string    `gorm:"column:name"`
	Description    string    `gorm:"column:description"`
	StartAt        time.Time `gorm:"column:start_at;type:timestamptz"`
	Amount         int       `gorm:"column:amount"`
	Currency       string    `gorm:"column:currency;type:varchar(3)"`
	CreatedAt      time.Time `gorm:"column:created_at;type:timestamptz"`
	UpdatedAt      time.Time `gorm:"column:updated_at;type:timestamptz"`
}

func (SpotModel) TableName() string { return "journey.spots" }

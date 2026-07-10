package event

import (
	"time"

	"cacao/src/domain/value_object"
)

// JourneyRequested はユーザーが旅程生成を依頼したことを表すドメインイベント。
// イベントは過去の事実としてイミュータブルに扱われる。
type JourneyRequested struct {
	requestID  value_object.ID
	occurredAt time.Time
}

// NewJourneyRequested は JourneyRequested イベントを生成する。
func NewJourneyRequested(requestID value_object.ID) JourneyRequested {
	return JourneyRequested{
		requestID:  requestID,
		occurredAt: time.Now(),
	}
}

// RequestID はリクエストの識別子を返す。
func (e JourneyRequested) RequestID() value_object.ID {
	return e.requestID
}

// OccurredAt はイベント発生日時を返す。
func (e JourneyRequested) OccurredAt() time.Time {
	return e.occurredAt
}

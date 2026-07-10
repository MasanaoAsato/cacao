package event

import (
	"time"

	"cacao/src/domain/value_object"
)

// JourneyGenerated は LLM による旅程生成が完了したことを表すドメインイベント。
// イベントは過去の事実としてイミュータブルに扱われる。
type JourneyGenerated struct {
	journeyID  value_object.ID
	requestID  value_object.ID
	occurredAt time.Time
}

// NewJourneyGenerated は JourneyGenerated イベントを生成する。
func NewJourneyGenerated(journeyID, requestID value_object.ID) JourneyGenerated {
	return JourneyGenerated{
		journeyID:  journeyID,
		requestID:  requestID,
		occurredAt: time.Now(),
	}
}

// JourneyID は生成された旅程の識別子を返す。
func (e JourneyGenerated) JourneyID() value_object.ID {
	return e.journeyID
}

// RequestID は元となったリクエストの識別子を返す。
func (e JourneyGenerated) RequestID() value_object.ID {
	return e.requestID
}

// OccurredAt はイベント発生日時を返す。
func (e JourneyGenerated) OccurredAt() time.Time {
	return e.occurredAt
}

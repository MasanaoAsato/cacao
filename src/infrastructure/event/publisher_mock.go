package event

import (
	"context"
	"sync"

	"cacao/src/domain/event"
)

// PublisherMock は event.Publisher のモック実装。
// 受け取ったイベントを内部スライスに蓄積し、テストで検証できるようにする。
type PublisherMock struct {
	mu     sync.Mutex
	events []event.DomainEvent
	// ErrOn は非 nil のとき Publish はこのエラーを返す（エラー注入用）。
	ErrOn error
}

// NewPublisherMock は空の PublisherMock を生成する。
func NewPublisherMock() *PublisherMock {
	return &PublisherMock{}
}

// Publish はドメインイベントを発行する。ErrOn が設定されている場合はそのエラーを返す。
func (p *PublisherMock) Publish(_ context.Context, e event.DomainEvent) error {
	if p.ErrOn != nil {
		return p.ErrOn
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.events = append(p.events, e)
	return nil
}

// Events は蓄積したイベントのコピーを返す。
func (p *PublisherMock) Events() []event.DomainEvent {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]event.DomainEvent, len(p.events))
	copy(out, p.events)
	return out
}

// Reset は蓄積したイベントをクリアする。
func (p *PublisherMock) Reset() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.events = nil
}

package event

import (
	"context"
	"time"
)

// Publisher はドメインイベントの発行を抽象化するインターフェース。
// 実装はインフラ層に置き、ドメイン層は配信メカニズムの詳細を知らない。
type Publisher interface {
	// Publish はドメインイベントを発行する。
	Publish(ctx context.Context, event DomainEvent) error
}

// DomainEvent はすべてのドメインイベントが満たすインターフェース。
// 型スイッチやテストでの区別に利用する。
type DomainEvent interface {
	OccurredAt() time.Time
}

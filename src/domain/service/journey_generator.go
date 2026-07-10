package service

import (
	"cacao/src/domain/entity"
	"context"
)

// JourneyGenerator は JourneyRequest から Journey を生成するドメインサービス。
// 旅程生成は単一のエンティティ/値オブジェクトに属さないドメインロジックであるため、
// DDD のドメインサービスとして位置づける。
// 実装はインフラ層（infrastructure/service/）に置く。
type JourneyGenerator interface {
	// Generate は JourneyRequest の条件から旅程の中間表現を生成する。
	// ユースケースがこの結果を entity.Journey に詰め替える。
	Generate(ctx context.Context, request entity.JourneyRequest) (GeneratedRoute, error)
}

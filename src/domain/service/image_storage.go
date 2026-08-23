package service

import (
	"context"
	"io"

	"cacao/src/domain/value_object"
)

// ImageStorage は画像の保存、読出し、削除を抽象化するportである。
type ImageStorage interface {
	Save(
		ctx context.Context,
		imageID value_object.ID,
		image GeneratedImage,
	) (value_object.ImageAssetReference, error)
	Open(ctx context.Context, ref value_object.ImageAssetReference) (io.ReadCloser, error)
	Delete(ctx context.Context, ref value_object.ImageAssetReference) error
}

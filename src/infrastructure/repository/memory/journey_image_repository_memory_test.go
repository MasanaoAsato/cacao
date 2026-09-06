package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
)

func TestJourneyImageRepositoryMemory_SaveAndFind(t *testing.T) {
	ctx := context.Background()
	repo := NewJourneyImageRepository()
	requestID := value_object.NewID()
	cover := testkit.MustNewPendingImageFor(t, requestID, testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
	illustration := testkit.MustNewPendingImageFor(t, requestID, testkit.MustNewImageSlot(t, value_object.ImagePurposeIllustration, 1))

	t.Run("正常系: 保存した画像を ID・slot・request で取得できる", func(t *testing.T) {
		if err := repo.Save(ctx, illustration); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
		if err := repo.Save(ctx, cover); err != nil {
			t.Fatalf("Save() error = %v", err)
		}

		got, err := repo.FindByID(ctx, cover.ID())
		if err != nil || !got.ID().Equals(cover.ID()) {
			t.Fatalf("FindByID() = %v, %v", got.ID(), err)
		}
		bySlot, err := repo.FindBySlot(ctx, requestID, illustration.Slot())
		if err != nil || !bySlot.ID().Equals(illustration.ID()) {
			t.Fatalf("FindBySlot() = %v, %v", bySlot.ID(), err)
		}
		list, err := repo.FindByRequestID(ctx, requestID)
		if err != nil || len(list) != 2 {
			t.Fatalf("FindByRequestID() len = %d, err = %v", len(list), err)
		}
		if !list[0].ID().Equals(cover.ID()) {
			t.Fatalf("FindByRequestID() must be ordered by slot, got %s first", list[0].Slot().Purpose())
		}
	})

	t.Run("異常系: 同じ request と slot の新規保存は拒否される", func(t *testing.T) {
		duplicate := testkit.MustNewPendingImageFor(t, requestID, cover.Slot())
		err := repo.Save(ctx, duplicate)
		if !errors.Is(err, repository.ErrJourneyImageSlotAlreadyExists) {
			t.Fatalf("Save() error = %v, want ErrJourneyImageSlotAlreadyExists", err)
		}
	})

	t.Run("異常系: 存在しない ID は ErrJourneyImageNotFound", func(t *testing.T) {
		if _, err := repo.FindByID(ctx, value_object.NewID()); !errors.Is(err, repository.ErrJourneyImageNotFound) {
			t.Fatalf("FindByID() error = %v", err)
		}
		if _, err := repo.FindBySlot(ctx, value_object.NewID(), cover.Slot()); !errors.Is(err, repository.ErrJourneyImageNotFound) {
			t.Fatalf("FindBySlot() error = %v", err)
		}
		if err := repo.Delete(ctx, value_object.NewID()); !errors.Is(err, repository.ErrJourneyImageNotFound) {
			t.Fatalf("Delete() error = %v", err)
		}
	})

	t.Run("正常系: 既存 ID の再保存は更新になる", func(t *testing.T) {
		updated := cover
		if err := updated.Start(); err != nil {
			t.Fatalf("Start() error = %v", err)
		}
		if err := repo.Save(ctx, updated); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
		got, _ := repo.FindByID(ctx, cover.ID())
		if got.Status() != value_object.ImageStatusProcessing {
			t.Fatalf("status = %s, want processing", got.Status())
		}
		if err := repo.Delete(ctx, cover.ID()); err != nil {
			t.Fatalf("Delete() error = %v", err)
		}
	})
}

func TestJourneyImageRepositoryMemory_ClaimAndLease(t *testing.T) {
	ctx := context.Background()
	repo := NewJourneyImageRepository()
	now := time.Date(2026, time.August, 1, 12, 0, 0, 0, time.UTC)

	first := testkit.MustNewPendingImage(t)
	second := testkit.MustNewPendingImage(t)
	for _, image := range []entity.JourneyImage{first, second} {
		if err := repo.Save(ctx, image); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
	}

	t.Run("正常系: FindPending は作成順で limit 件返す", func(t *testing.T) {
		pending, err := repo.FindPending(ctx, 1)
		if err != nil || len(pending) != 1 || !pending[0].ID().Equals(first.ID()) {
			t.Fatalf("FindPending() = %v, %v", pending, err)
		}
	})

	t.Run("異常系: limit が 0 以下はエラー", func(t *testing.T) {
		if _, err := repo.FindPending(ctx, 0); err == nil {
			t.Fatal("FindPending(0) expected error")
		}
		if _, err := repo.FindExpiredProcessing(ctx, now, 0); err == nil {
			t.Fatal("FindExpiredProcessing(0) expected error")
		}
		if _, _, err := repo.Claim(ctx, first.ID(), time.Time{}); err == nil {
			t.Fatal("Claim(zero lease) expected error")
		}
	})

	t.Run("正常系: Claim は pending を processing にし lease を記録する", func(t *testing.T) {
		lease := now.Add(4 * time.Minute)
		claimed, ok, err := repo.Claim(ctx, first.ID(), lease)
		if err != nil || !ok {
			t.Fatalf("Claim() = %v, %v", ok, err)
		}
		if claimed.Status() != value_object.ImageStatusProcessing || claimed.AttemptCount() != 1 {
			t.Fatalf("claimed = %s/%d", claimed.Status(), claimed.AttemptCount())
		}
		if got, has := repo.LeaseUntil(first.ID()); !has || !got.Equal(lease) {
			t.Fatalf("LeaseUntil() = %v, %v", got, has)
		}
	})

	t.Run("境界値系: 二重 Claim は claimed=false で現在の画像を返す", func(t *testing.T) {
		image, ok, err := repo.Claim(ctx, first.ID(), now.Add(time.Minute))
		if err != nil || ok {
			t.Fatalf("second Claim() = %v, %v", ok, err)
		}
		if image.Status() != value_object.ImageStatusProcessing {
			t.Fatalf("status = %s", image.Status())
		}
	})

	t.Run("異常系: 存在しない ID の Claim は ErrJourneyImageNotFound", func(t *testing.T) {
		if _, _, err := repo.Claim(ctx, value_object.NewID(), now); !errors.Is(err, repository.ErrJourneyImageNotFound) {
			t.Fatalf("Claim() error = %v", err)
		}
	})

	t.Run("境界値系: FindExpiredProcessing は lease 期限を過ぎたものだけ返す", func(t *testing.T) {
		before, err := repo.FindExpiredProcessing(ctx, now.Add(4*time.Minute), 10)
		if err != nil || len(before) != 0 {
			t.Fatalf("at lease boundary: %v, %v", before, err)
		}
		after, err := repo.FindExpiredProcessing(ctx, now.Add(4*time.Minute+time.Second), 10)
		if err != nil || len(after) != 1 || !after[0].ID().Equals(first.ID()) {
			t.Fatalf("after lease: %v, %v", after, err)
		}
	})

	t.Run("正常系: processing 以外で Save すると lease が解除される", func(t *testing.T) {
		image, _ := repo.FindByID(ctx, first.ID())
		if err := image.Complete(
			testkit.MustNewAssetReference(t),
			value_object.ImageVisualStyleEditorialPhotograph,
		); err != nil {
			t.Fatalf("Complete() error = %v", err)
		}
		if err := repo.Save(ctx, image); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
		if _, has := repo.LeaseUntil(first.ID()); has {
			t.Fatal("lease must be cleared after ready")
		}
	})
}

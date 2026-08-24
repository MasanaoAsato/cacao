//go:build integration

package postgres

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"

	"gorm.io/gorm"
)

func TestJourneyImageRepositoryPostgresSaveAndFind(t *testing.T) {
	db := skipIfNoDB(t)
	cleanJourneyImages(t, db)
	t.Cleanup(func() { cleanJourneyImages(t, db) })

	ctx := context.Background()
	request := newTestJourneyRequest(t)
	requestRepo := NewJourneyRequestRepository(db)
	if err := requestRepo.Save(ctx, request); err != nil {
		t.Fatalf("save journey request: %v", err)
	}
	repo := NewJourneyImageRepository(db)

	cover := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeCover, 1)
	ready := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeIllustration, 1)
	failed := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeIllustration, 2)
	processing := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeIllustration, 3)

	completeTestJourneyImage(t, &ready)
	failTestJourneyImage(t, &failed)
	for _, image := range []entity.JourneyImage{cover, ready, failed, processing} {
		if err := repo.Save(ctx, image); err != nil {
			t.Fatalf("Save(%s) error = %v", image.ID(), err)
		}
	}
	if _, claimed, err := repo.Claim(
		ctx,
		processing.ID(),
		time.Now().Add(time.Minute),
	); err != nil || !claimed {
		t.Fatalf("Claim() = (_, %t, %v), want (_, true, nil)", claimed, err)
	}

	images, err := repo.FindByRequestID(ctx, request.ID())
	if err != nil {
		t.Fatalf("FindByRequestID() error = %v", err)
	}
	if len(images) != 4 {
		t.Fatalf("len(FindByRequestID()) = %d, want 4", len(images))
	}
	wantSlots := []value_object.ImageSlot{
		cover.Slot(),
		ready.Slot(),
		failed.Slot(),
		processing.Slot(),
	}
	for index, wantSlot := range wantSlots {
		if images[index].Slot() != wantSlot {
			t.Errorf("images[%d].Slot() = %#v, want %#v", index, images[index].Slot(), wantSlot)
		}
	}

	gotReady, err := repo.FindByID(ctx, ready.ID())
	if err != nil {
		t.Fatalf("FindByID() error = %v", err)
	}
	if gotReady.Status() != value_object.ImageStatusReady {
		t.Errorf("FindByID().Status() = %q, want ready", gotReady.Status())
	}
	if _, ok := gotReady.AssetReference(); !ok {
		t.Error("FindByID() ready image has no asset reference")
	}

	gotFailed, err := repo.FindBySlot(ctx, request.ID(), failed.Slot())
	if err != nil {
		t.Fatalf("FindBySlot() error = %v", err)
	}
	if gotFailed.Status() != value_object.ImageStatusFailed {
		t.Errorf("FindBySlot().Status() = %q, want failed", gotFailed.Status())
	}
	if _, ok := gotFailed.FailureCode(); !ok {
		t.Error("FindBySlot() failed image has no failure code")
	}

	pending, err := repo.FindPending(ctx, 10)
	if err != nil {
		t.Fatalf("FindPending() error = %v", err)
	}
	if len(pending) != 1 || !pending[0].ID().Equals(cover.ID()) {
		t.Errorf("FindPending() = %#v, want only cover image", pending)
	}
}

func TestJourneyImageRepositoryPostgresClaimAndExpiredProcessing(t *testing.T) {
	db := skipIfNoDB(t)
	cleanJourneyImages(t, db)
	t.Cleanup(func() { cleanJourneyImages(t, db) })

	ctx := context.Background()
	request := saveTestJourneyRequest(t, db, ctx)
	repo := NewJourneyImageRepository(db)
	image := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeCover, 1)
	if err := repo.Save(ctx, image); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	leaseUntil := time.Now().Add(-time.Minute)
	claimedImage, claimed, err := repo.Claim(ctx, image.ID(), leaseUntil)
	if err != nil {
		t.Fatalf("Claim() error = %v", err)
	}
	if !claimed {
		t.Fatal("Claim() claimed = false, want true")
	}
	if claimedImage.Status() != value_object.ImageStatusProcessing {
		t.Errorf("Claim().Status() = %q, want processing", claimedImage.Status())
	}
	if claimedImage.AttemptCount() != 1 {
		t.Errorf("Claim().AttemptCount() = %d, want 1", claimedImage.AttemptCount())
	}

	_, claimed, err = repo.Claim(ctx, image.ID(), time.Now().Add(time.Minute))
	if err != nil {
		t.Fatalf("second Claim() error = %v", err)
	}
	if claimed {
		t.Error("second Claim() claimed = true, want false")
	}

	expired, err := repo.FindExpiredProcessing(ctx, time.Now(), 10)
	if err != nil {
		t.Fatalf("FindExpiredProcessing() error = %v", err)
	}
	if len(expired) != 1 || !expired[0].ID().Equals(image.ID()) {
		t.Errorf("FindExpiredProcessing() = %#v, want claimed image", expired)
	}
}

func TestJourneyImageRepositoryPostgresErrorsAndBoundaries(t *testing.T) {
	db := skipIfNoDB(t)
	cleanJourneyImages(t, db)
	t.Cleanup(func() { cleanJourneyImages(t, db) })

	ctx := context.Background()
	request := saveTestJourneyRequest(t, db, ctx)
	repo := NewJourneyImageRepository(db)
	image := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeCover, 1)
	if err := repo.Save(ctx, image); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	duplicate := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeCover, 1)
	err := repo.Save(ctx, duplicate)
	if !errors.Is(err, repository.ErrJourneyImageSlotAlreadyExists) {
		t.Errorf("Save(duplicate slot) error = %v, want ErrJourneyImageSlotAlreadyExists", err)
	}

	missingRequestImage := newTestJourneyImage(
		t,
		value_object.NewID(),
		value_object.ImagePurposeIllustration,
		1,
	)
	if err := repo.Save(ctx, missingRequestImage); err == nil {
		t.Error("Save() with missing foreign key error = nil, want error")
	}

	if _, err := repo.FindByID(ctx, value_object.NewID()); !errors.Is(
		err,
		repository.ErrJourneyImageNotFound,
	) {
		t.Errorf("FindByID() error = %v, want ErrJourneyImageNotFound", err)
	}
	if _, _, err := repo.Claim(ctx, value_object.NewID(), time.Now().Add(time.Minute)); !errors.Is(
		err,
		repository.ErrJourneyImageNotFound,
	) {
		t.Errorf("Claim() error = %v, want ErrJourneyImageNotFound", err)
	}
	if _, err := repo.FindPending(ctx, 0); err == nil {
		t.Error("FindPending(0) error = nil, want error")
	}
	if _, err := repo.FindExpiredProcessing(ctx, time.Now(), 0); err == nil {
		t.Error("FindExpiredProcessing(0) error = nil, want error")
	}
	if err := repo.Delete(ctx, value_object.NewID()); err != nil {
		t.Errorf("Delete(missing) error = %v, want nil", err)
	}
}

func TestJourneyImageRepositoryPostgresClaimAllowsOneConcurrentWorker(t *testing.T) {
	db := skipIfNoDB(t)
	cleanJourneyImages(t, db)
	t.Cleanup(func() { cleanJourneyImages(t, db) })

	ctx := context.Background()
	request := saveTestJourneyRequest(t, db, ctx)
	repo := NewJourneyImageRepository(db)
	image := newTestJourneyImage(t, request.ID(), value_object.ImagePurposeCover, 1)
	if err := repo.Save(ctx, image); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	type claimResult struct {
		claimed bool
		err     error
	}
	results := make(chan claimResult, 2)
	start := make(chan struct{})
	var waitGroup sync.WaitGroup
	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			_, claimed, err := repo.Claim(
				context.Background(),
				image.ID(),
				time.Now().Add(time.Minute),
			)
			results <- claimResult{claimed: claimed, err: err}
		}()
	}
	close(start)
	waitGroup.Wait()
	close(results)

	claimedCount := 0
	for result := range results {
		if result.err != nil {
			t.Errorf("concurrent Claim() error = %v", result.err)
		}
		if result.claimed {
			claimedCount++
		}
	}
	if claimedCount != 1 {
		t.Errorf("successful Claim() count = %d, want 1", claimedCount)
	}
}

func cleanJourneyImages(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := db.Exec("TRUNCATE TABLE journey.journey_images CASCADE").Error; err != nil {
		t.Fatalf("truncate journey_images: %v", err)
	}
}

func saveTestJourneyRequest(
	t *testing.T,
	db *gorm.DB,
	ctx context.Context,
) entity.JourneyRequest {
	t.Helper()
	request := newTestJourneyRequest(t)
	if err := NewJourneyRequestRepository(db).Save(ctx, request); err != nil {
		t.Fatalf("save journey request: %v", err)
	}
	return request
}

func newTestJourneyImage(
	t *testing.T,
	requestID value_object.ID,
	purpose value_object.ImagePurpose,
	ordinal int,
) entity.JourneyImage {
	t.Helper()
	slot, err := value_object.NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
	return image
}

func completeTestJourneyImage(t *testing.T, image *entity.JourneyImage) {
	t.Helper()
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	assetReference, err := value_object.NewImageAssetReference(
		"ab/test.png",
		"image/png",
		100,
		200,
	)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	if err := image.Complete(assetReference); err != nil {
		t.Fatalf("Complete() error = %v", err)
	}
}

func failTestJourneyImage(t *testing.T, image *entity.JourneyImage) {
	t.Helper()
	if err := image.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := image.Fail(value_object.ImageFailureCodeInternalError); err != nil {
		t.Fatalf("Fail() error = %v", err)
	}
}

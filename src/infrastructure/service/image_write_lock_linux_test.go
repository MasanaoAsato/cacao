//go:build linux

package service

import (
	"context"
	"image/color"
	"os"
	"path/filepath"
	"testing"

	"cacao/src/domain/value_object"
)

func TestFileSystemImageStorageReusesAdvisoryLockAfterOwnerCloses(t *testing.T) {
	storage := newTestFileSystemImageStorage(t, ImageStorageConfig{})
	imageID := value_object.NewID()
	storageKey, err := imageStorageKey(imageID, ".png")
	if err != nil {
		t.Fatalf("imageStorageKey() error = %v", err)
	}
	storagePath, err := validateImageStorageKey(storageKey)
	if err != nil {
		t.Fatalf("validateImageStorageKey() error = %v", err)
	}
	shardDirectory := filepath.Dir(storagePath)
	if err := storage.root.MkdirAll(shardDirectory, 0o750); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	lockFile, err := storage.root.OpenFile(
		filepath.Join(shardDirectory, ".write.lock"),
		os.O_RDWR|os.O_CREATE,
		0o640,
	)
	if err != nil {
		t.Fatalf("OpenFile(lock) error = %v", err)
	}
	locked, err := tryLockImageFile(lockFile)
	if err != nil {
		t.Fatalf("tryLockImageFile() error = %v", err)
	}
	if !locked {
		t.Fatal("tryLockImageFile() locked = false, want true")
	}
	if err := lockFile.Close(); err != nil {
		t.Fatalf("Close(lock) error = %v", err)
	}

	generatedImage := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{A: 255},
	)
	if _, err := storage.Save(context.Background(), imageID, generatedImage); err != nil {
		t.Fatalf("Save() after owner closes lock error = %v", err)
	}
}

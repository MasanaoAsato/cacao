package fsstore

import (
	"bytes"
	"cacao/src/infrastructure/config"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"io/fs"
	"path/filepath"
	"sync"
	"testing"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

func TestFileSystemImageStorageSaveOpenDelete(t *testing.T) {
	t.Parallel()

	storage := newTestFileSystemImageStorage(t, config.ImageLimits{})
	ctx := context.Background()
	cases := []struct {
		name      string
		mediaType string
		extension string
	}{
		{name: "PNG", mediaType: "image/png", extension: ".png"},
		{name: "JPEG", mediaType: "image/jpeg", extension: ".jpg"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			imageID := value_object.NewID()
			generatedImage := newTestGeneratedImage(
				t,
				testCase.mediaType,
				2,
				3,
				color.RGBA{R: 20, G: 40, B: 60, A: 255},
			)

			assetReference, err := storage.Save(ctx, imageID, generatedImage)
			if err != nil {
				t.Fatalf("Save() error = %v", err)
			}
			wantStorageKey := filepath.ToSlash(filepath.Join(
				imageID.String()[:2],
				imageID.String()+testCase.extension,
			))
			if assetReference.StorageKey() != wantStorageKey {
				t.Errorf("StorageKey() = %q, want %q", assetReference.StorageKey(), wantStorageKey)
			}
			if assetReference.MediaType() != testCase.mediaType {
				t.Errorf("MediaType() = %q, want %q", assetReference.MediaType(), testCase.mediaType)
			}
			if assetReference.Width() != 2 || assetReference.Height() != 3 {
				t.Errorf(
					"dimensions = %dx%d, want 2x3",
					assetReference.Width(),
					assetReference.Height(),
				)
			}

			file, err := storage.Open(ctx, assetReference)
			if err != nil {
				t.Fatalf("Open() error = %v", err)
			}
			content, readErr := io.ReadAll(file)
			closeErr := file.Close()
			if readErr != nil {
				t.Fatalf("ReadAll() error = %v", readErr)
			}
			if closeErr != nil {
				t.Fatalf("Close() error = %v", closeErr)
			}
			if !bytes.Equal(content, generatedImage.Content) {
				t.Error("Open() content differs from content passed to Save()")
			}

			storedFile, err := storage.root.Stat(
				filepath.FromSlash(assetReference.StorageKey()),
			)
			if err != nil {
				t.Fatalf("Stat(stored file) error = %v", err)
			}
			if storedFile.Mode().Perm() != 0o640 {
				t.Errorf("stored file permission = %o, want 640", storedFile.Mode().Perm())
			}
			shardDirectory, err := storage.root.Stat(imageID.String()[:2])
			if err != nil {
				t.Fatalf("Stat(shard directory) error = %v", err)
			}
			if shardDirectory.Mode().Perm() != 0o750 {
				t.Errorf("shard directory permission = %o, want 750", shardDirectory.Mode().Perm())
			}

			if err := storage.Delete(ctx, assetReference); err != nil {
				t.Fatalf("Delete() error = %v", err)
			}
			if err := storage.Delete(ctx, assetReference); err != nil {
				t.Fatalf("Delete() for missing file error = %v", err)
			}
			_, err = storage.Open(ctx, assetReference)
			if !errors.Is(err, fs.ErrNotExist) {
				t.Errorf("Open() after Delete() error = %v, want fs.ErrNotExist", err)
			}
		})
	}
}

func TestFileSystemImageStorageRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	storage := newTestFileSystemImageStorage(t, config.ImageLimits{})
	ctx := context.Background()
	pngImage := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{A: 255},
	)

	tests := []struct {
		name  string
		image domainservice.GeneratedImage
	}{
		{
			name:  "0 byte image",
			image: domainservice.GeneratedImage{},
		},
		{
			name: "media type spoofing",
			image: domainservice.GeneratedImage{
				Content:   pngImage.Content,
				MediaType: "image/jpeg",
				Width:     2,
				Height:    2,
			},
		},
		{
			name: "dimension spoofing",
			image: domainservice.GeneratedImage{
				Content:   pngImage.Content,
				MediaType: "image/png",
				Width:     3,
				Height:    2,
			},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := storage.Save(ctx, value_object.NewID(), testCase.image)
			if !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
				t.Errorf("Save() error = %v, want ErrGeneratedImageInvalid", err)
			}
		})
	}

	assetReference, err := value_object.NewImageAssetReference(
		"../outside.png",
		"image/png",
		1,
		1,
	)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}
	if _, err := storage.Open(ctx, assetReference); err == nil {
		t.Error("Open() with traversal storage key error = nil, want error")
	}
	if err := storage.Delete(ctx, assetReference); err == nil {
		t.Error("Delete() with traversal storage key error = nil, want error")
	}
}

func TestFileSystemImageStorageRejectsDifferentContentForExistingKey(t *testing.T) {
	t.Parallel()

	storage := newTestFileSystemImageStorage(t, config.ImageLimits{})
	ctx := context.Background()
	imageID := value_object.NewID()
	first := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{R: 255, A: 255},
	)
	second := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{B: 255, A: 255},
	)

	if _, err := storage.Save(ctx, imageID, first); err != nil {
		t.Fatalf("first Save() error = %v", err)
	}
	if _, err := storage.Save(ctx, imageID, second); err == nil {
		t.Error("second Save() error = nil, want error")
	}
}

func TestFileSystemImageStorageRejectsConcurrentDifferentContentAcrossInstances(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	firstStorage := newTestFileSystemImageStorageAt(t, root, config.ImageLimits{})
	secondStorage := newTestFileSystemImageStorageAt(t, root, config.ImageLimits{})
	imageID := value_object.NewID()
	first := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{R: 255, A: 255},
	)
	second := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{B: 255, A: 255},
	)

	type saveResult struct {
		assetReference value_object.ImageAssetReference
		content        []byte
		err            error
	}
	results := make(chan saveResult, 2)
	start := make(chan struct{})
	var waitGroup sync.WaitGroup
	for _, input := range []struct {
		storage *Storage
		content domainservice.GeneratedImage
	}{
		{storage: firstStorage, content: first},
		{storage: secondStorage, content: second},
	} {
		waitGroup.Add(1)
		go func(storage *Storage, generatedImage domainservice.GeneratedImage) {
			defer waitGroup.Done()
			<-start
			assetReference, err := storage.Save(
				context.Background(),
				imageID,
				generatedImage,
			)
			results <- saveResult{
				assetReference: assetReference,
				content:        generatedImage.Content,
				err:            err,
			}
		}(input.storage, input.content)
	}
	close(start)
	waitGroup.Wait()
	close(results)

	successfulSaves := 0
	var successfulResult saveResult
	for result := range results {
		if result.err == nil {
			successfulSaves++
			successfulResult = result
		}
	}
	if successfulSaves != 1 {
		t.Fatalf("successful Save() count = %d, want 1", successfulSaves)
	}

	file, err := firstStorage.Open(context.Background(), successfulResult.assetReference)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	content, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		t.Fatalf("ReadAll() error = %v", readErr)
	}
	if closeErr != nil {
		t.Fatalf("Close() error = %v", closeErr)
	}
	if !bytes.Equal(content, successfulResult.content) {
		t.Error("concurrent Save() overwrote the first stored content")
	}
}

func TestFileSystemImageStorageRejectsDifferentFormatForExistingImageID(t *testing.T) {
	t.Parallel()

	storage := newTestFileSystemImageStorage(t, config.ImageLimits{})
	ctx := context.Background()
	imageID := value_object.NewID()
	pngImage := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{R: 255, A: 255},
	)
	jpegImage := newTestGeneratedImage(
		t,
		"image/jpeg",
		2,
		2,
		color.RGBA{B: 255, A: 255},
	)

	assetReference, err := storage.Save(ctx, imageID, pngImage)
	if err != nil {
		t.Fatalf("Save(PNG) error = %v", err)
	}
	if _, err := storage.Save(ctx, imageID, jpegImage); err == nil {
		t.Error("Save(JPEG with same image ID) error = nil, want error")
	}

	file, err := storage.Open(ctx, assetReference)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	content, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		t.Fatalf("ReadAll() error = %v", readErr)
	}
	if closeErr != nil {
		t.Fatalf("Close() error = %v", closeErr)
	}
	if !bytes.Equal(content, pngImage.Content) {
		t.Error("Save(JPEG) changed the existing PNG content")
	}
}

func TestFileSystemImageStorageSaveBoundaries(t *testing.T) {
	t.Parallel()

	exactImage := newTestGeneratedImage(
		t,
		"image/png",
		2,
		2,
		color.RGBA{A: 255},
	)

	t.Run("境界値系: byte width height pixel が上限ちょうど", func(t *testing.T) {
		storage := newTestFileSystemImageStorage(t, config.ImageLimits{
			MaxBytes:  int64(len(exactImage.Content)),
			MaxWidth:  2,
			MaxHeight: 2,
			MaxPixels: 4,
		})

		if _, err := storage.Save(context.Background(), value_object.NewID(), exactImage); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
	})

	t.Run("境界値系: byte 上限を1 byte超える", func(t *testing.T) {
		storage := newTestFileSystemImageStorage(t, config.ImageLimits{
			MaxBytes:  int64(len(exactImage.Content) - 1),
			MaxWidth:  2,
			MaxHeight: 2,
			MaxPixels: 4,
		})

		_, err := storage.Save(context.Background(), value_object.NewID(), exactImage)
		if !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
			t.Errorf("Save() error = %v, want ErrGeneratedImageInvalid", err)
		}
	})

	t.Run("境界値系: width height pixel が1超える", func(t *testing.T) {
		tests := []struct {
			name   string
			image  domainservice.GeneratedImage
			config config.ImageLimits
		}{
			{
				name:  "width",
				image: newTestGeneratedImage(t, "image/png", 3, 2, color.RGBA{A: 255}),
				config: config.ImageLimits{
					MaxBytes:  1 << 20,
					MaxWidth:  2,
					MaxHeight: 2,
					MaxPixels: 6,
				},
			},
			{
				name:  "height",
				image: newTestGeneratedImage(t, "image/png", 2, 3, color.RGBA{A: 255}),
				config: config.ImageLimits{
					MaxBytes:  1 << 20,
					MaxWidth:  2,
					MaxHeight: 2,
					MaxPixels: 6,
				},
			},
			{
				name:  "pixels",
				image: newTestGeneratedImage(t, "image/png", 3, 2, color.RGBA{A: 255}),
				config: config.ImageLimits{
					MaxBytes:  1 << 20,
					MaxWidth:  3,
					MaxHeight: 2,
					MaxPixels: 5,
				},
			},
		}

		for _, testCase := range tests {
			t.Run(testCase.name, func(t *testing.T) {
				storage := newTestFileSystemImageStorage(t, testCase.config)
				_, err := storage.Save(context.Background(), value_object.NewID(), testCase.image)
				if !errors.Is(err, domainservice.ErrGeneratedImageInvalid) {
					t.Errorf("Save() error = %v, want ErrGeneratedImageInvalid", err)
				}
			})
		}
	})
}

func newTestFileSystemImageStorage(
	t *testing.T,
	limits config.ImageLimits,
) *Storage {
	t.Helper()
	return newTestFileSystemImageStorageAt(t, t.TempDir(), limits)
}

func newTestFileSystemImageStorageAt(
	t *testing.T,
	root string,
	limits config.ImageLimits,
) *Storage {
	t.Helper()
	if limits.MaxBytes == 0 {
		limits.MaxBytes = 1 << 20
	}
	if limits.MaxWidth == 0 {
		limits.MaxWidth = 4096
	}
	if limits.MaxHeight == 0 {
		limits.MaxHeight = 4096
	}
	if limits.MaxPixels == 0 {
		limits.MaxPixels = 4096 * 4096
	}

	storage, err := New(config.ImageStorage{Driver: config.ImageStorageFilesystem, Root: root, Limits: limits})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	t.Cleanup(func() {
		if err := storage.Close(); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	})
	return storage
}

func newTestGeneratedImage(
	t *testing.T,
	mediaType string,
	width int,
	height int,
	fill color.Color,
) domainservice.GeneratedImage {
	t.Helper()

	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			canvas.Set(x, y, fill)
		}
	}

	var content bytes.Buffer
	var err error
	switch mediaType {
	case "image/png":
		err = png.Encode(&content, canvas)
	case "image/jpeg":
		err = jpeg.Encode(&content, canvas, &jpeg.Options{Quality: 100})
	default:
		t.Fatalf("unsupported test media type: %q", mediaType)
	}
	if err != nil {
		t.Fatalf("encode test image: %v", err)
	}

	return domainservice.GeneratedImage{
		Content:   content.Bytes(),
		MediaType: mediaType,
		Width:     width,
		Height:    height,
	}
}

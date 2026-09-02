package fsstore

import (
	"bytes"
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/imagecontent"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

const (
	temporaryImageFileAttempts = 4
	imageWriteLockAttempts     = 100
	imageWriteLockRetryDelay   = 10 * time.Millisecond
)

// Storage はバックエンドのファイルシステムに画像を保管する ImageStorage 実装。
// os.Root を通して操作するため、storage key から保存先rootの外へ到達できない。
type Storage struct {
	root   *os.Root
	limits imagecontent.Limits
	mu     sync.Mutex
}

var _ domainservice.ImageStorage = (*Storage)(nil)

// New はファイルシステム画像ストレージを生成する。
func New(config config.ImageStorage) (*Storage, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}

	rootPath, err := filepath.Abs(config.Root)
	if err != nil {
		return nil, fmt.Errorf("resolve image storage root: %w", err)
	}
	if err := os.MkdirAll(rootPath, 0o750); err != nil {
		return nil, fmt.Errorf("create image storage root: %w", err)
	}
	root, err := os.OpenRoot(rootPath)
	if err != nil {
		return nil, fmt.Errorf("open image storage root: %w", err)
	}

	return &Storage{
		root:   root,
		limits: imagecontent.Limits(config.Limits),
	}, nil
}

// Close は保存先rootのファイルディスクリプタを閉じる。
func (s *Storage) Close() error {
	return s.root.Close()
}

// Save は検証済みの生成画像を保存し、その参照情報を返す。
func (s *Storage) Save(
	ctx context.Context,
	imageID value_object.ID,
	generatedImage domainservice.GeneratedImage,
) (value_object.ImageAssetReference, error) {
	if err := ctx.Err(); err != nil {
		return value_object.ImageAssetReference{}, fmt.Errorf("save image: %w", err)
	}

	info, err := imagecontent.InspectGenerated(generatedImage, s.limits)
	if err != nil {
		return value_object.ImageAssetReference{}, err
	}
	extension, _ := imagecontent.Extension(info.MediaType)
	storageKey, err := imageStorageKey(imageID, extension)
	if err != nil {
		return value_object.ImageAssetReference{}, err
	}
	assetReference, err := value_object.NewImageAssetReference(
		storageKey,
		info.MediaType,
		info.Width,
		info.Height,
	)
	if err != nil {
		return value_object.ImageAssetReference{}, fmt.Errorf("create image asset reference: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := ctx.Err(); err != nil {
		return value_object.ImageAssetReference{}, fmt.Errorf("save image: %w", err)
	}
	storagePath, err := validateImageStorageKey(storageKey)
	if err != nil {
		return value_object.ImageAssetReference{}, err
	}
	shardDirectory := filepath.Dir(storagePath)
	if err := s.root.MkdirAll(shardDirectory, 0o750); err != nil {
		return value_object.ImageAssetReference{}, fmt.Errorf("create image shard directory: %w", err)
	}

	writeLock, err := s.acquireImageWriteLock(
		ctx,
		shardDirectory,
	)
	if err != nil {
		return value_object.ImageAssetReference{}, err
	}

	saveErr := s.saveImageWithWriteLock(
		shardDirectory,
		storagePath,
		storageKey,
		imageID.String(),
		generatedImage.Content,
	)
	releaseErr := writeLock.release()
	if saveErr != nil {
		if releaseErr != nil {
			return value_object.ImageAssetReference{}, errors.Join(saveErr, releaseErr)
		}
		return value_object.ImageAssetReference{}, saveErr
	}
	if releaseErr != nil {
		return value_object.ImageAssetReference{}, releaseErr
	}

	return assetReference, nil
}

// Open は画像バイナリを読み出す。storage key は毎回再検証する。
func (s *Storage) Open(
	ctx context.Context,
	assetReference value_object.ImageAssetReference,
) (io.ReadCloser, error) {
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("open image: %w", err)
	}
	storagePath, err := imageStoragePathFromReference(assetReference)
	if err != nil {
		return nil, err
	}

	file, err := s.root.Open(storagePath)
	if err != nil {
		return nil, fmt.Errorf("open stored image: %w", err)
	}
	return file, nil
}

// Delete は画像バイナリを削除する。存在しないファイルは成功として扱う。
func (s *Storage) Delete(
	ctx context.Context,
	assetReference value_object.ImageAssetReference,
) error {
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("delete image: %w", err)
	}
	storagePath, err := imageStoragePathFromReference(assetReference)
	if err != nil {
		return err
	}

	err = s.root.Remove(storagePath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("delete stored image: %w", err)
	}
	return nil
}

func (s *Storage) readExisting(
	storagePath string,
) ([]byte, bool, error) {
	file, err := s.root.Open(storagePath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("open existing image: %w", err)
	}

	content, readErr := io.ReadAll(io.LimitReader(file, s.limits.MaxBytes+1))
	closeErr := file.Close()
	if readErr != nil {
		return nil, false, fmt.Errorf("read existing image: %w", readErr)
	}
	if closeErr != nil {
		return nil, false, fmt.Errorf("close existing image: %w", closeErr)
	}
	if int64(len(content)) > s.limits.MaxBytes {
		return nil, false, fmt.Errorf("existing image exceeds maximum bytes")
	}
	return content, true, nil
}

func (s *Storage) acquireImageWriteLock(
	ctx context.Context,
	shardDirectory string,
) (*imageWriteLock, error) {
	lockPath := filepath.Join(shardDirectory, ".write.lock")
	file, err := s.root.OpenFile(lockPath, os.O_RDWR|os.O_CREATE, 0o640)
	if err != nil {
		return nil, fmt.Errorf("open image write lock: %w", err)
	}

	for range imageWriteLockAttempts {
		if err := ctx.Err(); err != nil {
			return nil, closeImageWriteLockFile(
				file,
				fmt.Errorf("acquire image write lock: %w", err),
			)
		}

		acquired, err := tryLockImageFile(file)
		if err == nil {
			if acquired {
				return &imageWriteLock{file: file}, nil
			}
		} else {
			return nil, closeImageWriteLockFile(
				file,
				fmt.Errorf("acquire image write lock: %w", err),
			)
		}
		if err := waitForImageWriteLock(ctx); err != nil {
			return nil, closeImageWriteLockFile(file, err)
		}
	}

	return nil, closeImageWriteLockFile(
		file,
		fmt.Errorf("image write lock did not become available in shard: %q", shardDirectory),
	)
}

func waitForImageWriteLock(ctx context.Context) error {
	timer := time.NewTimer(imageWriteLockRetryDelay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return fmt.Errorf("wait for image write lock: %w", ctx.Err())
	case <-timer.C:
		return nil
	}
}

func (s *Storage) saveImageWithWriteLock(
	shardDirectory string,
	storagePath string,
	storageKey string,
	imageID string,
	content []byte,
) error {
	for _, existingPath := range imageStoragePaths(shardDirectory, imageID) {
		existingContent, exists, err := s.readExisting(existingPath)
		if err != nil {
			return err
		}
		if !exists {
			continue
		}
		if existingPath != storagePath || !bytes.Equal(existingContent, content) {
			return fmt.Errorf("image storage key already has different content: %q", storageKey)
		}
		return nil
	}

	temporaryPath, err := s.writeTemporaryFile(shardDirectory, imageID, content)
	if err != nil {
		return err
	}
	if err := s.root.Rename(temporaryPath, storagePath); err != nil {
		return s.removeTemporaryFile(
			temporaryPath,
			fmt.Errorf("rename temporary image: %w", err),
		)
	}
	return nil
}

type imageWriteLock struct {
	file *os.File
}

func (l *imageWriteLock) release() error {
	unlockErr := unlockImageFile(l.file)
	closeErr := l.file.Close()
	if unlockErr != nil && closeErr != nil {
		return errors.Join(
			fmt.Errorf("unlock image write lock: %w", unlockErr),
			fmt.Errorf("close image write lock: %w", closeErr),
		)
	}
	if unlockErr != nil {
		return fmt.Errorf("unlock image write lock: %w", unlockErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close image write lock: %w", closeErr)
	}
	return nil
}

func closeImageWriteLockFile(file *os.File, cause error) error {
	if closeErr := file.Close(); closeErr != nil {
		return errors.Join(cause, fmt.Errorf("close image write lock: %w", closeErr))
	}
	return cause
}

func (s *Storage) writeTemporaryFile(
	shardDirectory string,
	imageID string,
	content []byte,
) (string, error) {
	temporaryPath, file, err := s.createTemporaryFile(shardDirectory, imageID)
	if err != nil {
		return "", err
	}

	fileOpen := true
	cleanup := func(cause error) error {
		if fileOpen {
			if closeErr := file.Close(); closeErr != nil {
				cause = errors.Join(cause, fmt.Errorf("close temporary image: %w", closeErr))
			}
			fileOpen = false
		}
		return s.removeTemporaryFile(temporaryPath, cause)
	}

	written, err := file.Write(content)
	if err != nil {
		return "", cleanup(fmt.Errorf("write temporary image: %w", err))
	}
	if written != len(content) {
		return "", cleanup(fmt.Errorf("write temporary image: %w", io.ErrShortWrite))
	}
	if err := file.Sync(); err != nil {
		return "", cleanup(fmt.Errorf("sync temporary image: %w", err))
	}
	if err := file.Close(); err != nil {
		fileOpen = false
		return "", cleanup(fmt.Errorf("close temporary image: %w", err))
	}
	fileOpen = false

	return temporaryPath, nil
}

func (s *Storage) createTemporaryFile(
	shardDirectory string,
	imageID string,
) (string, *os.File, error) {
	for range temporaryImageFileAttempts {
		randomBytes := make([]byte, 16)
		if _, err := rand.Read(randomBytes); err != nil {
			return "", nil, fmt.Errorf("read temporary image random suffix: %w", err)
		}
		temporaryPath := filepath.Join(
			shardDirectory,
			"."+imageID+"-"+hex.EncodeToString(randomBytes)+".tmp",
		)
		file, err := s.root.OpenFile(
			temporaryPath,
			os.O_WRONLY|os.O_CREATE|os.O_EXCL,
			0o640,
		)
		if errors.Is(err, fs.ErrExist) {
			continue
		}
		if err != nil {
			return "", nil, fmt.Errorf("create temporary image: %w", err)
		}
		return temporaryPath, file, nil
	}

	return "", nil, fmt.Errorf("create unique temporary image file")
}

func (s *Storage) removeTemporaryFile(
	temporaryPath string,
	cause error,
) error {
	if err := s.root.Remove(temporaryPath); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return errors.Join(cause, fmt.Errorf("remove temporary image: %w", err))
	}
	return cause
}

func imageStorageKey(imageID value_object.ID, extension string) (string, error) {
	if imageID.IsEmpty() {
		return "", fmt.Errorf("image id must not be empty")
	}
	imageIDString := imageID.String()
	if len(imageIDString) < 2 {
		return "", fmt.Errorf("image id is too short")
	}
	return filepath.ToSlash(filepath.Join(
		imageIDString[:2],
		imageIDString+extension,
	)), nil
}

func imageStoragePaths(shardDirectory string, imageID string) []string {
	return []string{
		filepath.Join(shardDirectory, imageID+".png"),
		filepath.Join(shardDirectory, imageID+".jpg"),
	}
}

func imageStoragePathFromReference(
	assetReference value_object.ImageAssetReference,
) (string, error) {
	if err := assetReference.Validate(); err != nil {
		return "", fmt.Errorf("invalid image asset reference: %w", err)
	}
	return validateImageStorageKey(assetReference.StorageKey())
}

func validateImageStorageKey(storageKey string) (string, error) {
	if storageKey == "" {
		return "", fmt.Errorf("image storage key must not be empty")
	}
	if strings.ContainsRune(storageKey, '\\') {
		return "", fmt.Errorf("image storage key must use slash separators")
	}
	storagePath := filepath.FromSlash(storageKey)
	if filepath.IsAbs(storagePath) || !filepath.IsLocal(storagePath) {
		return "", fmt.Errorf("image storage key must be local: %q", storageKey)
	}
	if filepath.Clean(storagePath) != storagePath {
		return "", fmt.Errorf("image storage key must be clean: %q", storageKey)
	}
	return storagePath, nil
}

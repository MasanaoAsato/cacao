package worker

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	generatejourneyimage "cacao/src/application/generate_journey_image"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/observability"
)

const recoveryInterval = time.Minute

// Config は画像生成 worker の動作設定を表す。
// 生成タイムアウトと lease は worker ではなくユースケース側の設定で扱う。
type Config struct {
	PollInterval      time.Duration
	BatchSize         int
	Concurrency       int
	RecoveryBatchSize int
}

// WorkerOption は JourneyImageWorker の構成を変更する。
type WorkerOption func(*JourneyImageWorker)

// WithClock はworker内で使う現在時刻を差し替える。
func WithClock(now func() time.Time) WorkerOption {
	return func(worker *JourneyImageWorker) {
		if now != nil {
			worker.now = now
		}
	}
}

// WithLogger はworker境界のエラーを記録するロガーを差し替える。
func WithLogger(logger *slog.Logger) WorkerOption {
	return func(worker *JourneyImageWorker) {
		if logger != nil {
			worker.logger = logger
		}
	}
}

// DefaultConfig は設計書で定めた初期設定を返す。
func DefaultConfig() Config {
	return Config{
		PollInterval:      time.Second,
		BatchSize:         1,
		Concurrency:       1,
		RecoveryBatchSize: 10,
	}
}

// JourneyImageWorker はpending画像をpollし、画像生成use caseを起動するworkerである。
type JourneyImageWorker struct {
	config     Config
	imageRepo  repository.JourneyImageRepository
	generateUC generatejourneyimage.UseCase
	now        func() time.Time
	logger     *slog.Logger
}

// NewJourneyImageWorker は画像生成workerを生成する。
func NewJourneyImageWorker(
	config Config,
	imageRepo repository.JourneyImageRepository,
	generateUC generatejourneyimage.UseCase,
	options ...WorkerOption,
) (*JourneyImageWorker, error) {
	normalizedConfig, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	if imageRepo == nil {
		return nil, fmt.Errorf("journey image repository must not be nil")
	}
	if generateUC == nil {
		return nil, fmt.Errorf("generate journey image use case must not be nil")
	}

	worker := &JourneyImageWorker{
		config:     normalizedConfig,
		imageRepo:  imageRepo,
		generateUC: generateUC,
		now:        time.Now,
		logger:     slog.Default(),
	}
	for _, option := range options {
		if option != nil {
			option(worker)
		}
	}

	return worker, nil
}

// Run はworkerを起動し、stopPollingが閉じるかctxがcancelされるまでpollする。
// stopPollingの終了後も、起動済みの生成処理が完了するまで待機する。
func (w *JourneyImageWorker) Run(ctx context.Context, stopPolling <-chan struct{}) error {
	if ctx == nil {
		ctx = context.Background()
	}

	pollTicker := time.NewTicker(w.config.PollInterval)
	defer pollTicker.Stop()
	recoveryTicker := time.NewTicker(recoveryInterval)
	defer recoveryTicker.Stop()

	semaphore := make(chan struct{}, w.config.Concurrency)
	var waitGroup sync.WaitGroup
	defer waitGroup.Wait()

	if !isPollingStopped(stopPolling) {
		w.recoverExpired(ctx)
		if !isPollingStopped(stopPolling) {
			w.pollPending(ctx, stopPolling, semaphore, &waitGroup)
		}
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-stopPolling:
			return nil
		case <-pollTicker.C:
			if isPollingStopped(stopPolling) {
				return nil
			}
			w.pollPending(ctx, stopPolling, semaphore, &waitGroup)
		case <-recoveryTicker.C:
			if isPollingStopped(stopPolling) {
				return nil
			}
			w.recoverExpired(ctx)
		}
	}
}

func (w *JourneyImageWorker) pollPending(
	ctx context.Context,
	stopPolling <-chan struct{},
	semaphore chan struct{},
	waitGroup *sync.WaitGroup,
) {
	if isPollingStopped(stopPolling) {
		return
	}

	images, err := w.imageRepo.FindPending(ctx, w.config.BatchSize)
	if err != nil {
		w.reportError(ctx, "find_pending_journey_images", "", err)
		return
	}

	for _, image := range images {
		if isPollingStopped(stopPolling) {
			return
		}
		select {
		case semaphore <- struct{}{}:
		case <-ctx.Done():
			return
		case <-stopPolling:
			return
		}
		if isPollingStopped(stopPolling) {
			<-semaphore
			return
		}

		imageID := image.ID()
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			defer func() { <-semaphore }()

			if isPollingStopped(stopPolling) {
				return
			}
			if err := w.executeGeneration(ctx, imageID); err != nil && ctx.Err() == nil {
				w.reportError(ctx, "generate_journey_image", imageID.String(), err)
			}
		}()
	}
}

// executeGeneration はユースケースを起動する。生成タイムアウトと lease はユースケースの設定に従う。
func (w *JourneyImageWorker) executeGeneration(ctx context.Context, imageID value_object.ID) error {
	return w.generateUC.Execute(ctx, generatejourneyimage.Input{ImageID: imageID.String()})
}

func (w *JourneyImageWorker) recoverExpired(ctx context.Context) {
	images, err := w.imageRepo.FindExpiredProcessing(
		ctx,
		w.now(),
		w.config.RecoveryBatchSize,
	)
	if err != nil {
		w.reportError(ctx, "find_expired_journey_images", "", err)
		return
	}

	for _, image := range images {
		if err := image.Fail(value_object.ImageFailureCodeProviderTimeout); err != nil {
			w.reportError(ctx, "fail_expired_journey_image", image.ID().String(), err)
			continue
		}
		if err := w.imageRepo.Save(ctx, image); err != nil {
			w.reportError(ctx, "save_expired_journey_image", image.ID().String(), err)
		}
	}
}

func (w *JourneyImageWorker) reportError(ctx context.Context, operation string, imageID string, err error) {
	observability.LogFailure(
		ctx,
		w.logger,
		slog.LevelError,
		observability.FailureContext{
			Operation:      operation,
			JourneyImageID: imageID,
		},
		err,
	)
}

// normalizeConfig は未設定（0）の項目に既定値を入れ、負や 0 の不正値を拒否する。
// 許容範囲（並列数の上限など）は運用設定側（infrastructure/config）で検証済みとする。
func normalizeConfig(config Config) (Config, error) {
	defaults := DefaultConfig()
	if config.PollInterval == 0 {
		config.PollInterval = defaults.PollInterval
	}
	if config.PollInterval < 0 {
		return Config{}, fmt.Errorf("poll interval must be positive")
	}
	if config.BatchSize == 0 {
		config.BatchSize = defaults.BatchSize
	}
	if config.BatchSize < 0 {
		return Config{}, fmt.Errorf("worker batch size must be positive")
	}
	if config.Concurrency == 0 {
		config.Concurrency = defaults.Concurrency
	}
	if config.Concurrency < 0 {
		return Config{}, fmt.Errorf("worker concurrency must be positive")
	}
	if config.RecoveryBatchSize == 0 {
		config.RecoveryBatchSize = defaults.RecoveryBatchSize
	}
	if config.RecoveryBatchSize < 0 {
		return Config{}, fmt.Errorf("recovery batch size must be positive")
	}

	return config, nil
}

func isPollingStopped(stopPolling <-chan struct{}) bool {
	if stopPolling == nil {
		return false
	}

	select {
	case <-stopPolling:
		return true
	default:
		return false
	}
}

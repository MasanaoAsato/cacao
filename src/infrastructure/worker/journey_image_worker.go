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
)

const recoveryInterval = time.Minute

// WorkerConfig は画像生成workerの動作設定を表す。
type WorkerConfig struct {
	PollInterval      time.Duration
	BatchSize         int
	Concurrency       int
	GenerationTimeout time.Duration
	LeaseDuration     time.Duration
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

// DefaultWorkerConfig は設計書で定めた初期設定を返す。
func DefaultWorkerConfig() WorkerConfig {
	return WorkerConfig{
		PollInterval:      time.Second,
		BatchSize:         1,
		Concurrency:       1,
		GenerationTimeout: 180 * time.Second,
		LeaseDuration:     240 * time.Second,
		RecoveryBatchSize: 10,
	}
}

// JourneyImageWorker はpending画像をpollし、画像生成use caseを起動するworkerである。
type JourneyImageWorker struct {
	config     WorkerConfig
	imageRepo  repository.JourneyImageRepository
	generateUC generatejourneyimage.UseCase
	now        func() time.Time
	logger     *slog.Logger
}

// NewJourneyImageWorker は画像生成workerを生成する。
func NewJourneyImageWorker(
	config WorkerConfig,
	imageRepo repository.JourneyImageRepository,
	generateUC generatejourneyimage.UseCase,
	options ...WorkerOption,
) (*JourneyImageWorker, error) {
	normalizedConfig, err := normalizeWorkerConfig(config)
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

// NewJourneyImage は設計書の短いconstructor名を互換的に提供する。
func NewJourneyImage(
	config WorkerConfig,
	imageRepo repository.JourneyImageRepository,
	generateUC generatejourneyimage.UseCase,
	options ...WorkerOption,
) (*JourneyImageWorker, error) {
	return NewJourneyImageWorker(config, imageRepo, generateUC, options...)
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
		w.reportError("find pending journey images", err)
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
				w.reportError("generate journey image", fmt.Errorf("image %s: %w", imageID, err))
			}
		}()
	}
}

func (w *JourneyImageWorker) executeGeneration(ctx context.Context, imageID value_object.ID) error {
	input := generatejourneyimage.Input{ImageID: imageID.String()}
	if leaseAware, ok := w.generateUC.(generatejourneyimage.LeaseAwareUseCase); ok {
		return leaseAware.ExecuteWithTimeoutAndLease(
			ctx,
			input,
			w.config.GenerationTimeout,
			w.config.LeaseDuration,
		)
	}
	if timeoutAware, ok := w.generateUC.(generatejourneyimage.TimeoutAwareUseCase); ok {
		return timeoutAware.ExecuteWithTimeout(ctx, input, w.config.GenerationTimeout)
	}

	generationContext, cancel := context.WithTimeout(ctx, w.config.GenerationTimeout)
	defer cancel()
	return w.generateUC.Execute(generationContext, input)
}

func (w *JourneyImageWorker) recoverExpired(ctx context.Context) {
	images, err := w.imageRepo.FindExpiredProcessing(
		ctx,
		w.now(),
		w.config.RecoveryBatchSize,
	)
	if err != nil {
		w.reportError("find expired journey images", err)
		return
	}

	for _, image := range images {
		if err := image.Fail(value_object.ImageFailureCodeProviderTimeout); err != nil {
			w.reportError("fail expired journey image", fmt.Errorf("image %s: %w", image.ID(), err))
			continue
		}
		if err := w.imageRepo.Save(ctx, image); err != nil {
			w.reportError("save expired journey image", fmt.Errorf("image %s: %w", image.ID(), err))
		}
	}
}

func (w *JourneyImageWorker) reportError(message string, err error) {
	w.logger.Error(message, slog.Any("error", err))
}

func normalizeWorkerConfig(config WorkerConfig) (WorkerConfig, error) {
	defaults := DefaultWorkerConfig()
	if config.PollInterval == 0 {
		config.PollInterval = defaults.PollInterval
	}
	if config.PollInterval < 100*time.Millisecond {
		return WorkerConfig{}, fmt.Errorf("poll interval must be at least 100ms")
	}
	if config.BatchSize == 0 {
		config.BatchSize = defaults.BatchSize
	}
	if config.BatchSize < 1 {
		return WorkerConfig{}, fmt.Errorf("worker batch size must be positive")
	}
	if config.Concurrency == 0 {
		config.Concurrency = defaults.Concurrency
	}
	if config.Concurrency < 1 || config.Concurrency > 4 {
		return WorkerConfig{}, fmt.Errorf("worker concurrency must be between 1 and 4")
	}
	if config.GenerationTimeout == 0 {
		config.GenerationTimeout = defaults.GenerationTimeout
	}
	if config.GenerationTimeout < time.Second {
		return WorkerConfig{}, fmt.Errorf("generation timeout must be at least 1s")
	}
	if config.LeaseDuration == 0 {
		config.LeaseDuration = defaults.LeaseDuration
	}
	if config.LeaseDuration <= config.GenerationTimeout {
		return WorkerConfig{}, fmt.Errorf("lease duration must be longer than generation timeout")
	}
	if config.RecoveryBatchSize == 0 {
		config.RecoveryBatchSize = defaults.RecoveryBatchSize
	}
	if config.RecoveryBatchSize < 1 {
		return WorkerConfig{}, fmt.Errorf("recovery batch size must be positive")
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

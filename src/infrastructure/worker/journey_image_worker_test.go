package worker

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"go.uber.org/goleak"

	generatejourneyimage "cacao/src/application/generate_journey_image"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}

func TestNewJourneyImageWorkerConfigBoundaries(t *testing.T) {
	tests := []struct {
		name    string
		config  WorkerConfig
		wantErr bool
	}{
		{name: "zero uses defaults", config: WorkerConfig{}},
		{name: "poll interval below minimum", config: WorkerConfig{PollInterval: 99 * time.Millisecond}, wantErr: true},
		{name: "batch size below minimum", config: WorkerConfig{BatchSize: -1}, wantErr: true},
		{name: "concurrency above maximum", config: WorkerConfig{Concurrency: 5}, wantErr: true},
		{name: "generation timeout below minimum", config: WorkerConfig{GenerationTimeout: 999 * time.Millisecond}, wantErr: true},
		{name: "lease not longer than generation timeout", config: WorkerConfig{
			GenerationTimeout: time.Second,
			LeaseDuration:     time.Second,
		}, wantErr: true},
		{name: "recovery batch below minimum", config: WorkerConfig{RecoveryBatchSize: -1}, wantErr: true},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := NewJourneyImageWorker(
				testCase.config,
				&workerImageRepositoryStub{},
				&workerGenerateUseCaseStub{},
				WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
			)
			if (err != nil) != testCase.wantErr {
				t.Errorf("NewJourneyImageWorker() error = %v, wantErr = %v", err, testCase.wantErr)
			}
		})
	}
}

func TestJourneyImageWorkerPollPendingStopsBeforeFind(t *testing.T) {
	repositoryStub := &workerImageRepositoryStub{
		pending: []entity.JourneyImage{newWorkerTestImage(t, false)},
	}
	worker, err := NewJourneyImageWorker(
		WorkerConfig{},
		repositoryStub,
		&workerGenerateUseCaseStub{},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("NewJourneyImageWorker() error = %v", err)
	}

	stopPolling := make(chan struct{})
	close(stopPolling)
	var waitGroup sync.WaitGroup
	worker.pollPending(
		context.Background(),
		stopPolling,
		make(chan struct{}, 1),
		&waitGroup,
	)
	waitGroup.Wait()

	if got := repositoryStub.pendingFindCalls.Load(); got != 0 {
		t.Errorf("FindPending() calls = %d, want 0 after stopPolling", got)
	}
}

func TestJourneyImageWorkerPassesTimeoutAndLeaseToUseCase(t *testing.T) {
	const (
		generationTimeout = 2 * time.Second
		leaseDuration     = 3 * time.Second
	)
	generateStub := &workerTimeoutAwareUseCaseStub{}
	worker, err := NewJourneyImageWorker(
		WorkerConfig{
			PollInterval:      100 * time.Millisecond,
			GenerationTimeout: generationTimeout,
			LeaseDuration:     leaseDuration,
		},
		&workerImageRepositoryStub{},
		generateStub,
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("NewJourneyImageWorker() error = %v", err)
	}

	if err := worker.executeGeneration(context.Background(), value_object.NewID()); err != nil {
		t.Fatalf("executeGeneration() error = %v", err)
	}
	if generateStub.generationTimeout != generationTimeout {
		t.Errorf(
			"generation timeout = %s, want %s",
			generateStub.generationTimeout,
			generationTimeout,
		)
	}
	if generateStub.leaseDuration != leaseDuration {
		t.Errorf("lease duration = %s, want %s", generateStub.leaseDuration, leaseDuration)
	}
}

func TestJourneyImageWorkerRunPollsPendingOnStartup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		image := newWorkerTestImage(t, false)
		repositoryStub := &workerImageRepositoryStub{pending: []entity.JourneyImage{image}}
		generateStub := &workerGenerateUseCaseStub{started: make(chan struct{}, 1)}
		worker, err := NewJourneyImageWorker(
			WorkerConfig{PollInterval: 100 * time.Millisecond},
			repositoryStub,
			generateStub,
			WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
		)
		if err != nil {
			t.Fatalf("NewJourneyImageWorker() error = %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stopPolling := make(chan struct{})
		done := make(chan error, 1)
		go func() { done <- worker.Run(ctx, stopPolling) }()

		<-generateStub.started
		if got := generateStub.calls.Load(); got != 1 {
			t.Errorf("Generate use case calls = %d, want 1", got)
		}
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run() error = %v, want nil", err)
		}
	})
}

func TestJourneyImageWorkerRecoversExpiredProcessing(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		image := newWorkerTestImage(t, true)
		repositoryStub := &workerImageRepositoryStub{
			expired: []entity.JourneyImage{image},
			saved:   make(chan entity.JourneyImage, 1),
		}
		worker, err := NewJourneyImageWorker(
			WorkerConfig{},
			repositoryStub,
			&workerGenerateUseCaseStub{},
			WithClock(func() time.Time { return time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC) }),
			WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
		)
		if err != nil {
			t.Fatalf("NewJourneyImageWorker() error = %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan error, 1)
		go func() { done <- worker.Run(ctx, make(chan struct{})) }()

		saved := <-repositoryStub.saved
		failureCode, ok := saved.FailureCode()
		if !ok || failureCode != value_object.ImageFailureCodeProviderTimeout {
			t.Errorf("recovered failure code = %q, want provider_timeout", failureCode)
		}
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run() error = %v, want nil", err)
		}
	})
}

func TestJourneyImageWorkerStopWaitsForStartedGeneration(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		image := newWorkerTestImage(t, false)
		repositoryStub := &workerImageRepositoryStub{pending: []entity.JourneyImage{image}}
		generateStub := &workerGenerateUseCaseStub{
			started: make(chan struct{}, 1),
			block:   true,
		}
		worker, err := NewJourneyImageWorker(
			WorkerConfig{PollInterval: 100 * time.Millisecond},
			repositoryStub,
			generateStub,
			WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
		)
		if err != nil {
			t.Fatalf("NewJourneyImageWorker() error = %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		stopPolling := make(chan struct{})
		done := make(chan error, 1)
		go func() { done <- worker.Run(ctx, stopPolling) }()
		<-generateStub.started

		close(stopPolling)
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run() error = %v, want nil", err)
		}
		if got := generateStub.calls.Load(); got != 1 {
			t.Errorf("Generate use case calls = %d, want 1", got)
		}
	})
}

func TestJourneyImageWorkerAppliesGenerationTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		image := newWorkerTestImage(t, false)
		repositoryStub := &workerImageRepositoryStub{pending: []entity.JourneyImage{image}}
		generateStub := &workerGenerateUseCaseStub{
			started:  make(chan struct{}, 1),
			finished: make(chan struct{}),
			block:    true,
		}
		worker, err := NewJourneyImageWorker(
			WorkerConfig{
				PollInterval:      100 * time.Millisecond,
				GenerationTimeout: time.Second,
				LeaseDuration:     2 * time.Second,
			},
			repositoryStub,
			generateStub,
			WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
		)
		if err != nil {
			t.Fatalf("NewJourneyImageWorker() error = %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan error, 1)
		go func() { done <- worker.Run(ctx, make(chan struct{})) }()
		<-generateStub.started
		<-generateStub.finished
		cancel()
		if err := <-done; err != nil {
			t.Errorf("Run() error = %v, want nil", err)
		}
	})
}

type workerGenerateUseCaseStub struct {
	started  chan struct{}
	finished chan struct{}
	block    bool
	err      error
	calls    atomic.Int32
}

type workerTimeoutAwareUseCaseStub struct {
	generationTimeout time.Duration
	leaseDuration     time.Duration
}

func (g *workerTimeoutAwareUseCaseStub) Execute(context.Context, generatejourneyimage.Input) error {
	return nil
}

func (g *workerTimeoutAwareUseCaseStub) ExecuteWithTimeout(_ context.Context, _ generatejourneyimage.Input, _ time.Duration) error {
	return nil
}

func (g *workerTimeoutAwareUseCaseStub) ExecuteWithTimeoutAndLease(
	_ context.Context,
	_ generatejourneyimage.Input,
	generationTimeout time.Duration,
	leaseDuration time.Duration,
) error {
	g.generationTimeout = generationTimeout
	g.leaseDuration = leaseDuration
	return nil
}

func (g *workerGenerateUseCaseStub) Execute(ctx context.Context, _ generatejourneyimage.Input) error {
	g.calls.Add(1)
	if g.started != nil {
		select {
		case g.started <- struct{}{}:
		default:
		}
	}
	if g.block {
		<-ctx.Done()
		if g.finished != nil {
			close(g.finished)
		}
		return ctx.Err()
	}
	return g.err
}

type workerImageRepositoryStub struct {
	mu               sync.Mutex
	pending          []entity.JourneyImage
	pendingFindCalls atomic.Int32
	expired          []entity.JourneyImage
	saved            chan entity.JourneyImage
}

func (r *workerImageRepositoryStub) Save(_ context.Context, image entity.JourneyImage) error {
	if r.saved != nil {
		r.saved <- image
	}
	return nil
}

func (r *workerImageRepositoryStub) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyImage, error) {
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (r *workerImageRepositoryStub) FindByRequestID(_ context.Context, _ value_object.ID) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (r *workerImageRepositoryStub) FindBySlot(_ context.Context, _ value_object.ID, _ value_object.ImageSlot) (entity.JourneyImage, error) {
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (r *workerImageRepositoryStub) FindPending(_ context.Context, _ int) ([]entity.JourneyImage, error) {
	r.pendingFindCalls.Add(1)
	r.mu.Lock()
	defer r.mu.Unlock()
	pending := r.pending
	r.pending = nil
	return pending, nil
}

func (r *workerImageRepositoryStub) FindExpiredProcessing(_ context.Context, _ time.Time, _ int) ([]entity.JourneyImage, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	expired := r.expired
	r.expired = nil
	return expired, nil
}

func (r *workerImageRepositoryStub) Claim(_ context.Context, _ value_object.ID, _ time.Time) (entity.JourneyImage, bool, error) {
	return entity.JourneyImage{}, false, nil
}

func (r *workerImageRepositoryStub) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

func newWorkerTestImage(t *testing.T, processing bool) entity.JourneyImage {
	t.Helper()
	slot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), value_object.NewID(), slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
	if processing {
		if err := image.Start(); err != nil {
			t.Fatalf("JourneyImage.Start() error = %v", err)
		}
	}

	return image
}

var _ repository.JourneyImageRepository = (*workerImageRepositoryStub)(nil)
var _ generatejourneyimage.UseCase = (*workerGenerateUseCaseStub)(nil)
var _ generatejourneyimage.LeaseAwareUseCase = (*workerTimeoutAwareUseCaseStub)(nil)

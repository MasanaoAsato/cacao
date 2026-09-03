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
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}

func TestNewJourneyImageConfigBoundaries(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{name: "zero uses defaults", config: Config{}},
		{name: "poll interval negative", config: Config{PollInterval: -time.Millisecond}, wantErr: true},
		{name: "batch size below minimum", config: Config{BatchSize: -1}, wantErr: true},
		{name: "concurrency negative", config: Config{Concurrency: -1}, wantErr: true},
		{name: "recovery batch below minimum", config: Config{RecoveryBatchSize: -1}, wantErr: true},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := NewJourneyImageWorker(
				testCase.config,
				fakes.NewJourneyImageRepository(),
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
	imageRepo := fakes.NewJourneyImageRepositoryWith(t, testkit.MustNewPendingImage(t))
	var pendingFindCalls atomic.Int32
	imageRepo.FindPendingFn = func(ctx context.Context, limit int) ([]entity.JourneyImage, error) {
		pendingFindCalls.Add(1)
		return imageRepo.JourneyImageRepositoryMemory.FindPending(ctx, limit)
	}
	worker, err := NewJourneyImageWorker(
		Config{},
		imageRepo,
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

	if got := pendingFindCalls.Load(); got != 0 {
		t.Errorf("FindPending() calls = %d, want 0 after stopPolling", got)
	}
}

func TestJourneyImageWorkerRunPollsPendingOnStartup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		imageRepo := fakes.NewJourneyImageRepositoryWith(t, testkit.MustNewPendingImage(t))
		generateStub := &workerGenerateUseCaseStub{imageRepo: imageRepo, started: make(chan struct{}, 1)}
		worker, err := NewJourneyImageWorker(
			Config{PollInterval: 100 * time.Millisecond},
			imageRepo,
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
		now := time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC)
		image := testkit.MustNewPendingImage(t)
		imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
		// lease が now より前に切れた processing 画像を用意する。
		if _, claimed, err := imageRepo.Claim(context.Background(), image.ID(), now.Add(-time.Minute)); err != nil || !claimed {
			t.Fatalf("Claim() = (claimed %v, error %v), want claimed", claimed, err)
		}
		worker, err := NewJourneyImageWorker(
			Config{},
			imageRepo,
			&workerGenerateUseCaseStub{},
			WithClock(func() time.Time { return now }),
			WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
		)
		if err != nil {
			t.Fatalf("NewJourneyImageWorker() error = %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan error, 1)
		go func() { done <- worker.Run(ctx, make(chan struct{})) }()

		// Run は起動時の recovery を終えてから select で待機するので、そこまで進むのを待つ。
		synctest.Wait()
		recovered, err := imageRepo.FindByID(context.Background(), image.ID())
		if err != nil {
			t.Fatalf("FindByID() error = %v", err)
		}
		failureCode, ok := recovered.FailureCode()
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
		imageRepo := fakes.NewJourneyImageRepositoryWith(t, testkit.MustNewPendingImage(t))
		generateStub := &workerGenerateUseCaseStub{
			imageRepo: imageRepo,
			started:   make(chan struct{}, 1),
			block:     true,
		}
		worker, err := NewJourneyImageWorker(
			Config{PollInterval: 100 * time.Millisecond},
			imageRepo,
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

// workerGenerateUseCaseStub は generate use case のスタブ。
// imageRepo が非 nil のときは実ユースケースと同様に画像を Claim して pending から外す。
// これがないと poll ごとに同じ画像が FindPending で返され、再ディスパッチされてしまう。
type workerGenerateUseCaseStub struct {
	imageRepo repository.JourneyImageRepository
	started   chan struct{}
	finished  chan struct{}
	block     bool
	err       error
	calls     atomic.Int32
}

func (g *workerGenerateUseCaseStub) Execute(ctx context.Context, input generatejourneyimage.Input) error {
	g.calls.Add(1)
	if err := g.claim(ctx, input); err != nil {
		return err
	}
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

func (g *workerGenerateUseCaseStub) claim(ctx context.Context, input generatejourneyimage.Input) error {
	if g.imageRepo == nil {
		return nil
	}
	imageID, err := value_object.NewIDFromString(input.ImageID)
	if err != nil {
		return err
	}
	_, _, err = g.imageRepo.Claim(ctx, imageID, time.Now().Add(time.Minute))
	return err
}

var _ generatejourneyimage.UseCase = (*workerGenerateUseCaseStub)(nil)

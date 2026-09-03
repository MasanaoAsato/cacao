package generatejourneyimage

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	domainservice "cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestUseCaseExecuteCompletesClaimedImage(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)
	image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
	imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
	requestRepo := fakes.NewJourneyRequestRepositoryWith(t, request)
	generator := &generateImageGeneratorStub{}
	storage := &generateImageStorageStub{asset: testkit.MustNewAssetReference(t)}
	useCase := mustNewUseCase(t,
		imageRepo,
		requestRepo,
		generator,
		storage,
		Config{
			GenerationTimeout: time.Second,
			LeaseDuration:     2 * time.Second,
		},
	)

	if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if !generator.called {
		t.Error("ImageGenerator.Generate() was not called")
	}
	wantStyle, err := domainservice.SelectCoverStyle(image.ID())
	if err != nil {
		t.Fatalf("domainservice.SelectCoverStyle() error = %v", err)
	}
	if generator.brief.Style() != wantStyle {
		t.Errorf("generated brief style = %q, want %q", generator.brief.Style(), wantStyle)
	}
	if saved := mustFindImage(t, imageRepo, image.ID()); saved.Status() != value_object.ImageStatusReady {
		t.Errorf("saved image status = %q, want ready", saved.Status())
	}
	if !storage.saveCalled {
		t.Error("ImageStorage.Save() was not called")
	}
}

func TestUseCaseExecuteKeepsIllustrationStyleNone(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)
	slot := testkit.MustNewImageSlot(t, value_object.ImagePurposeIllustration, 1)
	image := testkit.MustNewPendingImageFor(t, request.ID(), slot)
	generator := &generateImageGeneratorStub{}
	useCase := mustNewUseCase(t,
		fakes.NewJourneyImageRepositoryWith(t, image),
		fakes.NewJourneyRequestRepositoryWith(t, request),
		generator,
		&generateImageStorageStub{asset: testkit.MustNewAssetReference(t)},
		testConfig(),
	)

	if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if !generator.called {
		t.Fatal("ImageGenerator.Generate() was not called")
	}
	if generator.brief.Style() != value_object.ImageVisualStyleNone {
		t.Errorf("generated illustration brief style = %q, want none", generator.brief.Style())
	}
}

func TestUseCaseExecuteUsesConfiguredLeaseDuration(t *testing.T) {
	now := time.Date(2026, time.August, 1, 12, 0, 0, 0, time.UTC)
	request := testkit.MustNewJourneyRequest(t)
	image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
	imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
	// ready で保存されると lease は解除されるため、Claim に渡された値をここで捕捉する。
	var claimLeaseUntil time.Time
	imageRepo.ClaimFn = func(ctx context.Context, id value_object.ID, leaseUntil time.Time) (entity.JourneyImage, bool, error) {
		claimLeaseUntil = leaseUntil
		return imageRepo.JourneyImageRepositoryMemory.Claim(ctx, id, leaseUntil)
	}
	const leaseDuration = 3 * time.Second
	useCase := mustNewUseCase(t,
		imageRepo,
		fakes.NewJourneyRequestRepositoryWith(t, request),
		&generateImageGeneratorStub{},
		&generateImageStorageStub{asset: testkit.MustNewAssetReference(t)},
		Config{
			GenerationTimeout: time.Second,
			LeaseDuration:     leaseDuration,
			Now:               func() time.Time { return now },
		},
	)

	if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if got, want := claimLeaseUntil, now.Add(leaseDuration); !got.Equal(want) {
		t.Errorf("Claim() lease = %s, want %s", got, want)
	}
}

func TestNewUseCaseRejectsInvalidConfig(t *testing.T) {
	cases := []struct {
		name   string
		config Config
	}{
		{name: "異常系: タイムアウトが 0", config: Config{LeaseDuration: time.Second}},
		{name: "境界値系: lease がタイムアウトと同じ", config: Config{GenerationTimeout: time.Second, LeaseDuration: time.Second}},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := NewUseCase(
				fakes.NewJourneyImageRepository(),
				fakes.NewJourneyRequestRepository(),
				&generateImageGeneratorStub{},
				&generateImageStorageStub{},
				testCase.config,
			)
			if !errors.Is(err, ErrInvalidConfig) {
				t.Fatalf("NewUseCase() error = %v, want ErrInvalidConfig", err)
			}
		})
	}
}

func mustNewUseCase(
	t *testing.T,
	imageRepo repository.JourneyImageRepository,
	requestRepo repository.JourneyRequestRepository,
	generator domainservice.ImageGenerator,
	storage domainservice.ImageStorage,
	config Config,
) UseCase {
	t.Helper()
	useCase, err := NewUseCase(imageRepo, requestRepo, generator, storage, config)
	if err != nil {
		t.Fatalf("NewUseCase() error = %v", err)
	}
	return useCase
}

func TestUseCaseExecuteClassifiesGeneratorFailure(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)
	image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
	imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
	generator := &generateImageGeneratorStub{err: domainservice.ErrImageGeneratorUnavailable}
	useCase := mustNewUseCase(t,
		imageRepo,
		fakes.NewJourneyRequestRepositoryWith(t, request),
		generator,
		&generateImageStorageStub{},
		testConfig(),
	)

	err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
	if !errors.Is(err, domainservice.ErrImageGeneratorUnavailable) {
		t.Errorf("Execute() error = %v, want generator error", err)
	}
	saved := mustFindImage(t, imageRepo, image.ID())
	if saved.Status() != value_object.ImageStatusFailed {
		t.Fatalf("saved image status = %q, want failed", saved.Status())
	}
	failureCode, ok := saved.FailureCode()
	if !ok || failureCode != value_object.ImageFailureCodeProviderUnavailable {
		t.Errorf("saved failure code = %q, want provider_unavailable", failureCode)
	}
}

func TestUseCaseExecuteClassifiesRequestStorageAndCompleteFailures(t *testing.T) {
	tests := []struct {
		name       string
		requestErr error
		storageErr error
		asset      value_object.ImageAssetReference
		wantCode   value_object.ImageFailureCode
		wantDelete bool
	}{
		{
			name:       "request not found",
			requestErr: repository.ErrJourneyRequestNotFound,
			wantCode:   value_object.ImageFailureCodeInternalError,
		},
		{
			name:       "storage failure",
			storageErr: errors.New("disk full"),
			wantCode:   value_object.ImageFailureCodeStorageFailed,
		},
		{
			name:       "complete failure",
			asset:      value_object.ImageAssetReference{},
			wantCode:   value_object.ImageFailureCodeInternalError,
			wantDelete: true,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			request := testkit.MustNewJourneyRequest(t)
			image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
			imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
			requestRepo := fakes.NewJourneyRequestRepositoryWith(t, request)
			if testCase.requestErr != nil {
				requestRepo.FindByIDFn = func(context.Context, value_object.ID) (entity.JourneyRequest, error) {
					return entity.JourneyRequest{}, testCase.requestErr
				}
			}
			storage := &generateImageStorageStub{
				asset:   testCase.asset,
				saveErr: testCase.storageErr,
			}
			if testCase.asset == (value_object.ImageAssetReference{}) && testCase.storageErr == nil {
				storage.asset = value_object.ImageAssetReference{}
			} else if testCase.asset == (value_object.ImageAssetReference{}) {
				storage.asset = testkit.MustNewAssetReference(t)
			}
			useCase := mustNewUseCase(t,
				imageRepo,
				requestRepo,
				&generateImageGeneratorStub{},
				storage,
				testConfig(),
			)

			if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err == nil {
				t.Fatal("Execute() error = nil, want error")
			}
			failureCode, ok := mustFindImage(t, imageRepo, image.ID()).FailureCode()
			if !ok || failureCode != testCase.wantCode {
				t.Errorf("saved failure code = %q, want %q", failureCode, testCase.wantCode)
			}
			if storage.deleteCalled != testCase.wantDelete {
				t.Errorf("Delete() called = %v, want %v", storage.deleteCalled, testCase.wantDelete)
			}
		})
	}
}

func TestUseCaseExecuteTimeoutAndCompensatesSaveFailure(t *testing.T) {
	t.Run("timeout", func(t *testing.T) {
		request := testkit.MustNewJourneyRequest(t)
		image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
		imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
		generator := &generateImageGeneratorStub{waitForContext: true}
		useCase := mustNewUseCase(t,
			imageRepo,
			fakes.NewJourneyRequestRepositoryWith(t, request),
			generator,
			&generateImageStorageStub{},
			Config{GenerationTimeout: time.Millisecond, LeaseDuration: time.Second},
		)

		err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Errorf("Execute() error = %v, want context deadline exceeded", err)
		}
		failureCode, ok := mustFindImage(t, imageRepo, image.ID()).FailureCode()
		if !ok || failureCode != value_object.ImageFailureCodeProviderTimeout {
			t.Errorf("saved failure code = %q, want provider_timeout", failureCode)
		}
	})

	t.Run("repository failure deletes stored image", func(t *testing.T) {
		request := testkit.MustNewJourneyRequest(t)
		image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
		imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
		failFirstSave(imageRepo, errors.New("ready save failed"))
		storage := &generateImageStorageStub{asset: testkit.MustNewAssetReference(t)}
		useCase := mustNewUseCase(t,
			imageRepo,
			fakes.NewJourneyRequestRepositoryWith(t, request),
			&generateImageGeneratorStub{},
			storage,
			testConfig(),
		)

		err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
		if err == nil {
			t.Fatal("Execute() error = nil, want repository error")
		}
		if !storage.deleteCalled {
			t.Error("ImageStorage.Delete() was not called for compensation")
		}
		if saved := mustFindImage(t, imageRepo, image.ID()); saved.Status() != value_object.ImageStatusFailed {
			t.Errorf("saved image status = %q, want failed", saved.Status())
		}
	})
}

func TestUseCaseExecuteIncludesImageIDWhenCompensationDeleteFails(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)
	image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))
	asset := testkit.MustNewAssetReference(t)
	deleteErr := errors.New("delete failed")
	imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
	failFirstSave(imageRepo, errors.New("ready save failed"))
	storage := &generateImageStorageStub{
		asset:     asset,
		deleteErr: deleteErr,
	}
	useCase := mustNewUseCase(t,
		imageRepo,
		fakes.NewJourneyRequestRepositoryWith(t, request),
		&generateImageGeneratorStub{},
		storage,
		testConfig(),
	)

	err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
	if err == nil {
		t.Fatal("Execute() error = nil, want compensation error")
	}
	if !errors.Is(err, deleteErr) {
		t.Errorf("Execute() error = %v, want delete error", err)
	}
	if !strings.Contains(err.Error(), image.ID().String()) {
		t.Errorf("Execute() error = %v, want image ID %q", err, image.ID().String())
	}
	if !strings.Contains(err.Error(), asset.StorageKey()) {
		t.Errorf("Execute() error = %v, want storage key %q", err, asset.StorageKey())
	}
}

func TestUseCaseExecuteRejectsInvalidInputAndSkipsUnclaimedImage(t *testing.T) {
	request := testkit.MustNewJourneyRequest(t)
	image := testkit.MustNewPendingImageFor(t, request.ID(), testkit.MustNewImageSlot(t, value_object.ImagePurposeCover, 1))

	t.Run("invalid ID", func(t *testing.T) {
		useCase := mustNewUseCase(t,
			fakes.NewJourneyImageRepository(),
			fakes.NewJourneyRequestRepository(),
			&generateImageGeneratorStub{},
			&generateImageStorageStub{},
			testConfig(),
		)
		err := useCase.Execute(context.Background(), Input{ImageID: "not-a-uuid"})
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Errorf("Execute() error = %v, want ErrInvalidInput", err)
		}
	})

	t.Run("claim lost", func(t *testing.T) {
		imageRepo := fakes.NewJourneyImageRepositoryWith(t, image)
		imageRepo.ClaimFn = func(context.Context, value_object.ID, time.Time) (entity.JourneyImage, bool, error) {
			return image, false, nil
		}
		generator := &generateImageGeneratorStub{}
		useCase := mustNewUseCase(t,
			imageRepo,
			fakes.NewJourneyRequestRepositoryWith(t, request),
			generator,
			&generateImageStorageStub{},
			testConfig(),
		)
		if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err != nil {
			t.Fatalf("Execute() error = %v", err)
		}
		if generator.called {
			t.Error("ImageGenerator.Generate() was called after claim was lost")
		}
	})
}

type generateImageGeneratorStub struct {
	err            error
	waitForContext bool
	called         bool
	brief          domainservice.ImageBrief
}

func (g *generateImageGeneratorStub) Generate(ctx context.Context, brief domainservice.ImageBrief) (domainservice.GeneratedImage, error) {
	g.called = true
	g.brief = brief
	if g.waitForContext {
		<-ctx.Done()
		return domainservice.GeneratedImage{}, ctx.Err()
	}
	if g.err != nil {
		return domainservice.GeneratedImage{}, g.err
	}
	return domainservice.GeneratedImage{Content: []byte("image")}, nil
}

type generateImageStorageStub struct {
	asset        value_object.ImageAssetReference
	saveErr      error
	deleteErr    error
	saveCalled   bool
	deleteCalled bool
}

func (s *generateImageStorageStub) Save(
	_ context.Context,
	_ value_object.ID,
	_ domainservice.GeneratedImage,
) (value_object.ImageAssetReference, error) {
	s.saveCalled = true
	if s.saveErr != nil {
		return value_object.ImageAssetReference{}, s.saveErr
	}
	return s.asset, nil
}

func (s *generateImageStorageStub) Open(_ context.Context, _ value_object.ImageAssetReference) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("")), nil
}

func (s *generateImageStorageStub) Delete(_ context.Context, _ value_object.ImageAssetReference) error {
	s.deleteCalled = true
	return s.deleteErr
}

// failFirstSave は最初の Save（ready 保存）だけ err で失敗させ、以降はインメモリ実装に委譲する。
// 補償処理で保存される failed 画像は読み戻せる。
func failFirstSave(repo *fakes.FakeJourneyImageRepository, err error) {
	saveCalls := 0
	repo.SaveFn = func(ctx context.Context, image entity.JourneyImage) error {
		saveCalls++
		if saveCalls == 1 {
			return err
		}
		return repo.JourneyImageRepositoryMemory.Save(ctx, image)
	}
}

// mustFindImage は差し替えを経由せずインメモリ実装から画像を読み戻す。
func mustFindImage(t *testing.T, repo *fakes.FakeJourneyImageRepository, id value_object.ID) entity.JourneyImage {
	t.Helper()
	image, err := repo.JourneyImageRepositoryMemory.FindByID(context.Background(), id)
	if err != nil {
		t.Fatalf("FindByID() error = %v", err)
	}
	return image
}

// testConfig はテスト用の妥当な実行設定を返す。
func testConfig() Config {
	return Config{GenerationTimeout: time.Second, LeaseDuration: 2 * time.Second}
}

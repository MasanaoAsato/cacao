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
)

func TestUseCaseExecuteCompletesClaimedImage(t *testing.T) {
	request := newTestJourneyRequest(t)
	image := newTestJourneyImage(t, request.ID())
	imageRepo := &generateImageRepositoryStub{image: image}
	requestRepo := &generateRequestRepositoryStub{request: request}
	generator := &generateImageGeneratorStub{}
	storage := &generateImageStorageStub{asset: newTestAssetReference(t)}
	useCase := NewUseCase(
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
	wantStyle, err := selectCoverStyle(image.ID())
	if err != nil {
		t.Fatalf("selectCoverStyle() error = %v", err)
	}
	if generator.brief.Style() != wantStyle {
		t.Errorf("generated brief style = %q, want %q", generator.brief.Style(), wantStyle)
	}
	if imageRepo.saved.Status() != value_object.ImageStatusReady {
		t.Errorf("saved image status = %q, want ready", imageRepo.saved.Status())
	}
	if !storage.saveCalled {
		t.Error("ImageStorage.Save() was not called")
	}
}

func TestUseCaseExecuteKeepsIllustrationStyleNone(t *testing.T) {
	request := newTestJourneyRequest(t)
	slot, err := value_object.NewImageSlot(value_object.ImagePurposeIllustration, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), request.ID(), slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}
	generator := &generateImageGeneratorStub{}
	useCase := NewUseCase(
		&generateImageRepositoryStub{image: image},
		&generateRequestRepositoryStub{request: request},
		generator,
		&generateImageStorageStub{asset: newTestAssetReference(t)},
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

func TestUseCaseExecuteWithTimeoutUsesProvidedLeaseDuration(t *testing.T) {
	request := newTestJourneyRequest(t)
	image := newTestJourneyImage(t, request.ID())
	now := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	imageRepo := &generateImageRepositoryStub{image: image}
	useCase := NewUseCase(
		imageRepo,
		&generateRequestRepositoryStub{request: request},
		&generateImageGeneratorStub{},
		&generateImageStorageStub{asset: newTestAssetReference(t)},
		Config{
			GenerationTimeout: time.Second,
			LeaseDuration:     2 * time.Second,
			Now:               func() time.Time { return now },
		},
	)
	leaseAware, ok := useCase.(LeaseAwareUseCase)
	if !ok {
		t.Fatal("NewUseCase() does not implement LeaseAwareUseCase")
	}

	const leaseDuration = 3 * time.Second
	err := leaseAware.ExecuteWithTimeoutAndLease(
		context.Background(),
		Input{ImageID: image.ID().String()},
		time.Second,
		leaseDuration,
	)
	if err != nil {
		t.Fatalf("ExecuteWithTimeout() error = %v", err)
	}
	if got, want := imageRepo.claimLeaseUntil, now.Add(leaseDuration); !got.Equal(want) {
		t.Errorf("Claim() lease = %s, want %s", got, want)
	}
}

func TestUseCaseExecuteClassifiesGeneratorFailure(t *testing.T) {
	request := newTestJourneyRequest(t)
	image := newTestJourneyImage(t, request.ID())
	imageRepo := &generateImageRepositoryStub{image: image}
	generator := &generateImageGeneratorStub{err: domainservice.ErrImageGeneratorUnavailable}
	useCase := NewUseCase(
		imageRepo,
		&generateRequestRepositoryStub{request: request},
		generator,
		&generateImageStorageStub{},
	)

	err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
	if !errors.Is(err, domainservice.ErrImageGeneratorUnavailable) {
		t.Errorf("Execute() error = %v, want generator error", err)
	}
	if imageRepo.saved.Status() != value_object.ImageStatusFailed {
		t.Fatalf("saved image status = %q, want failed", imageRepo.saved.Status())
	}
	failureCode, ok := imageRepo.saved.FailureCode()
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
			request := newTestJourneyRequest(t)
			image := newTestJourneyImage(t, request.ID())
			imageRepo := &generateImageRepositoryStub{image: image}
			requestRepo := &generateRequestRepositoryStub{request: request, err: testCase.requestErr}
			storage := &generateImageStorageStub{
				asset:   testCase.asset,
				saveErr: testCase.storageErr,
			}
			if testCase.asset == (value_object.ImageAssetReference{}) && testCase.storageErr == nil {
				storage.asset = value_object.ImageAssetReference{}
			} else if testCase.asset == (value_object.ImageAssetReference{}) {
				storage.asset = newTestAssetReference(t)
			}
			useCase := NewUseCase(
				imageRepo,
				requestRepo,
				&generateImageGeneratorStub{},
				storage,
			)

			if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err == nil {
				t.Fatal("Execute() error = nil, want error")
			}
			failureCode, ok := imageRepo.saved.FailureCode()
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
		request := newTestJourneyRequest(t)
		image := newTestJourneyImage(t, request.ID())
		imageRepo := &generateImageRepositoryStub{image: image}
		generator := &generateImageGeneratorStub{waitForContext: true}
		useCase := NewUseCase(
			imageRepo,
			&generateRequestRepositoryStub{request: request},
			generator,
			&generateImageStorageStub{},
			Config{GenerationTimeout: time.Millisecond, LeaseDuration: time.Second},
		)

		err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Errorf("Execute() error = %v, want context deadline exceeded", err)
		}
		failureCode, ok := imageRepo.saved.FailureCode()
		if !ok || failureCode != value_object.ImageFailureCodeProviderTimeout {
			t.Errorf("saved failure code = %q, want provider_timeout", failureCode)
		}
	})

	t.Run("repository failure deletes stored image", func(t *testing.T) {
		request := newTestJourneyRequest(t)
		image := newTestJourneyImage(t, request.ID())
		imageRepo := &generateImageRepositoryStub{
			image:      image,
			saveErrors: map[int]error{1: errors.New("ready save failed")},
		}
		storage := &generateImageStorageStub{asset: newTestAssetReference(t)}
		useCase := NewUseCase(
			imageRepo,
			&generateRequestRepositoryStub{request: request},
			&generateImageGeneratorStub{},
			storage,
		)

		err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()})
		if err == nil {
			t.Fatal("Execute() error = nil, want repository error")
		}
		if !storage.deleteCalled {
			t.Error("ImageStorage.Delete() was not called for compensation")
		}
		if imageRepo.saved.Status() != value_object.ImageStatusFailed {
			t.Errorf("saved image status = %q, want failed", imageRepo.saved.Status())
		}
	})
}

func TestUseCaseExecuteIncludesImageIDWhenCompensationDeleteFails(t *testing.T) {
	request := newTestJourneyRequest(t)
	image := newTestJourneyImage(t, request.ID())
	asset := newTestAssetReference(t)
	deleteErr := errors.New("delete failed")
	imageRepo := &generateImageRepositoryStub{
		image:      image,
		saveErrors: map[int]error{1: errors.New("ready save failed")},
	}
	storage := &generateImageStorageStub{
		asset:     asset,
		deleteErr: deleteErr,
	}
	useCase := NewUseCase(
		imageRepo,
		&generateRequestRepositoryStub{request: request},
		&generateImageGeneratorStub{},
		storage,
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
	request := newTestJourneyRequest(t)
	image := newTestJourneyImage(t, request.ID())

	t.Run("invalid ID", func(t *testing.T) {
		useCase := NewUseCase(
			&generateImageRepositoryStub{},
			&generateRequestRepositoryStub{},
			&generateImageGeneratorStub{},
			&generateImageStorageStub{},
		)
		err := useCase.Execute(context.Background(), Input{ImageID: "not-a-uuid"})
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Errorf("Execute() error = %v, want ErrInvalidInput", err)
		}
	})

	t.Run("claim lost", func(t *testing.T) {
		imageRepo := &generateImageRepositoryStub{image: image, claim: false, claimSet: true}
		generator := &generateImageGeneratorStub{}
		useCase := NewUseCase(
			imageRepo,
			&generateRequestRepositoryStub{request: request},
			generator,
			&generateImageStorageStub{},
		)
		if err := useCase.Execute(context.Background(), Input{ImageID: image.ID().String()}); err != nil {
			t.Fatalf("Execute() error = %v", err)
		}
		if generator.called {
			t.Error("ImageGenerator.Generate() was called after claim was lost")
		}
	})
}

type generateImageRepositoryStub struct {
	image           entity.JourneyImage
	saved           entity.JourneyImage
	claim           bool
	claimSet        bool
	claimErr        error
	claimLeaseUntil time.Time
	saveErrors      map[int]error
	saveCalls       int
}

func (r *generateImageRepositoryStub) Save(_ context.Context, image entity.JourneyImage) error {
	r.saveCalls++
	r.saved = image
	if err := r.saveErrors[r.saveCalls]; err != nil {
		return err
	}
	return nil
}

func (r *generateImageRepositoryStub) FindByID(_ context.Context, id value_object.ID) (entity.JourneyImage, error) {
	if r.image.ID().Equals(id) {
		return r.image, nil
	}
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (r *generateImageRepositoryStub) FindByRequestID(_ context.Context, _ value_object.ID) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (r *generateImageRepositoryStub) FindBySlot(_ context.Context, _ value_object.ID, _ value_object.ImageSlot) (entity.JourneyImage, error) {
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

func (r *generateImageRepositoryStub) FindPending(_ context.Context, _ int) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (r *generateImageRepositoryStub) FindExpiredProcessing(_ context.Context, _ time.Time, _ int) ([]entity.JourneyImage, error) {
	return []entity.JourneyImage{}, nil
}

func (r *generateImageRepositoryStub) Claim(
	_ context.Context,
	id value_object.ID,
	leaseUntil time.Time,
) (entity.JourneyImage, bool, error) {
	r.claimLeaseUntil = leaseUntil
	if r.claimErr != nil {
		return entity.JourneyImage{}, false, r.claimErr
	}
	if r.claimSet && !r.claim && r.image.ID().Equals(id) {
		return r.image, false, nil
	}
	if !r.image.ID().Equals(id) {
		return entity.JourneyImage{}, false, repository.ErrJourneyImageNotFound
	}
	claimed := r.image
	if err := claimed.Start(); err != nil {
		return entity.JourneyImage{}, false, err
	}
	r.image = claimed
	return claimed, true, nil
}

func (r *generateImageRepositoryStub) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

type generateRequestRepositoryStub struct {
	request entity.JourneyRequest
	err     error
}

func (r *generateRequestRepositoryStub) Save(_ context.Context, _ entity.JourneyRequest) error {
	return nil
}

func (r *generateRequestRepositoryStub) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyRequest, error) {
	if r.err != nil {
		return entity.JourneyRequest{}, r.err
	}
	return r.request, nil
}

func (r *generateRequestRepositoryStub) FindAll(_ context.Context) ([]entity.JourneyRequest, error) {
	return []entity.JourneyRequest{}, nil
}

func (r *generateRequestRepositoryStub) Delete(_ context.Context, _ value_object.ID) error {
	return nil
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

func newTestJourneyRequest(t *testing.T) entity.JourneyRequest {
	t.Helper()
	departure, err := value_object.NewDeparture("Tokyo", "Japan")
	if err != nil {
		t.Fatalf("NewDeparture() error = %v", err)
	}
	destination, err := value_object.NewDestination("Kyoto", "Japan")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	period, err := value_object.NewPeriod(
		time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.April, 2, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("NewCurrency() error = %v", err)
	}
	budget, err := value_object.NewMoney(50_000, currency)
	if err != nil {
		t.Fatalf("NewMoney() error = %v", err)
	}
	request, err := entity.NewJourneyRequest(
		value_object.NewID(),
		departure,
		destination,
		period,
		budget,
	)
	if err != nil {
		t.Fatalf("NewJourneyRequest() error = %v", err)
	}

	return request
}

func newTestJourneyImage(t *testing.T, requestID value_object.ID) entity.JourneyImage {
	t.Helper()
	slot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	image, err := entity.NewJourneyImage(value_object.NewID(), requestID, slot)
	if err != nil {
		t.Fatalf("NewJourneyImage() error = %v", err)
	}

	return image
}

func newTestAssetReference(t *testing.T) value_object.ImageAssetReference {
	t.Helper()
	asset, err := value_object.NewImageAssetReference("ab/image.png", "image/png", 2, 2)
	if err != nil {
		t.Fatalf("NewImageAssetReference() error = %v", err)
	}

	return asset
}

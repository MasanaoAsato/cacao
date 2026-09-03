package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"cacao/src/infrastructure/worker"
	"cacao/src/observability"

	"github.com/joho/godotenv"
)

const (
	serverAddress   = ":8080"
	shutdownTimeout = 30 * time.Second
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	slog.SetDefault(logger)

	if err := run(); err != nil {
		observability.LogFailure(
			context.Background(),
			logger,
			slog.LevelError,
			observability.FailureContext{Operation: "run_application"},
			err,
		)
		os.Exit(1)
	}
}

// run は設定の読み込みと依存関係の組み立て（wire.go）を行い、HTTP サーバーと worker を起動する。
func run() error {
	if err := loadDotEnv(); err != nil {
		return err
	}

	app, err := buildApplication(context.Background())
	if err != nil {
		return err
	}
	defer app.Close()

	server := &http.Server{
		Addr:              serverAddress,
		Handler:           app.Router,
		ReadHeaderTimeout: 10 * time.Second,
	}
	return serve(server, app.ImageWorker)
}

func loadDotEnv() error {
	return loadDotEnvFile(".env")
}

func loadDotEnvFile(path string) error {
	if err := godotenv.Load(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("load .env: %w", err)
	}

	return nil
}

// serve は HTTP サーバーと画像生成 worker を並行して起動し、
// サーバー終了または SIGINT / SIGTERM を受けたら両者を順に停止する。
func serve(server *http.Server, imageWorker *worker.JourneyImageWorker) error {
	if server == nil {
		return fmt.Errorf("HTTP server must not be nil")
	}
	if imageWorker == nil {
		return fmt.Errorf("journey image worker must not be nil")
	}

	workerContext, cancelWorker := context.WithCancel(context.Background())
	defer cancelWorker()
	stopPolling := make(chan struct{})
	workerResult := make(chan error, 1)
	go func() {
		workerResult <- imageWorker.Run(workerContext, stopPolling)
	}()

	serverResult := make(chan error, 1)
	go func() {
		serverResult <- server.ListenAndServe()
	}()

	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(signalChannel)

	select {
	case err := <-serverResult:
		return stopApplication(server, stopPolling, cancelWorker, workerResult, err)
	case <-signalChannel:
		return stopApplication(server, stopPolling, cancelWorker, workerResult, nil)
	}
}

func stopApplication(
	server *http.Server,
	stopPolling chan struct{},
	cancelWorker context.CancelFunc,
	workerResult <-chan error,
	serverErr error,
) error {
	close(stopPolling)

	shutdownContext, cancelShutdown := context.WithTimeout(context.Background(), shutdownTimeout)
	shutdownErr := server.Shutdown(shutdownContext)
	cancelShutdown()

	workerErr := waitForWorker(workerResult, cancelWorker)
	return errors.Join(
		normalizeServerError(serverErr),
		shutdownErr,
		workerErr,
	)
}

func waitForWorker(workerResult <-chan error, cancelWorker context.CancelFunc) error {
	return waitForWorkerWithTimeout(workerResult, cancelWorker, shutdownTimeout)
}

func waitForWorkerWithTimeout(
	workerResult <-chan error,
	cancelWorker context.CancelFunc,
	timeout time.Duration,
) error {
	select {
	case err := <-workerResult:
		return err
	case <-time.After(timeout):
		cancelWorker()
		workerErr := <-workerResult
		return errors.Join(
			fmt.Errorf("journey image worker shutdown timed out"),
			workerErr,
		)
	}
}

func normalizeServerError(err error) error {
	if err == nil || errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return fmt.Errorf("HTTP server: %w", err)
}

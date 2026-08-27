package database

import (
	"context"
	"fmt"
	"time"

	"github.com/caarlos0/env/v10"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"gorm.io/driver/postgres"
)

type Config struct {
	URL          string `env:"POSTGRESQL_URL"`
	Host         string `env:"POSTGRES_HOST"          envDefault:"localhost"`
	Port         string `env:"POSTGRES_PORT"          envDefault:"5432"`
	User         string `env:"POSTGRES_USER"          envDefault:"admin"`
	Password     string `env:"POSTGRES_PASSWORD"      envDefault:"Wt9wCKTIqjgv17ED"`
	DBName       string `env:"POSTGRES_DB"            envDefault:"cacao"`
	SSLMODE      string `env:"POSTGRES_SSLMODE"       envDefault:"disable"`
	MaxOpenConns int    `env:"POSTGRES_MAX_OPEN_CONNS" envDefault:"25"`
	MaxIdleConns int    `env:"POSTGRES_MAX_IDLE_CONNS" envDefault:"5"`
}

func ConfigFromEnv() (Config, error) {
	var cfg Config

	if err := env.Parse(&cfg); err != nil {
		return Config{}, fmt.Errorf("failed to parse database config from env: %w", err)
	}

	return cfg, nil
}

func CreateGORMClient(ctx context.Context, cfg Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.dsn()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}

	postgresDB, _ := db.DB()
	postgresDB.SetMaxOpenConns(cfg.MaxOpenConns)
	postgresDB.SetMaxIdleConns(cfg.MaxIdleConns)
	postgresDB.SetConnMaxLifetime(time.Hour)

	// 接続確認（ping）
	if err := postgresDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("postgres ping: %w", err)
	}

	return db, nil
}

func (c Config) dsn() string {
	if c.URL != "" {
		return c.URL
	}

	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMODE,
	)
}

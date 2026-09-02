package database

import (
	"cacao/src/infrastructure/config"
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"gorm.io/driver/postgres"
)

// CreateGORMClient は設定から GORM クライアントを生成し、接続確認まで行う。
func CreateGORMClient(ctx context.Context, cfg config.Database) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
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

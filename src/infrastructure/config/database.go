// Package config は環境変数から読み込む運用設定をまとめる。
// 各設定は「env タグ付きの公開構造体 + FromEnv + Validate」の同じ形で定義し、
// 既定値・許容範囲・ドライバ名はこのパッケージだけが持つ。
package config

import (
	"errors"
	"fmt"
	"strings"

	"github.com/caarlos0/env/v10"
)

// Database は PostgreSQL 接続設定。URL が設定されていれば個別項目より優先する。
// パスワード以外の既定値は compose.yml のローカル開発値に合わせている。
type Database struct {
	URL          string `env:"POSTGRESQL_URL"`
	Host         string `env:"POSTGRES_HOST" envDefault:"localhost"`
	Port         string `env:"POSTGRES_PORT" envDefault:"5432"`
	User         string `env:"POSTGRES_USER" envDefault:"admin"`
	Password     string `env:"POSTGRES_PASSWORD"`
	DBName       string `env:"POSTGRES_DB" envDefault:"cacao"`
	SSLMode      string `env:"POSTGRES_SSLMODE" envDefault:"disable"`
	MaxOpenConns int    `env:"POSTGRES_MAX_OPEN_CONNS" envDefault:"25"`
	MaxIdleConns int    `env:"POSTGRES_MAX_IDLE_CONNS" envDefault:"5"`
}

// DatabaseFromEnv は環境変数から DB 設定を読み込み、必須値を検証する。
func DatabaseFromEnv() (Database, error) {
	var config Database
	if err := env.Parse(&config); err != nil {
		return Database{}, fmt.Errorf("parse database config: %w", err)
	}
	config.URL = strings.TrimSpace(config.URL)
	if err := config.Validate(); err != nil {
		return Database{}, fmt.Errorf("invalid database config: %w", err)
	}
	return config, nil
}

// Validate は URL、または個別接続設定用のパスワードが設定されていることを検証する。
func (c Database) Validate() error {
	if c.URL != "" {
		return nil
	}
	if strings.TrimSpace(c.Password) == "" {
		return errors.New("database password (POSTGRES_PASSWORD) must be set when POSTGRESQL_URL is empty")
	}
	return nil
}

// DSN は接続文字列を返す。URL があればそれを、なければ個別項目から組み立てる。
func (c Database) DSN() string {
	if c.URL != "" {
		return c.URL
	}

	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}

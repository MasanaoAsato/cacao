// Package config は環境変数から読み込む運用設定をまとめる。
// 各設定は「env タグ付きの公開構造体 + FromEnv + Validate」の同じ形で定義し、
// 既定値・許容範囲・ドライバ名はこのパッケージだけが持つ。
package config

import (
	"fmt"

	"github.com/caarlos0/env/v10"
)

// Database は PostgreSQL 接続設定。URL が設定されていれば個別項目より優先する。
// 未設定時の既定値は compose.yml のローカル開発値に合わせている。
type Database struct {
	URL          string `env:"POSTGRESQL_URL"`
	Host         string `env:"POSTGRES_HOST" envDefault:"localhost"`
	Port         string `env:"POSTGRES_PORT" envDefault:"5432"`
	User         string `env:"POSTGRES_USER" envDefault:"admin"`
	Password     string `env:"POSTGRES_PASSWORD" envDefault:"Wt9wCKTIqjgv17ED"`
	DBName       string `env:"POSTGRES_DB" envDefault:"cacao"`
	SSLMode      string `env:"POSTGRES_SSLMODE" envDefault:"disable"`
	MaxOpenConns int    `env:"POSTGRES_MAX_OPEN_CONNS" envDefault:"25"`
	MaxIdleConns int    `env:"POSTGRES_MAX_IDLE_CONNS" envDefault:"5"`
}

// DatabaseFromEnv は環境変数から DB 設定を読み込む。
func DatabaseFromEnv() (Database, error) {
	var config Database
	if err := env.Parse(&config); err != nil {
		return Database{}, fmt.Errorf("parse database config: %w", err)
	}
	return config, nil
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

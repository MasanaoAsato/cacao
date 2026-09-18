package config

import (
	"strings"
	"testing"
)

func TestDatabaseDSN(t *testing.T) {
	tests := []struct {
		name   string
		config Database
		want   string
	}{
		{
			name: "POSTGRESQL_URLを優先する",
			config: Database{
				URL:  "postgresql://user:password@example.com:5432/cacao?sslmode=require",
				Host: "ignored",
			},
			want: "postgresql://user:password@example.com:5432/cacao?sslmode=require",
		},
		{
			name: "POSTGRESQL_URLが空なら個別設定を使う",
			config: Database{
				Host:     "db.example.com",
				Port:     "5433",
				User:     "cacao",
				Password: "secret",
				DBName:   "journeys",
				SSLMode:  "require",
			},
			want: "host=db.example.com port=5433 user=cacao password=secret dbname=journeys sslmode=require",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			if got := testCase.config.DSN(); got != testCase.want {
				t.Errorf("DSN() = %q, want %q", got, testCase.want)
			}
		})
	}
}

func TestDatabaseFromEnvReadsPostgreSQLURL(t *testing.T) {
	const connectionURL = "postgresql://user:password@example.com:5432/cacao?sslmode=require"
	t.Setenv("POSTGRESQL_URL", connectionURL)
	t.Setenv("POSTGRES_PASSWORD", "")

	config, err := DatabaseFromEnv()
	if err != nil {
		t.Fatalf("DatabaseFromEnv() error = %v", err)
	}
	if config.URL != connectionURL {
		t.Errorf("DatabaseFromEnv().URL = %q, want %q", config.URL, connectionURL)
	}
}

func TestDatabaseFromEnvReadsPassword(t *testing.T) {
	const password = "local-development-password"
	t.Setenv("POSTGRESQL_URL", "")
	t.Setenv("POSTGRES_PASSWORD", password)

	config, err := DatabaseFromEnv()
	if err != nil {
		t.Fatalf("DatabaseFromEnv() error = %v", err)
	}
	if config.Password != password {
		t.Errorf("DatabaseFromEnv().Password = %q, want %q", config.Password, password)
	}
}

func TestDatabaseFromEnvRejectsMissingPassword(t *testing.T) {
	t.Setenv("POSTGRESQL_URL", " ")
	t.Setenv("POSTGRES_PASSWORD", " ")

	_, err := DatabaseFromEnv()
	if err == nil {
		t.Fatal("DatabaseFromEnv() error = nil, want missing password error")
	}
	if !strings.Contains(err.Error(), "POSTGRES_PASSWORD) must be set") {
		t.Errorf("DatabaseFromEnv() error = %q, want POSTGRES_PASSWORD message", err)
	}
}

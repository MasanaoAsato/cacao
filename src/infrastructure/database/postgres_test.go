package database

import "testing"

func TestConfigDSN(t *testing.T) {
	tests := []struct {
		name   string
		config Config
		want   string
	}{
		{
			name: "POSTGRESQL_URLを優先する",
			config: Config{
				URL:  "postgresql://user:password@example.com:5432/cacao?sslmode=require",
				Host: "ignored",
			},
			want: "postgresql://user:password@example.com:5432/cacao?sslmode=require",
		},
		{
			name: "POSTGRESQL_URLが空なら個別設定を使う",
			config: Config{
				Host:     "db.example.com",
				Port:     "5433",
				User:     "cacao",
				Password: "secret",
				DBName:   "journeys",
				SSLMODE:  "require",
			},
			want: "host=db.example.com port=5433 user=cacao password=secret dbname=journeys sslmode=require",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			if got := testCase.config.dsn(); got != testCase.want {
				t.Errorf("dsn() = %q, want %q", got, testCase.want)
			}
		})
	}
}

func TestConfigFromEnvReadsPostgreSQLURL(t *testing.T) {
	const connectionURL = "postgresql://user:password@example.com:5432/cacao?sslmode=require"
	t.Setenv("POSTGRESQL_URL", connectionURL)

	config, err := ConfigFromEnv()
	if err != nil {
		t.Fatalf("ConfigFromEnv() error = %v", err)
	}
	if config.URL != connectionURL {
		t.Errorf("ConfigFromEnv().URL = %q, want %q", config.URL, connectionURL)
	}
}

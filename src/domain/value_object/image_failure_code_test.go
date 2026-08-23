package value_object

import "testing"

func TestNewImageFailureCode(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected ImageFailureCode
		wantErr  bool
	}{
		{
			name:     "正常系 : provider_unavailable",
			input:    "provider_unavailable",
			expected: ImageFailureCodeProviderUnavailable,
		},
		{
			name:     "正常系 : provider_timeout",
			input:    "provider_timeout",
			expected: ImageFailureCodeProviderTimeout,
		},
		{
			name:     "正常系 : generation_rejected",
			input:    "generation_rejected",
			expected: ImageFailureCodeGenerationRejected,
		},
		{
			name:     "正常系 : output_invalid",
			input:    "output_invalid",
			expected: ImageFailureCodeOutputInvalid,
		},
		{
			name:     "正常系 : storage_failed",
			input:    "storage_failed",
			expected: ImageFailureCodeStorageFailed,
		},
		{
			name:     "正常系 : internal_error",
			input:    "internal_error",
			expected: ImageFailureCodeInternalError,
		},
		{
			name:    "異常系 : 未知の失敗コード",
			input:   "unknown",
			wantErr: true,
		},
		{
			name:    "境界値系 : 空文字の失敗コード",
			input:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, err := NewImageFailureCode(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("NewImageFailureCode(%q) error = nil, want error", tt.input)
				}
				return
			}

			if err != nil {
				t.Fatalf("NewImageFailureCode(%q) error = %v", tt.input, err)
			}
			if code != tt.expected {
				t.Errorf("NewImageFailureCode(%q) = %q, want %q", tt.input, code, tt.expected)
			}
			if code.String() != tt.input {
				t.Errorf("String() = %q, want %q", code.String(), tt.input)
			}
			if err := code.Validate(); err != nil {
				t.Errorf("Validate() error = %v", err)
			}
		})
	}
}

func TestImageFailureCodeValidate(t *testing.T) {
	tests := []struct {
		name    string
		code    ImageFailureCode
		wantErr bool
	}{
		{
			name: "正常系 : provider_unavailableの検証",
			code: ImageFailureCodeProviderUnavailable,
		},
		{
			name: "正常系 : provider_timeoutの検証",
			code: ImageFailureCodeProviderTimeout,
		},
		{
			name: "正常系 : generation_rejectedの検証",
			code: ImageFailureCodeGenerationRejected,
		},
		{
			name: "正常系 : output_invalidの検証",
			code: ImageFailureCodeOutputInvalid,
		},
		{
			name: "正常系 : storage_failedの検証",
			code: ImageFailureCodeStorageFailed,
		},
		{
			name: "正常系 : internal_errorの検証",
			code: ImageFailureCodeInternalError,
		},
		{
			name:    "境界値系 : ゼロ値の失敗コード",
			code:    ImageFailureCode(""),
			wantErr: true,
		},
		{
			name:    "異常系 : 未知の失敗コード",
			code:    ImageFailureCode("unknown"),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.code.Validate()
			if tt.wantErr {
				if err == nil {
					t.Fatalf("Validate() error = nil, want error")
				}
				return
			}

			if err != nil {
				t.Errorf("Validate() error = %v", err)
			}
		})
	}
}

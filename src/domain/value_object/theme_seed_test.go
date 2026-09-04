package value_object

import "testing"

func TestNewThemeSeed(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		want      string
		wantError bool
	}{
		{
			name:  "正常系: 小文字のトークンを受け付ける",
			input: "v1-0123abcd",
			want:  "v1-0123abcd",
		},
		{
			name:  "正常系: 大文字を小文字へ正規化する",
			input: "V1-ABCDEF12",
			want:  "v1-abcdef12",
		},
		{
			name:      "異常系: バージョンが異なる",
			input:     "v2-0123abcd",
			wantError: true,
		},
		{
			name:      "境界値系: 16進数が7桁では受け付けない",
			input:     "v1-0123abc",
			wantError: true,
		},
		{
			name:  "境界値系: 16進数が8桁なら最大値を受け付ける",
			input: "v1-ffffffff",
			want:  "v1-ffffffff",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := NewThemeSeed(testCase.input)
			if (err != nil) != testCase.wantError {
				t.Fatalf("NewThemeSeed(%q) error = %v, wantError = %v", testCase.input, err, testCase.wantError)
			}
			if testCase.wantError {
				return
			}
			if got.String() != testCase.want {
				t.Errorf("NewThemeSeed(%q).String() = %q, want %q", testCase.input, got.String(), testCase.want)
			}
		})
	}
}

func TestThemeSeedZeroValueIsEmpty(t *testing.T) {
	var seed ThemeSeed

	if !seed.IsEmpty() {
		t.Error("zero value ThemeSeed.IsEmpty() = false, want true")
	}
}

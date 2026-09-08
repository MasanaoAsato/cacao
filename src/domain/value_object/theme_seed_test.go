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
			name:  "正常系: 最小値のトークンを受け付ける",
			input: "v2-00000000",
			want:  "v2-00000000",
		},
		{
			name:  "正常系: 大文字を小文字へ正規化する",
			input: "V2-ABCDEF12",
			want:  "v2-abcdef12",
		},
		{
			name:      "異常系: 廃止されたv1を拒否する",
			input:     "v1-0123abcd",
			wantError: true,
		},
		{
			name:      "異常系: 未対応のバージョンを拒否する",
			input:     "v3-0123abcd",
			wantError: true,
		},
		{
			name:      "境界値系: 16進数が7桁では受け付けない",
			input:     "v2-0123abc",
			wantError: true,
		},
		{
			name:      "境界値系: 16進数が9桁では受け付けない",
			input:     "v2-0123abcde",
			wantError: true,
		},
		{
			name:  "境界値系: 16進数が8桁なら最大値を受け付ける",
			input: "v2-ffffffff",
			want:  "v2-ffffffff",
		},
		{
			name:      "異常系: 16進数以外を拒否する",
			input:     "v2-0123abcg",
			wantError: true,
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

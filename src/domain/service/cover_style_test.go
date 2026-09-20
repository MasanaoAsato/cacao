package service

import (
	"testing"

	"cacao/src/domain/value_object"
)

func TestSelectCoverStyleFollowsV2Contract(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		id   string
		want value_object.ImageVisualStyle
	}{
		{
			name: "first fixed id",
			id:   "88888888-8888-4888-8888-888888888888",
			want: value_object.ImageVisualStyleRefinedTravelEditorial,
		},
		{
			name: "second fixed id",
			id:   "00000000-0000-4000-8000-000000000002",
			want: value_object.ImageVisualStyleRetroTravelPoster,
		},
		{
			name: "third fixed id",
			id:   "9574e429-0a69-40c4-a5f8-1262e433fbfc",
			want: value_object.ImageVisualStyleQuietNeighborhood,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			imageID, err := value_object.NewIDFromString(testCase.id)
			if err != nil {
				t.Fatalf("NewIDFromString() error = %v", err)
			}

			first, err := SelectCoverStyle(imageID)
			if err != nil {
				t.Fatalf("SelectCoverStyle() error = %v", err)
			}
			second, err := SelectCoverStyle(imageID)
			if err != nil {
				t.Fatalf("SelectCoverStyle() error = %v", err)
			}
			if first != testCase.want {
				t.Errorf("SelectCoverStyle() = %q, want %q", first, testCase.want)
			}
			if second != testCase.want {
				t.Errorf("SelectCoverStyle() on repeat = %q, want %q", second, testCase.want)
			}
		})
	}
}

func TestSelectCoverStyleRejectsEmptyID(t *testing.T) {
	t.Parallel()

	if _, err := SelectCoverStyle(value_object.ID{}); err == nil {
		t.Fatal("SelectCoverStyle() error = nil, want error")
	}
}

func TestCoverStyleForSelectionKeyCoversCatalogBoundaries(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		selectionKey uint64
		want         value_object.ImageVisualStyle
	}{
		{
			name:         "minimum unsigned integer selects first catalog style",
			selectionKey: 0,
			want:         value_object.ImageVisualStyleTransparentWatercolor,
		},
		{
			name:         "last catalog index selects last catalog style",
			selectionKey: 39,
			want:         value_object.ImageVisualStyleNaturalTravelPhoto,
		},
		{
			name:         "maximum unsigned integer remains in catalog",
			selectionKey: ^uint64(0),
			want:         value_object.ImageVisualStyleJapaneseRetroTravelAd,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			style, err := coverStyleForSelectionKey(testCase.selectionKey)
			if err != nil {
				t.Fatalf("coverStyleForSelectionKey(%d) error = %v", testCase.selectionKey, err)
			}
			if style != testCase.want {
				t.Errorf("coverStyleForSelectionKey(%d) = %q, want %q", testCase.selectionKey, style, testCase.want)
			}
		})
	}
}

func TestCoverStyleForSelectionKeyReachesEveryV2Style(t *testing.T) {
	t.Parallel()

	for index, want := range value_object.CoverImageVisualStyleCatalog() {
		style, err := coverStyleForSelectionKey(uint64(index))
		if err != nil {
			t.Fatalf("coverStyleForSelectionKey(%d) error = %v", index, err)
		}
		if style != want {
			t.Errorf("coverStyleForSelectionKey(%d) = %q, want %q", index, style, want)
		}
	}
}

func TestVisualStyleForSlot(t *testing.T) {
	t.Parallel()

	imageID, err := value_object.NewIDFromString("88888888-8888-4888-8888-888888888888")
	if err != nil {
		t.Fatalf("NewIDFromString() error = %v", err)
	}
	cover, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	illustration, err := value_object.NewImageSlot(value_object.ImagePurposeIllustration, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}

	t.Run("正常系: 表紙はカタログから選ばれる", func(t *testing.T) {
		style, err := VisualStyleForSlot(imageID, cover)
		if err != nil {
			t.Fatalf("VisualStyleForSlot() error = %v", err)
		}
		if !containsStyle(value_object.CoverImageVisualStyleCatalog(), style) {
			t.Errorf("style = %q, want a v2 catalog style", style)
		}
	})

	t.Run("正常系: 挿絵は none", func(t *testing.T) {
		style, err := VisualStyleForSlot(imageID, illustration)
		if err != nil {
			t.Fatalf("VisualStyleForSlot() error = %v", err)
		}
		if style != value_object.ImageVisualStyleNone {
			t.Errorf("style = %q, want none", style)
		}
	})

	t.Run("異常系: 表紙で空 ID はエラー", func(t *testing.T) {
		if _, err := VisualStyleForSlot(value_object.ID{}, cover); err == nil {
			t.Fatal("expected error for empty id")
		}
	})
}

func containsStyle(styles []value_object.ImageVisualStyle, want value_object.ImageVisualStyle) bool {
	for _, style := range styles {
		if style == want {
			return true
		}
	}

	return false
}

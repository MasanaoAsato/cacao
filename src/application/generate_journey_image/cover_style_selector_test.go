package generatejourneyimage

import (
	"testing"

	"cacao/src/domain/value_object"
)

func TestSelectCoverStyleFollowsV1Contract(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		id   string
		want value_object.ImageVisualStyle
	}{
		{
			name: "editorial photograph",
			id:   "88888888-8888-4888-8888-888888888888",
			want: value_object.ImageVisualStyleEditorialPhotograph,
		},
		{
			name: "cinematic photograph",
			id:   "00000000-0000-4000-8000-000000000002",
			want: value_object.ImageVisualStyleCinematicPhotograph,
		},
		{
			name: "watercolor",
			id:   "9574e429-0a69-40c4-a5f8-1262e433fbfc",
			want: value_object.ImageVisualStyleWatercolor,
		},
		{
			name: "gouache",
			id:   "22222222-2222-4222-8222-222222222222",
			want: value_object.ImageVisualStyleGouache,
		},
		{
			name: "oil painting",
			id:   "99999999-9999-4999-8999-999999999999",
			want: value_object.ImageVisualStyleOilPainting,
		},
		{
			name: "pastel",
			id:   "33333333-3333-4333-8333-333333333333",
			want: value_object.ImageVisualStylePastel,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			imageID, err := value_object.NewIDFromString(testCase.id)
			if err != nil {
				t.Fatalf("NewIDFromString() error = %v", err)
			}

			first, err := selectCoverStyle(imageID)
			if err != nil {
				t.Fatalf("selectCoverStyle() error = %v", err)
			}
			second, err := selectCoverStyle(imageID)
			if err != nil {
				t.Fatalf("selectCoverStyle() error = %v", err)
			}
			if first != testCase.want {
				t.Errorf("selectCoverStyle() = %q, want %q", first, testCase.want)
			}
			if second != testCase.want {
				t.Errorf("selectCoverStyle() on repeat = %q, want %q", second, testCase.want)
			}
		})
	}
}

func TestSelectCoverStyleRejectsEmptyID(t *testing.T) {
	t.Parallel()

	if _, err := selectCoverStyle(value_object.ID{}); err == nil {
		t.Fatal("selectCoverStyle() error = nil, want error")
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
			want:         value_object.ImageVisualStyleEditorialPhotograph,
		},
		{
			name:         "last catalog index selects last catalog style",
			selectionKey: 5,
			want:         value_object.ImageVisualStylePastel,
		},
		{
			name:         "maximum unsigned integer remains in catalog",
			selectionKey: ^uint64(0),
			want:         value_object.ImageVisualStyleGouache,
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

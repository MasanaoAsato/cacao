package value_object

import "testing"

func TestImageVisualStyleValidateFor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		style   ImageVisualStyle
		purpose ImagePurpose
		wantErr bool
	}{
		{
			name:    "cover accepts catalog style",
			style:   ImageVisualStyleEditorialPhotograph,
			purpose: ImagePurposeCover,
		},
		{
			name:    "illustration accepts none",
			style:   ImageVisualStyleNone,
			purpose: ImagePurposeIllustration,
		},
		{
			name:    "zero style is rejected",
			style:   "",
			purpose: ImagePurposeCover,
			wantErr: true,
		},
		{
			name:    "unknown style is rejected",
			style:   ImageVisualStyle("unknown"),
			purpose: ImagePurposeCover,
			wantErr: true,
		},
		{
			name:    "cover rejects none",
			style:   ImageVisualStyleNone,
			purpose: ImagePurposeCover,
			wantErr: true,
		},
		{
			name:    "illustration rejects cover style",
			style:   ImageVisualStyleWatercolor,
			purpose: ImagePurposeIllustration,
			wantErr: true,
		},
		{
			name:    "unknown purpose is rejected",
			style:   ImageVisualStyleNone,
			purpose: ImagePurpose("unknown"),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.style.ValidateFor(tt.purpose); (err != nil) != tt.wantErr {
				t.Fatalf("ValidateFor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCoverImageVisualStyleCatalogReturnsIndependentCopy(t *testing.T) {
	t.Parallel()

	first := CoverImageVisualStyleCatalog()
	second := CoverImageVisualStyleCatalog()
	if len(first) == 0 {
		t.Fatal("CoverImageVisualStyleCatalog() returned an empty catalog")
	}

	first[0] = ImageVisualStyleNone
	if second[0] == ImageVisualStyleNone {
		t.Fatal("CoverImageVisualStyleCatalog() returned a mutable shared catalog")
	}
}

func TestCoverImageVisualStyleCatalogKeepsV1Order(t *testing.T) {
	t.Parallel()

	want := []ImageVisualStyle{
		ImageVisualStyleEditorialPhotograph,
		ImageVisualStyleCinematicPhotograph,
		ImageVisualStyleWatercolor,
		ImageVisualStyleGouache,
		ImageVisualStyleOilPainting,
		ImageVisualStylePastel,
	}
	got := CoverImageVisualStyleCatalog()
	if len(got) != len(want) {
		t.Fatalf("CoverImageVisualStyleCatalog() length = %d, want %d", len(got), len(want))
	}

	for index, wantStyle := range want {
		if got[index] != wantStyle {
			t.Errorf("CoverImageVisualStyleCatalog()[%d] = %q, want %q", index, got[index], wantStyle)
		}
	}
}

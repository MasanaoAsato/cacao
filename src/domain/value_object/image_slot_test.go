package value_object

import (
	"sort"
	"testing"
)

func TestNewImageSlot(t *testing.T) {
	tests := []struct {
		name    string
		purpose ImagePurpose
		ordinal int
		wantErr bool
	}{
		{name: "正常系 : cover の ordinal 1", purpose: ImagePurposeCover, ordinal: 1},
		{name: "正常系 : illustration の ordinal 1", purpose: ImagePurposeIllustration, ordinal: 1},
		{name: "正常系 : illustration の ordinal 2", purpose: ImagePurposeIllustration, ordinal: 2},
		{name: "正常系 : illustration の ordinal 3", purpose: ImagePurposeIllustration, ordinal: 3},
		{name: "異常系 : 未知の目的", purpose: ImagePurpose("unknown"), ordinal: 1, wantErr: true},
		{name: "境界値系 : cover の ordinal 0", purpose: ImagePurposeCover, ordinal: 0, wantErr: true},
		{name: "異常系 : cover の不正な ordinal 2", purpose: ImagePurposeCover, ordinal: 2, wantErr: true},
		{name: "境界値系 : illustration の ordinal 0", purpose: ImagePurposeIllustration, ordinal: 0, wantErr: true},
		{name: "境界値系 : illustration の ordinal 4", purpose: ImagePurposeIllustration, ordinal: 4, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			slot, err := NewImageSlot(tt.purpose, tt.ordinal)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NewImageSlot() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if slot.Purpose() != tt.purpose || slot.Ordinal() != tt.ordinal {
				t.Fatalf("got (%q, %d), want (%q, %d)", slot.Purpose(), slot.Ordinal(), tt.purpose, tt.ordinal)
			}
		})
	}
}

func TestImageSlotLess(t *testing.T) {
	slots := []ImageSlot{
		mustNewImageSlot(t, ImagePurposeIllustration, 2),
		mustNewImageSlot(t, ImagePurposeCover, 1),
		mustNewImageSlot(t, ImagePurposeIllustration, 3),
		mustNewImageSlot(t, ImagePurposeIllustration, 1),
	}

	sort.Slice(slots, func(i, j int) bool {
		return slots[i].Less(slots[j])
	})

	want := []struct {
		purpose ImagePurpose
		ordinal int
	}{
		{ImagePurposeCover, 1},
		{ImagePurposeIllustration, 1},
		{ImagePurposeIllustration, 2},
		{ImagePurposeIllustration, 3},
	}
	for i, slot := range slots {
		if slot.Purpose() != want[i].purpose || slot.Ordinal() != want[i].ordinal {
			t.Errorf("slots[%d] = (%q, %d), want (%q, %d)", i, slot.Purpose(), slot.Ordinal(), want[i].purpose, want[i].ordinal)
		}
	}
}

func mustNewImageSlot(t *testing.T, purpose ImagePurpose, ordinal int) ImageSlot {
	t.Helper()

	slot, err := NewImageSlot(purpose, ordinal)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	return slot
}

package service

import (
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func TestNewImageBrief(t *testing.T) {
	validDestination, err := value_object.NewDestination("東京", "日本")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	validPeriod, err := value_object.NewPeriod(
		time.Date(2026, time.August, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.August, 3, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	sameDayPeriod, err := value_object.NewPeriod(
		time.Date(2026, time.August, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.August, 1, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("NewPeriod() error = %v", err)
	}
	validSlot, err := value_object.NewImageSlot(value_object.ImagePurposeCover, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	validIllustrationSlot, err := value_object.NewImageSlot(value_object.ImagePurposeIllustration, 1)
	if err != nil {
		t.Fatalf("NewImageSlot() error = %v", err)
	}
	validStyle := value_object.ImageVisualStyleEditorialPhotograph

	tests := []struct {
		name        string
		destination value_object.Destination
		period      value_object.Period
		slot        value_object.ImageSlot
		style       value_object.ImageVisualStyle
		wantErr     bool
	}{
		{
			name:        "正常系: 有効な画像ブリーフを生成する",
			destination: validDestination,
			period:      validPeriod,
			slot:        validSlot,
			style:       validStyle,
		},
		{
			name:        "異常系: destinationがゼロ値",
			destination: value_object.Destination{},
			period:      validPeriod,
			slot:        validSlot,
			style:       validStyle,
			wantErr:     true,
		},
		{
			name:        "異常系: periodがゼロ値",
			destination: validDestination,
			period:      value_object.Period{},
			slot:        validSlot,
			style:       validStyle,
			wantErr:     true,
		},
		{
			name:        "異常系: slotがゼロ値",
			destination: validDestination,
			period:      validPeriod,
			slot:        value_object.ImageSlot{},
			style:       validStyle,
			wantErr:     true,
		},
		{
			name:        "境界値系: 開始日と終了日が同じ",
			destination: validDestination,
			period:      sameDayPeriod,
			slot:        validSlot,
			style:       validStyle,
		},
		{
			name:        "異常系: coverにnone style",
			destination: validDestination,
			period:      validPeriod,
			slot:        validSlot,
			style:       value_object.ImageVisualStyleNone,
			wantErr:     true,
		},
		{
			name:        "異常系: illustrationにcover style",
			destination: validDestination,
			period:      validPeriod,
			slot:        validIllustrationSlot,
			style:       validStyle,
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			brief, err := NewImageBrief(tt.destination, tt.period, tt.slot, tt.style)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NewImageBrief() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}

			if !brief.Destination().Equals(tt.destination) {
				t.Errorf("Destination() = %v, want %v", brief.Destination(), tt.destination)
			}
			if !brief.Period().Equals(tt.period) {
				t.Errorf("Period() = %v, want %v", brief.Period(), tt.period)
			}
			if brief.Slot() != tt.slot {
				t.Errorf("Slot() = %v, want %v", brief.Slot(), tt.slot)
			}
			if brief.Style() != tt.style {
				t.Errorf("Style() = %v, want %v", brief.Style(), tt.style)
			}
		})
	}
}

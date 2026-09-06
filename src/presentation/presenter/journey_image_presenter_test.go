package presenter

import (
	"cacao/src/application/readmodel"
	"testing"

	requestjourneyimages "cacao/src/application/request_journey_images"
)

func TestToRequestJourneyImagesResponse(t *testing.T) {
	tests := []struct {
		name          string
		output        requestjourneyimages.Output
		wantContent   bool
		wantFailure   bool
		wantImageSize int
	}{
		{
			name: "pending image has null content fields",
			output: requestjourneyimages.Output{
				JourneyRequestID: "request-1",
				Images: []readmodel.JourneyImageDTO{
					{
						ID:             "image-1",
						Slot:           readmodel.SlotDTO{Purpose: "cover", Ordinal: 1},
						Status:         "pending",
						AttemptCount:   0,
						HasContent:     false,
						HasFailureCode: false,
					},
				},
			},
			wantImageSize: 1,
		},
		{
			name: "ready image exposes content metadata",
			output: requestjourneyimages.Output{
				JourneyRequestID: "request-1",
				Images: []readmodel.JourneyImageDTO{
					{
						ID:             "image-1",
						Slot:           readmodel.SlotDTO{Purpose: "cover", Ordinal: 1},
						Status:         "ready",
						AttemptCount:   1,
						HasContent:     true,
						HasVisualStyle: true,
						MediaType:      "image/png",
						VisualStyle:    "watercolor",
						Width:          896,
						Height:         1280,
					},
				},
			},
			wantContent:   true,
			wantImageSize: 1,
		},
		{
			name: "failed image exposes failure code",
			output: requestjourneyimages.Output{
				JourneyRequestID: "request-1",
				Images: []readmodel.JourneyImageDTO{
					{
						ID:             "image-1",
						Slot:           readmodel.SlotDTO{Purpose: "cover", Ordinal: 1},
						Status:         "failed",
						AttemptCount:   3,
						HasFailureCode: true,
						FailureCode:    "provider_timeout",
					},
				},
			},
			wantFailure:   true,
			wantImageSize: 1,
		},
		{
			name: "empty output keeps images as empty array",
			output: requestjourneyimages.Output{
				JourneyRequestID: "request-1",
				Images:           []readmodel.JourneyImageDTO{},
			},
			wantImageSize: 0,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			response := ToRequestJourneyImagesResponse(testCase.output)
			if len(response.Images) != testCase.wantImageSize {
				t.Fatalf("image count = %d, want %d", len(response.Images), testCase.wantImageSize)
			}
			if response.Images == nil {
				t.Fatal("images is nil, want initialized slice")
			}
			if len(response.Images) == 0 {
				return
			}

			image := response.Images[0]
			if (image.ContentURL != nil) != testCase.wantContent {
				t.Errorf("ContentURL present = %t, want %t", image.ContentURL != nil, testCase.wantContent)
			}
			if testCase.name == "ready image exposes content metadata" {
				if image.VisualStyle == nil || *image.VisualStyle != "watercolor" {
					t.Errorf("VisualStyle = %v, want watercolor", image.VisualStyle)
				}
			}
			if (image.FailureCode != nil) != testCase.wantFailure {
				t.Errorf("FailureCode present = %t, want %t", image.FailureCode != nil, testCase.wantFailure)
			}
		})
	}
}

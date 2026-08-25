package presenter

import (
	"fmt"

	getjourneyimage "cacao/src/application/get_journey_image"
	listjourneyimages "cacao/src/application/list_journey_images"
	requestjourneyimages "cacao/src/application/request_journey_images"
	retryjourneyimage "cacao/src/application/retry_journey_image"
)

// JourneyImageResponse は画像状態APIのJSONレスポンスである。
type JourneyImageResponse struct {
	ID           string           `json:"id"`
	Slot         JourneyImageSlot `json:"slot"`
	Status       string           `json:"status"`
	AttemptCount int              `json:"attempt_count"`
	ContentURL   *string          `json:"content_url"`
	MediaType    *string          `json:"media_type"`
	Width        *int             `json:"width"`
	Height       *int             `json:"height"`
	FailureCode  *string          `json:"failure_code"`
}

// JourneyImageSlot は画像スロットのJSON表現である。
type JourneyImageSlot struct {
	Purpose string `json:"purpose"`
	Ordinal int    `json:"ordinal"`
}

// JourneyImageListResponse はrequest単位の画像一覧JSONレスポンスである。
type JourneyImageListResponse struct {
	JourneyRequestID string                 `json:"journey_request_id"`
	Images           []JourneyImageResponse `json:"images"`
}

// ToRequestJourneyImagesResponse は画像生成要求の出力をJSONへ変換する。
func ToRequestJourneyImagesResponse(
	output requestjourneyimages.Output,
) JourneyImageListResponse {
	images := make([]JourneyImageResponse, 0, len(output.Images))
	for _, image := range output.Images {
		images = append(images, imageResponseFromRequest(image))
	}

	return JourneyImageListResponse{
		JourneyRequestID: output.JourneyRequestID,
		Images:           images,
	}
}

// ToListJourneyImagesResponse は画像一覧の出力をJSONへ変換する。
func ToListJourneyImagesResponse(output listjourneyimages.Output) JourneyImageListResponse {
	images := make([]JourneyImageResponse, 0, len(output.Images))
	for _, image := range output.Images {
		images = append(images, imageResponseFromList(image))
	}

	return JourneyImageListResponse{
		JourneyRequestID: output.JourneyRequestID,
		Images:           images,
	}
}

// ToGetJourneyImageResponse は画像1件の出力をJSONへ変換する。
func ToGetJourneyImageResponse(output getjourneyimage.Output) JourneyImageResponse {
	return imageResponseFromGet(output.Image)
}

// ToRetryJourneyImageResponse はretryの出力をJSONへ変換する。
func ToRetryJourneyImageResponse(output retryjourneyimage.Output) JourneyImageResponse {
	return imageResponseFromRetry(output.Image)
}

type imageResponseInput struct {
	ID             string
	Purpose        string
	Ordinal        int
	Status         string
	AttemptCount   int
	HasContent     bool
	MediaType      string
	Width          int
	Height         int
	HasFailureCode bool
	FailureCode    string
}

func imageResponseFromRequest(image requestjourneyimages.JourneyImageDTO) JourneyImageResponse {
	return imageResponse(imageResponseInput{
		ID:             image.ID,
		Purpose:        image.Slot.Purpose,
		Ordinal:        image.Slot.Ordinal,
		Status:         image.Status,
		AttemptCount:   image.AttemptCount,
		HasContent:     image.HasContent,
		MediaType:      image.MediaType,
		Width:          image.Width,
		Height:         image.Height,
		HasFailureCode: image.HasFailureCode,
		FailureCode:    image.FailureCode,
	})
}

func imageResponseFromList(image listjourneyimages.JourneyImageDTO) JourneyImageResponse {
	return imageResponse(imageResponseInput{
		ID:             image.ID,
		Purpose:        image.Slot.Purpose,
		Ordinal:        image.Slot.Ordinal,
		Status:         image.Status,
		AttemptCount:   image.AttemptCount,
		HasContent:     image.HasContent,
		MediaType:      image.MediaType,
		Width:          image.Width,
		Height:         image.Height,
		HasFailureCode: image.HasFailureCode,
		FailureCode:    image.FailureCode,
	})
}

func imageResponseFromGet(image getjourneyimage.JourneyImageDTO) JourneyImageResponse {
	return imageResponse(imageResponseInput{
		ID:             image.ID,
		Purpose:        image.Slot.Purpose,
		Ordinal:        image.Slot.Ordinal,
		Status:         image.Status,
		AttemptCount:   image.AttemptCount,
		HasContent:     image.HasContent,
		MediaType:      image.MediaType,
		Width:          image.Width,
		Height:         image.Height,
		HasFailureCode: image.HasFailureCode,
		FailureCode:    image.FailureCode,
	})
}

func imageResponseFromRetry(image retryjourneyimage.JourneyImageDTO) JourneyImageResponse {
	return imageResponse(imageResponseInput{
		ID:             image.ID,
		Purpose:        image.Slot.Purpose,
		Ordinal:        image.Slot.Ordinal,
		Status:         image.Status,
		AttemptCount:   image.AttemptCount,
		HasContent:     image.HasContent,
		MediaType:      image.MediaType,
		Width:          image.Width,
		Height:         image.Height,
		HasFailureCode: image.HasFailureCode,
		FailureCode:    image.FailureCode,
	})
}

func imageResponse(input imageResponseInput) JourneyImageResponse {
	response := JourneyImageResponse{
		ID:           input.ID,
		Slot:         JourneyImageSlot{Purpose: input.Purpose, Ordinal: input.Ordinal},
		Status:       input.Status,
		AttemptCount: input.AttemptCount,
	}
	if input.HasContent {
		contentURL := fmt.Sprintf("/api/v1/journey-images/%s/content", input.ID)
		response.ContentURL = &contentURL
		response.MediaType = &input.MediaType
		response.Width = &input.Width
		response.Height = &input.Height
	}
	if input.HasFailureCode {
		response.FailureCode = &input.FailureCode
	}

	return response
}

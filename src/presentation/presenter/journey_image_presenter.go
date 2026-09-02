package presenter

import (
	"fmt"

	getjourneyimage "cacao/src/application/get_journey_image"
	listjourneyimages "cacao/src/application/list_journey_images"
	"cacao/src/application/readmodel"
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
func ToRequestJourneyImagesResponse(output requestjourneyimages.Output) JourneyImageListResponse {
	return toJourneyImageListResponse(output.JourneyRequestID, output.Images)
}

// ToListJourneyImagesResponse は画像一覧の出力をJSONへ変換する。
func ToListJourneyImagesResponse(output listjourneyimages.Output) JourneyImageListResponse {
	return toJourneyImageListResponse(output.JourneyRequestID, output.Images)
}

// ToGetJourneyImageResponse は画像1件の出力をJSONへ変換する。
func ToGetJourneyImageResponse(output getjourneyimage.Output) JourneyImageResponse {
	return ToJourneyImageResponse(output.Image)
}

// ToRetryJourneyImageResponse はretryの出力をJSONへ変換する。
func ToRetryJourneyImageResponse(output retryjourneyimage.Output) JourneyImageResponse {
	return ToJourneyImageResponse(output.Image)
}

func toJourneyImageListResponse(requestID string, images []readmodel.JourneyImageDTO) JourneyImageListResponse {
	responses := make([]JourneyImageResponse, 0, len(images))
	for _, image := range images {
		responses = append(responses, ToJourneyImageResponse(image))
	}

	return JourneyImageListResponse{
		JourneyRequestID: requestID,
		Images:           responses,
	}
}

// ToJourneyImageResponse は JourneyImageDTO をJSONレスポンスへ変換する。
// 「値なし」は DTO の Has* フラグで判定し、JSON では null で表現する。
func ToJourneyImageResponse(image readmodel.JourneyImageDTO) JourneyImageResponse {
	response := JourneyImageResponse{
		ID:           image.ID,
		Slot:         JourneyImageSlot{Purpose: image.Slot.Purpose, Ordinal: image.Slot.Ordinal},
		Status:       image.Status,
		AttemptCount: image.AttemptCount,
	}
	if image.HasContent {
		contentURL := fmt.Sprintf("/api/v1/journey-images/%s/content", image.ID)
		response.ContentURL = &contentURL
		response.MediaType = &image.MediaType
		response.Width = &image.Width
		response.Height = &image.Height
	}
	if image.HasFailureCode {
		response.FailureCode = &image.FailureCode
	}

	return response
}

package getjourneyimagecontent

import "io"

// Input は GetJourneyImageContent ユースケースの入力データである。
type Input struct {
	ImageID string
}

// Output は GetJourneyImageContent ユースケースの出力データである。
// ContentのCloseはHTTPレスポンスへのcopy後に呼び出し側が行う。
type Output struct {
	Content   io.ReadCloser
	MediaType string
	ETag      string
}

package exportjourneybooklet

// Input は旅のしおりPDFを出力するための入力である。
type Input struct {
	JourneyID string
	Seed      string
}

// Output はHTTPレスポンスへそのまま書き出せるPDFの内容である。
type Output struct {
	Content   []byte
	FileName  string
	MediaType string
}

package comfyui

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultPollInterval        = time.Second
	defaultMaxImageBytes int64 = 20 * 1024 * 1024
	maxResponseBytes     int64 = 4 * 1024 * 1024
	maxImageWidth              = 4096
	maxImageHeight             = 4096
	maxImagePixels       int64 = 16 * 1024 * 1024
)

type failureKind uint8

const (
	failureUnavailable failureKind = iota + 1
	failureRejected
	failureInvalid
)

type clientError struct {
	kind failureKind
	op   string
	err  error
}

func (e *clientError) Error() string {
	return fmt.Sprintf("%s: %v", e.op, e.err)
}

func (e *clientError) Unwrap() error {
	return e.err
}

type bodyLimitError struct {
	limit int64
}

func (e *bodyLimitError) Error() string {
	return fmt.Sprintf("response body exceeds %d bytes", e.limit)
}

// ClientOption はComfyUI clientの設定を変更する関数である。
type ClientOption func(*Client)

// WithHTTPClient はHTTP clientを設定する。
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(client *Client) {
		if httpClient != nil {
			client.httpClient = httpClient
		}
	}
}

// WithPollInterval はhistory poll間隔を設定する。
func WithPollInterval(interval time.Duration) ClientOption {
	return func(client *Client) {
		if interval >= 0 {
			client.pollInterval = interval
		}
	}
}

// WithMaxImageBytes はview responseの最大byte数を設定する。
func WithMaxImageBytes(maxBytes int64) ClientOption {
	return func(client *Client) {
		if maxBytes > 0 {
			client.maxImageBytes = maxBytes
		}
	}
}

// Client はComfyUI local APIとのAnti-Corruption Layerである。
type Client struct {
	baseURL       *url.URL
	httpClient    *http.Client
	pollInterval  time.Duration
	maxImageBytes int64
}

// OutputReference はComfyUIのhistoryから得た画像参照である。
type OutputReference struct {
	Filename  string `json:"filename"`
	Subfolder string `json:"subfolder"`
	Type      string `json:"type"`
}

// Image はComfyUIから取得し、decode検証済みの画像である。
type Image struct {
	Content   []byte
	MediaType string
	Width     int
	Height    int
}

// NewClient はbase URLを検証したComfyUI clientを作成する。
func NewClient(rawBaseURL string, options ...ClientOption) (*Client, error) {
	baseURL, err := parseBaseURL(rawBaseURL)
	if err != nil {
		return nil, err
	}

	client := &Client{
		baseURL:       baseURL,
		httpClient:    &http.Client{},
		pollInterval:  defaultPollInterval,
		maxImageBytes: defaultMaxImageBytes,
	}
	for _, option := range options {
		if option != nil {
			option(client)
		}
	}

	client.httpClient = cloneHTTPClient(client.httpClient, baseURL)

	return client, nil
}

// NewClientWithHTTPClient はHTTP clientを指定してComfyUI clientを作成する。
func NewClientWithHTTPClient(
	rawBaseURL string,
	httpClient *http.Client,
	options ...ClientOption,
) (*Client, error) {
	allOptions := make([]ClientOption, 0, len(options)+1)
	allOptions = append(allOptions, WithHTTPClient(httpClient))
	allOptions = append(allOptions, options...)

	return NewClient(rawBaseURL, allOptions...)
}

// Submit はworkflowを/promptへ送り、ComfyUIのprompt IDを返す。
func (c *Client) Submit(ctx context.Context, workflow []byte) (string, error) {
	if c == nil {
		return "", newClientError(failureUnavailable, "submit prompt", errors.New("client must not be nil"))
	}
	if len(workflow) == 0 {
		return "", newClientError(failureRejected, "submit prompt", errors.New("workflow must not be empty"))
	}

	payload, err := json.Marshal(struct {
		Prompt json.RawMessage `json:"prompt"`
	}{
		Prompt: json.RawMessage(workflow),
	})
	if err != nil {
		return "", newClientError(failureRejected, "encode prompt request", err)
	}

	response, err := c.do(ctx, http.MethodPost, c.endpoint("/prompt"), bytes.NewReader(payload))
	if err != nil {
		return "", newClientError(failureUnavailable, "submit prompt", err)
	}
	body, readErr := readResponseBody(response, maxResponseBytes)
	if response.StatusCode >= http.StatusInternalServerError {
		if readErr != nil {
			return "", newClientError(failureUnavailable, "read prompt response", readErr)
		}
		return "", newClientError(failureUnavailable, "submit prompt", fmt.Errorf("server returned %s", response.Status))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		if readErr != nil {
			return "", newClientError(failureRejected, "read prompt response", readErr)
		}
		return "", newClientError(failureRejected, "submit prompt", fmt.Errorf("server returned %s", response.Status))
	}
	if readErr != nil {
		return "", newClientError(failureRejected, "read prompt response", readErr)
	}

	var promptResponse struct {
		PromptID   string                     `json:"prompt_id"`
		NodeErrors map[string]json.RawMessage `json:"node_errors"`
	}
	if err := json.Unmarshal(body, &promptResponse); err != nil {
		return "", newClientError(failureRejected, "decode prompt response", err)
	}
	if len(promptResponse.NodeErrors) > 0 {
		return "", newClientError(failureRejected, "submit prompt", errors.New("comfyui returned node errors"))
	}
	if strings.TrimSpace(promptResponse.PromptID) == "" {
		return "", newClientError(failureRejected, "decode prompt response", errors.New("prompt id is missing"))
	}

	return strings.TrimSpace(promptResponse.PromptID), nil
}

// WaitForOutput は指定output nodeに画像が出るまでhistoryをpollする。
func (c *Client) WaitForOutput(
	ctx context.Context,
	promptID string,
	outputNodeID string,
) (OutputReference, error) {
	if c == nil {
		return OutputReference{}, newClientError(failureUnavailable, "poll history", errors.New("client must not be nil"))
	}
	if err := validatePathComponent(promptID, "prompt id"); err != nil {
		return OutputReference{}, newClientError(failureRejected, "poll history", err)
	}
	if strings.TrimSpace(outputNodeID) == "" {
		return OutputReference{}, newClientError(failureRejected, "poll history", errors.New("output node id must not be empty"))
	}

	for {
		history, err := c.getHistory(ctx, promptID)
		if err != nil {
			return OutputReference{}, err
		}

		if entry, ok := history[promptID]; ok {
			if hasExecutionError(entry.Status) {
				return OutputReference{}, newClientError(failureRejected, "poll history", errors.New("comfyui execution failed"))
			}

			output, ok := entry.Outputs[outputNodeID]
			if ok && len(output.Images) > 0 {
				image := output.Images[0]
				if err := validateOutputReference(image); err != nil {
					return OutputReference{}, newClientError(failureRejected, "poll history", err)
				}
				return image, nil
			}
			if entry.Status.Completed || isSuccessfulStatus(entry.Status.StatusString) {
				return OutputReference{}, newClientError(failureRejected, "poll history", errors.New("output image is missing"))
			}
		}

		if err := waitForPoll(ctx, c.pollInterval); err != nil {
			return OutputReference{}, newClientError(failureUnavailable, "poll history", err)
		}
	}
}

// View は/viewから画像を取得し、media typeと寸法をdecode検証する。
func (c *Client) View(ctx context.Context, output OutputReference) (Image, error) {
	if c == nil {
		return Image{}, newClientError(failureUnavailable, "get image", errors.New("client must not be nil"))
	}
	if err := validateOutputReference(output); err != nil {
		return Image{}, newClientError(failureRejected, "get image", err)
	}

	viewURL := c.endpoint("/view")
	query := url.Values{}
	query.Set("filename", output.Filename)
	query.Set("subfolder", output.Subfolder)
	query.Set("type", output.Type)
	viewURL.RawQuery = query.Encode()

	response, err := c.do(ctx, http.MethodGet, viewURL, nil)
	if err != nil {
		return Image{}, newClientError(failureUnavailable, "get image", err)
	}
	body, readErr := readResponseBody(response, c.maxImageBytes)
	if response.StatusCode >= http.StatusInternalServerError {
		if readErr != nil {
			return Image{}, newClientError(failureUnavailable, "read image response", readErr)
		}
		return Image{}, newClientError(failureUnavailable, "get image", fmt.Errorf("server returned %s", response.Status))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		if readErr != nil {
			return Image{}, newClientError(failureRejected, "read image response", readErr)
		}
		return Image{}, newClientError(failureRejected, "get image", fmt.Errorf("server returned %s", response.Status))
	}
	if readErr != nil {
		var limitErr *bodyLimitError
		if errors.As(readErr, &limitErr) {
			return Image{}, newClientError(failureInvalid, "read image response", readErr)
		}
		return Image{}, newClientError(failureUnavailable, "read image response", readErr)
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(body))
	if err != nil {
		return Image{}, newClientError(failureInvalid, "decode image", err)
	}
	mediaType, err := validateImageConfig(config, format)
	if err != nil {
		return Image{}, newClientError(failureInvalid, "decode image", err)
	}
	if _, _, err := image.Decode(bytes.NewReader(body)); err != nil {
		return Image{}, newClientError(failureInvalid, "decode image", err)
	}

	return Image{
		Content:   body,
		MediaType: mediaType,
		Width:     config.Width,
		Height:    config.Height,
	}, nil
}

func (c *Client) getHistory(ctx context.Context, promptID string) (map[string]historyEntry, error) {
	response, err := c.do(ctx, http.MethodGet, c.endpoint("/history/"+promptID), nil)
	if err != nil {
		return nil, newClientError(failureUnavailable, "poll history", err)
	}
	body, readErr := readResponseBody(response, maxResponseBytes)
	if response.StatusCode >= http.StatusInternalServerError {
		if readErr != nil {
			return nil, newClientError(failureUnavailable, "read history response", readErr)
		}
		return nil, newClientError(failureUnavailable, "poll history", fmt.Errorf("server returned %s", response.Status))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		if readErr != nil {
			return nil, newClientError(failureRejected, "read history response", readErr)
		}
		return nil, newClientError(failureRejected, "poll history", fmt.Errorf("server returned %s", response.Status))
	}
	if readErr != nil {
		return nil, newClientError(failureRejected, "read history response", readErr)
	}

	history := map[string]historyEntry{}
	if err := json.Unmarshal(body, &history); err != nil {
		return nil, newClientError(failureRejected, "decode history response", err)
	}

	return history, nil
}

type historyEntry struct {
	Outputs map[string]historyOutput `json:"outputs"`
	Status  historyStatus            `json:"status"`
}

type historyOutput struct {
	Images []OutputReference `json:"images"`
}

type historyStatus struct {
	StatusString string              `json:"status_str"`
	Completed    bool                `json:"completed"`
	Messages     [][]json.RawMessage `json:"messages"`
}

func hasExecutionError(status historyStatus) bool {
	switch strings.ToLower(status.StatusString) {
	case "error", "failed", "failure":
		return true
	}

	for _, message := range status.Messages {
		if len(message) == 0 {
			continue
		}
		var event string
		if err := json.Unmarshal(message[0], &event); err == nil && strings.EqualFold(event, "execution_error") {
			return true
		}
	}

	return false
}

func isSuccessfulStatus(status string) bool {
	return strings.EqualFold(status, "success") || strings.EqualFold(status, "completed")
}

func waitForPoll(ctx context.Context, interval time.Duration) error {
	if interval == 0 {
		return nil
	}

	timer := time.NewTimer(interval)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func validateOutputReference(output OutputReference) error {
	if strings.TrimSpace(output.Filename) == "" {
		return errors.New("output filename must not be empty")
	}
	if strings.TrimSpace(output.Type) == "" {
		return errors.New("output type must not be empty")
	}

	return nil
}

func parseBaseURL(rawBaseURL string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawBaseURL))
	if err != nil {
		return nil, fmt.Errorf("invalid comfyui base url: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("invalid comfyui base url: scheme must be http or https")
	}
	if parsed.Host == "" || parsed.Hostname() == "" {
		return nil, fmt.Errorf("invalid comfyui base url: host must not be empty")
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("invalid comfyui base url: userinfo is not allowed")
	}
	if parsed.RawQuery != "" || parsed.ForceQuery {
		return nil, fmt.Errorf("invalid comfyui base url: query is not allowed")
	}
	if parsed.Fragment != "" {
		return nil, fmt.Errorf("invalid comfyui base url: fragment is not allowed")
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return nil, fmt.Errorf("invalid comfyui base url: path is not allowed")
	}

	parsed.Path = ""
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""

	return parsed, nil
}

func cloneHTTPClient(source *http.Client, baseURL *url.URL) *http.Client {
	if source == nil {
		source = &http.Client{}
	}

	clone := *source
	clone.CheckRedirect = func(request *http.Request, _ []*http.Request) error {
		if !sameOrigin(baseURL, request.URL) {
			return fmt.Errorf("redirect outside comfyui origin is not allowed")
		}
		return nil
	}

	return &clone
}

func sameOrigin(left, right *url.URL) bool {
	if left == nil || right == nil {
		return false
	}
	if right.User != nil {
		return false
	}

	return strings.EqualFold(left.Scheme, right.Scheme) &&
		strings.EqualFold(left.Hostname(), right.Hostname()) &&
		effectivePort(left) == effectivePort(right)
}

func effectivePort(parsed *url.URL) string {
	if port := parsed.Port(); port != "" {
		return port
	}
	if parsed.Scheme == "https" {
		return "443"
	}

	return "80"
}

func (c *Client) endpoint(path string) *url.URL {
	endpoint := *c.baseURL
	endpoint.Path = path
	endpoint.RawPath = ""
	endpoint.RawQuery = ""
	endpoint.Fragment = ""

	return &endpoint
}

func (c *Client) do(
	ctx context.Context,
	method string,
	endpoint *url.URL,
	body io.Reader,
) (*http.Response, error) {
	if ctx == nil {
		return nil, errors.New("context must not be nil")
	}
	request, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return nil, err
	}
	if method == http.MethodPost {
		request.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(request)
}

func readResponseBody(response *http.Response, limit int64) (body []byte, err error) {
	if response == nil || response.Body == nil {
		return nil, errors.New("response body is nil")
	}
	defer func() {
		closeErr := response.Body.Close()
		if err == nil && closeErr != nil {
			err = fmt.Errorf("close response body: %w", closeErr)
		}
	}()

	body, err = io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, &bodyLimitError{limit: limit}
	}

	return body, nil
}

func validatePathComponent(value, name string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s must not be empty", name)
	}
	if strings.ContainsAny(value, "/\\?#") {
		return fmt.Errorf("%s contains an invalid path character", name)
	}

	return nil
}

func mediaTypeForFormat(format string) (string, bool) {
	switch strings.ToLower(format) {
	case "png":
		return "image/png", true
	case "jpeg":
		return "image/jpeg", true
	case "gif":
		return "image/gif", true
	default:
		return "", false
	}
}

func validateImageConfig(config image.Config, format string) (string, error) {
	mediaType, ok := mediaTypeForFormat(format)
	if !ok {
		return "", errors.New("unsupported image format")
	}
	if config.Width <= 0 || config.Height <= 0 {
		return "", errors.New("image dimensions must be positive")
	}
	if config.Width > maxImageWidth || config.Height > maxImageHeight {
		return "", errors.New("image dimensions exceed maximum")
	}
	if int64(config.Width) > maxImagePixels/int64(config.Height) {
		return "", errors.New("image pixels exceed maximum")
	}

	return mediaType, nil
}

func newClientError(kind failureKind, operation string, err error) error {
	return &clientError{kind: kind, op: operation, err: err}
}

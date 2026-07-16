// Package qstash holds the real Upstash QStash adapters: an EventPublisher
// that posts to QStash's publish API, and Upstash-Signature verification
// for the inbound webhook consumer.
package qstash

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// publishBaseURL is QStash's publish API; the destination topic/URL is
// appended as a path segment.
const publishBaseURL = "https://qstash.upstash.io/v2/publish/"

// EventPublisher implements application.EventPublisher by posting an
// EventEnvelope to Upstash QStash's publish API, which then delivers it
// (with retries and Upstash-Signature) to destination.
type EventPublisher struct {
	baseURL     string
	destination string
	token       string
	httpClient  *http.Client
}

// Option configures an EventPublisher constructed by NewEventPublisher.
type Option func(*EventPublisher)

// WithBaseURL overrides QStash's publish API base URL. It exists so tests
// can point an EventPublisher at an httptest.Server instead of the real
// Upstash endpoint; production callers should not need it.
func WithBaseURL(baseURL string) Option {
	return func(p *EventPublisher) { p.baseURL = baseURL }
}

// WithHTTPClient overrides the default HTTP client (a 10-second timeout).
func WithHTTPClient(httpClient *http.Client) Option {
	return func(p *EventPublisher) { p.httpClient = httpClient }
}

// NewEventPublisher constructs a QStash-backed EventPublisher. destination
// is the URL QStash will deliver to (this service's own
// /internal/v1/events/qstash endpoint, or another topic/URL entirely);
// token is QSTASH_TOKEN. Both are read from the environment by the caller,
// not by this constructor, to keep the type explicit and easy to test.
func NewEventPublisher(destination, token string, opts ...Option) *EventPublisher {
	p := &EventPublisher{
		baseURL:     publishBaseURL,
		destination: destination,
		token:       token,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}

	for _, opt := range opts {
		opt(p)
	}

	return p
}

// Publish wraps data in an EventEnvelope and posts it to QStash's publish
// API for delivery to the configured destination.
func (p *EventPublisher) Publish(ctx context.Context, event string, correlationID string, data any) error {
	envelope := domain.EventEnvelope[any]{
		Event:         event,
		CorrelationID: correlationID,
		Timestamp:     time.Now().UTC(),
		Data:          data,
	}

	body, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal event %q envelope: %w", event, err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		p.baseURL+p.destination,
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("build qstash publish request for event %q: %w", event, err)
	}

	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("publish event %q to qstash: %w", event, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("publish event %q to qstash: unexpected status %d: %s", event, resp.StatusCode, respBody)
	}

	return nil
}

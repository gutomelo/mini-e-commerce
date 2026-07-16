// Package fake holds in-memory adapters used by tests and by local
// development when no live Upstash QStash account is configured.
package fake

import (
	"context"
	"sync"
)

// PublishedEvent records a single call recorded by a FakeEventPublisher.
type PublishedEvent struct {
	Event         string
	CorrelationID string
	Data          any
}

// EventPublisher is an in-memory implementation of application.
// EventPublisher that records every call for inspection by tests. It is
// safe for concurrent use, so it can be shared across goroutines handling
// concurrent requests in the HTTP-level test suite.
//
// This consolidates the hand-rolled fake publisher that internal/
// application's own unit tests already define locally (fakes_test.go);
// that package-private copy is left as-is since it is scoped to those
// tests, while this exported version is the one later HTTP-level tests and
// cmd/server's local-dev wiring should depend on.
type EventPublisher struct {
	mu    sync.Mutex
	calls []PublishedEvent
}

// NewEventPublisher constructs an empty FakeEventPublisher.
func NewEventPublisher() *EventPublisher {
	return &EventPublisher{calls: []PublishedEvent{}}
}

// Publish records the call and always succeeds.
func (p *EventPublisher) Publish(_ context.Context, event string, correlationID string, data any) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.calls = append(p.calls, PublishedEvent{
		Event:         event,
		CorrelationID: correlationID,
		Data:          data,
	})

	return nil
}

// Calls returns a copy of every call recorded so far, in call order.
func (p *EventPublisher) Calls() []PublishedEvent {
	p.mu.Lock()
	defer p.mu.Unlock()

	calls := make([]PublishedEvent, len(p.calls))
	copy(calls, p.calls)

	return calls
}

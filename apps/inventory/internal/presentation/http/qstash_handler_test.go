package http_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
	presentationhttp "github.com/gmsoftware/mini-e-commerce/inventory/internal/presentation/http"
)

// fakeVerifier is a minimal signature verifier for tests: it fails when
// wantErr is set, regardless of the signature/body it receives.
type fakeVerifier struct {
	wantErr bool
}

func (v *fakeVerifier) Verify(_, _, _ string) error {
	if v.wantErr {
		return errVerifyFailed
	}

	return nil
}

var errVerifyFailed = context.DeadlineExceeded // any non-nil sentinel works here

// fakeConsumer is a minimal order.created consumer for tests.
type fakeConsumer struct {
	wantErr  bool
	executed int
}

func (c *fakeConsumer) Execute(_ context.Context, _ domain.EventEnvelope[domain.OrderCreatedData]) error {
	c.executed++
	if c.wantErr {
		return errVerifyFailed
	}

	return nil
}

func TestQStashHandler(t *testing.T) {
	t.Parallel()

	validBody := []byte(`{
		"event": "order.created",
		"correlationId": "corr-1",
		"timestamp": "2026-01-01T00:00:00Z",
		"data": {"orderId": "order-1", "items": [{"productId": "p1", "quantity": 2}]}
	}`)

	tests := []struct {
		name          string
		signature     string
		verifierFails bool
		consumerFails bool
		body          []byte
		wantStatus    int
		wantExecuted  int
	}{
		{
			name:         "missing signature returns 401 and never executes",
			signature:    "",
			body:         validBody,
			wantStatus:   http.StatusUnauthorized,
			wantExecuted: 0,
		},
		{
			name:          "invalid signature returns 401 and never executes",
			signature:     "bad-signature",
			verifierFails: true,
			body:          validBody,
			wantStatus:    http.StatusUnauthorized,
			wantExecuted:  0,
		},
		{
			name:         "valid signature and payload returns 200",
			signature:    "good-signature",
			body:         validBody,
			wantStatus:   http.StatusOK,
			wantExecuted: 1,
		},
		{
			name:         "malformed payload returns 400",
			signature:    "good-signature",
			body:         []byte("not-json"),
			wantStatus:   http.StatusBadRequest,
			wantExecuted: 0,
		},
		{
			name:          "consumer failure returns 500",
			signature:     "good-signature",
			consumerFails: true,
			body:          validBody,
			wantStatus:    http.StatusInternalServerError,
			wantExecuted:  1,
		},
		{
			name:      "mismatched event type returns 400 and never executes",
			signature: "good-signature",
			body: []byte(`{
				"event": "some.other.event",
				"correlationId": "corr-1",
				"timestamp": "2026-01-01T00:00:00Z",
				"data": {"orderId": "order-1", "items": [{"productId": "p1", "quantity": 2}]}
			}`),
			wantStatus:   http.StatusBadRequest,
			wantExecuted: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			verifier := &fakeVerifier{wantErr: tt.verifierFails}
			consumer := &fakeConsumer{wantErr: tt.consumerFails}

			handler := presentationhttp.NewQStashHandler(verifier, consumer, "https://inventory.example.com/internal/v1/events/qstash")

			mux := http.NewServeMux()
			mux.HandleFunc("POST /internal/v1/events/qstash", handler.Handle)

			req := httptest.NewRequest(http.MethodPost, "/internal/v1/events/qstash", bytes.NewReader(tt.body))
			if tt.signature != "" {
				req.Header.Set("Upstash-Signature", tt.signature)
			}

			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}

			if consumer.executed != tt.wantExecuted {
				t.Fatalf("executed = %d, want %d", consumer.executed, tt.wantExecuted)
			}
		})
	}
}

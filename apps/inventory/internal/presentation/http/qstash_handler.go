package http

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// upstashSignatureHeader carries the JWT QStash signs each delivered
// request with.
const upstashSignatureHeader = "Upstash-Signature"

// signatureVerifier is satisfied by qstash.SignatureVerifier; declared here
// so this package depends on the small behavior it needs rather than the
// concrete infrastructure type.
type signatureVerifier interface {
	Verify(signature, destinationURL, body string) error
}

// orderCreatedConsumer is satisfied by
// *application.ConsumeOrderCreatedUseCase.
type orderCreatedConsumer interface {
	Execute(ctx context.Context, envelope domain.EventEnvelope[domain.OrderCreatedData]) error
}

// QStashHandler consumes order.created events delivered by Upstash QStash.
type QStashHandler struct {
	verifier       signatureVerifier
	consumer       orderCreatedConsumer
	destinationURL string
}

// NewQStashHandler constructs a QStashHandler. destinationURL is the full
// external URL QStash delivers this webhook to (e.g.
// https://inventory.example.com/internal/v1/events/qstash) — it must match
// exactly what QStash signed, so it is supplied by the caller (read from an
// env var) rather than derived from the incoming request, which cannot be
// trusted before the signature is verified.
func NewQStashHandler(verifier signatureVerifier, consumer orderCreatedConsumer, destinationURL string) *QStashHandler {
	return &QStashHandler{
		verifier:       verifier,
		consumer:       consumer,
		destinationURL: destinationURL,
	}
}

// Handle handles POST /internal/v1/events/qstash. A missing or invalid
// Upstash-Signature header is rejected with 401 before the body is ever
// parsed or acted on. A correlationId already recorded as processed is a
// no-op success (200), per ConsumeOrderCreatedUseCase's idempotency
// contract — QStash only stops retrying on a 2xx response.
func (h *QStashHandler) Handle(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	signature := r.Header.Get(upstashSignatureHeader)
	if signature == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.verifier.Verify(signature, h.destinationURL, string(body)); err != nil {
		slog.Warn("qstash handler: signature verification failed", "error", err)
		writeError(w, http.StatusUnauthorized, "unauthorized")

		return
	}

	var envelope domain.EventEnvelope[domain.OrderCreatedData]
	if err := json.Unmarshal(body, &envelope); err != nil {
		writeError(w, http.StatusBadRequest, "invalid event payload")
		return
	}

	// This route is currently the only QStash subscription this service
	// has, but the envelope's event field is part of the contract (per the
	// spec), so a mismatched event is rejected rather than silently
	// processed as if it were order.created — this is the check a second
	// event type sharing this route would otherwise need someone to
	// remember to add.
	if envelope.Event != domain.OrderCreatedEvent {
		slog.Warn(
			"qstash handler: unexpected event type, ignoring",
			"event", envelope.Event,
			"correlationId", envelope.CorrelationID,
		)
		writeError(w, http.StatusBadRequest, "unsupported event type")

		return
	}

	if err := h.consumer.Execute(r.Context(), envelope); err != nil {
		slog.Error(
			"qstash handler: consume order.created",
			"correlationId", envelope.CorrelationID,
			"error", err,
		)
		writeError(w, http.StatusInternalServerError, "internal error")

		return
	}

	slog.Info(
		"qstash handler: order.created consumed",
		"correlationId", envelope.CorrelationID,
	)
	w.WriteHeader(http.StatusOK)
}

// compile-time check that *application.ConsumeOrderCreatedUseCase satisfies
// orderCreatedConsumer. signatureVerifier has no equivalent check here: its
// concrete implementation (qstash.SignatureVerifier) lives in the
// infrastructure layer, and this presentation package intentionally does
// not import infrastructure — cmd/server's wiring is where a mismatch would
// surface instead.
var _ orderCreatedConsumer = (*application.ConsumeOrderCreatedUseCase)(nil)

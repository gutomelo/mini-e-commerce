package domain

import "time"

// Stock is the inventory service's core entity: one row per product,
// tracking the best-effort quantity currently on hand.
type Stock struct {
	ProductID string
	Quantity  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ProcessedEvent is the idempotency marker recorded for every consumed
// event, keyed by the event envelope's correlation ID. Only the
// correlation ID and the processing timestamp are meaningful; the
// repository layer treats the marker's existence as the source of truth,
// so this type carries no other fields.
type ProcessedEvent struct {
	CorrelationID string
	ProcessedAt   time.Time
}

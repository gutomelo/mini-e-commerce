package application

import (
	"context"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// StockRepository abstracts persistence for stock rows.
//
// Not-found contract: GetByProductID returns (nil, nil) when no stock row
// exists for the given product id — it is not an error condition, it is
// the expected result for a product that has never been stocked. Callers
// (use cases, and eventually the HTTP handler) distinguish "not found" from
// "repository failure" by checking whether the returned error is nil, then
// checking whether the returned pointer is nil. This is a contract other
// future work (the Postgres adapter, the HTTP handler mapping to 404)
// depends on, so it is documented here prominently and must not change
// without updating every implementation and caller.
type StockRepository interface {
	// GetByProductID returns the stock row for productID, or (nil, nil) if
	// no row exists.
	GetByProductID(ctx context.Context, productID string) (*domain.Stock, error)

	// SetQuantity upserts the stock row for productID to the given
	// absolute quantity, creating the row if it does not already exist.
	// This is the PATCH endpoint's absolute-set semantics.
	SetQuantity(ctx context.Context, productID string, quantity int) (*domain.Stock, error)

	// DecrementQuantity reduces the stock row for productID by delta,
	// clamped at zero (never negative). If no row exists for productID,
	// the current quantity is treated as zero before clamping, so a
	// decrement against an unknown product creates a zero-quantity row
	// rather than erroring.
	DecrementQuantity(ctx context.Context, productID string, delta int) (*domain.Stock, error)
}

// ProcessedEventRepository abstracts the idempotency marker used to make
// event consumption safe under redelivery.
type ProcessedEventRepository interface {
	// TryClaim atomically records correlationID as processed and reports
	// whether this call is the one that claimed it: true if correlationID
	// was not already recorded (the caller should proceed), false if it was
	// already present (the caller must treat this as a no-op redelivery).
	// This must be a single atomic operation at the storage layer — a
	// separate "is it processed" check followed by a separate "mark it
	// processed" write would leave a window where two concurrent
	// deliveries of the same event both observe "not yet processed" and
	// both proceed, double-applying the event. Implementations exist to
	// close exactly that window.
	TryClaim(ctx context.Context, correlationID string) (claimed bool, err error)
}

// EventPublisher abstracts publishing an outbound event. The signature
// takes the event's data as `any` rather than a generic parameter because
// Go interface methods cannot be generic; callers pass a concrete
// domain.InventoryUpdatedData value (or any other event payload type),
// and adapters (real QStash client, fake in-memory recorder) serialize it
// as needed.
type EventPublisher interface {
	Publish(ctx context.Context, event string, correlationID string, data any) error
}

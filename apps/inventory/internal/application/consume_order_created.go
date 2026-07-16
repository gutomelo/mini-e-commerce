package application

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// InventoryUpdatedEvent is the event name published after a stock
// decrement.
const InventoryUpdatedEvent = "inventory.updated"

// ConsumeOrderCreatedUseCase handles an order.created event by decrementing
// stock for each line item and publishing inventory.updated for each
// affected product.
type ConsumeOrderCreatedUseCase struct {
	stockRepo     StockRepository
	processedRepo ProcessedEventRepository
	publisher     EventPublisher
}

// NewConsumeOrderCreatedUseCase constructs a ConsumeOrderCreatedUseCase.
func NewConsumeOrderCreatedUseCase(
	stockRepo StockRepository,
	processedRepo ProcessedEventRepository,
	publisher EventPublisher,
) *ConsumeOrderCreatedUseCase {
	return &ConsumeOrderCreatedUseCase{
		stockRepo:     stockRepo,
		processedRepo: processedRepo,
		publisher:     publisher,
	}
}

// Execute claims the event's correlation ID, then applies the decrements
// described by envelope. Redelivery of an envelope with a correlation ID
// already claimed is a no-op.
//
// Claim-first ordering: TryClaim is called before any decrement or
// publish, and only the caller that wins the atomic claim proceeds. This
// is what actually prevents a double-decrement under concurrent redelivery
// (two overlapping deliveries of the same event, which QStash's
// at-least-once model can produce) — a "check if processed, then decrement,
// then mark processed" sequence would leave a window where both deliveries
// observe "not yet processed" before either marks it, and both would
// decrement. The tradeoff this ordering accepts instead: if this process
// crashes or a decrement/publish fails after the claim succeeds, the event
// is already marked processed and will not be retried, so that event's
// decrements may be lost (an availability/completeness tradeoff, not a
// correctness one — stock never double-decrements, but a decrement can be
// dropped on a mid-event crash). The spec's acceptance criteria require no
// double-decrement on redelivery; this ordering guarantees that.
func (uc *ConsumeOrderCreatedUseCase) Execute(ctx context.Context, envelope domain.EventEnvelope[domain.OrderCreatedData]) error {
	claimed, err := uc.processedRepo.TryClaim(ctx, envelope.CorrelationID)
	if err != nil {
		return fmt.Errorf("claim correlation %q: %w", envelope.CorrelationID, err)
	}

	if !claimed {
		return nil
	}

	for _, item := range envelope.Data.Items {
		if item.Quantity <= 0 {
			slog.Warn(
				"consume order.created: skipping item with non-positive quantity",
				"correlationId", envelope.CorrelationID,
				"productId", item.ProductID,
				"quantity", item.Quantity,
			)

			continue
		}

		stock, err := uc.stockRepo.DecrementQuantity(ctx, item.ProductID, item.Quantity)
		if err != nil {
			return fmt.Errorf("decrement stock for product %q: %w", item.ProductID, err)
		}

		data := domain.InventoryUpdatedData{
			ProductID: stock.ProductID,
			Quantity:  stock.Quantity,
		}

		if err := uc.publisher.Publish(ctx, InventoryUpdatedEvent, envelope.CorrelationID, data); err != nil {
			return fmt.Errorf("publish inventory.updated for product %q: %w", item.ProductID, err)
		}
	}

	return nil
}

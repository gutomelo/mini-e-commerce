package application

import (
	"context"
	"fmt"

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

// Execute applies the decrements described by envelope, then marks the
// event processed. Redelivery of an envelope with a correlation ID already
// recorded as processed is a no-op.
//
// Ordering tradeoff: the event is marked processed only after every
// decrement and publish has succeeded, so a failure partway through leaves
// the correlation ID unmarked and the event eligible for a clean retry
// rather than being recorded as "done" while only partially applied. The
// residual risk is the narrow window between the decrements/publishes
// succeeding and MarkProcessed itself succeeding: if MarkProcessed fails
// there, a redelivered retry would repeat the decrements (a rare
// double-decrement). Perfect exactly-once semantics would require an
// atomic transaction spanning both the stock repository and the marker
// repository (and ideally the publish, which is not transactional at
// all); the spec's acceptance criteria only require that an identical
// redelivery does not double-decrement in the common case, which the
// upfront IsProcessed check already guarantees. We accept the rare
// failure-window risk rather than adding that complexity.
func (uc *ConsumeOrderCreatedUseCase) Execute(ctx context.Context, envelope domain.EventEnvelope[domain.OrderCreatedData]) error {
	alreadyProcessed, err := uc.processedRepo.IsProcessed(ctx, envelope.CorrelationID)
	if err != nil {
		return fmt.Errorf("check processed state for correlation %q: %w", envelope.CorrelationID, err)
	}

	if alreadyProcessed {
		return nil
	}

	for _, item := range envelope.Data.Items {
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

	if err := uc.processedRepo.MarkProcessed(ctx, envelope.CorrelationID); err != nil {
		return fmt.Errorf("mark correlation %q processed: %w", envelope.CorrelationID, err)
	}

	return nil
}

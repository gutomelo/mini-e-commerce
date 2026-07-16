package application_test

import (
	"context"
	"testing"
	"time"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

func newOrderCreatedEnvelope(correlationID string, items ...domain.OrderCreatedItem) domain.EventEnvelope[domain.OrderCreatedData] {
	return domain.EventEnvelope[domain.OrderCreatedData]{
		Event:         "order.created",
		CorrelationID: correlationID,
		Timestamp:     time.Now(),
		Data: domain.OrderCreatedData{
			OrderID: "order-1",
			Items:   items,
		},
	}
}

func TestConsumeOrderCreatedUseCase_Execute(t *testing.T) {
	t.Run("decrements and publishes one event per affected product", func(t *testing.T) {
		stockRepo := newFakeStockRepository()
		stockRepo.rows["product-1"] = &domain.Stock{ProductID: "product-1", Quantity: 10}
		stockRepo.rows["product-2"] = &domain.Stock{ProductID: "product-2", Quantity: 5}
		processedRepo := newFakeProcessedEventRepository()
		publisher := newFakeEventPublisher()
		uc := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

		envelope := newOrderCreatedEnvelope(
			"correlation-1",
			domain.OrderCreatedItem{ProductID: "product-1", Quantity: 3},
			domain.OrderCreatedItem{ProductID: "product-2", Quantity: 2},
		)

		if err := uc.Execute(context.Background(), envelope); err != nil {
			t.Fatalf("Execute() error = %v, want nil", err)
		}

		if got := stockRepo.rows["product-1"].Quantity; got != 7 {
			t.Errorf("product-1 quantity = %d, want 7", got)
		}

		if got := stockRepo.rows["product-2"].Quantity; got != 3 {
			t.Errorf("product-2 quantity = %d, want 3", got)
		}

		if len(publisher.published) != 2 {
			t.Fatalf("published events = %d, want 2", len(publisher.published))
		}

		for _, event := range publisher.published {
			if event.Event != application.InventoryUpdatedEvent {
				t.Errorf("event name = %q, want %q", event.Event, application.InventoryUpdatedEvent)
			}
		}
	})

	t.Run("clamps at zero when decrement would go negative", func(t *testing.T) {
		stockRepo := newFakeStockRepository()
		stockRepo.rows["product-1"] = &domain.Stock{ProductID: "product-1", Quantity: 2}
		processedRepo := newFakeProcessedEventRepository()
		publisher := newFakeEventPublisher()
		uc := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

		envelope := newOrderCreatedEnvelope(
			"correlation-1",
			domain.OrderCreatedItem{ProductID: "product-1", Quantity: 5},
		)

		if err := uc.Execute(context.Background(), envelope); err != nil {
			t.Fatalf("Execute() error = %v, want nil", err)
		}

		if got := stockRepo.rows["product-1"].Quantity; got != 0 {
			t.Errorf("product-1 quantity = %d, want 0 (clamped)", got)
		}
	})

	t.Run("redelivery with the same correlation ID is a no-op", func(t *testing.T) {
		stockRepo := newFakeStockRepository()
		stockRepo.rows["product-1"] = &domain.Stock{ProductID: "product-1", Quantity: 10}
		processedRepo := newFakeProcessedEventRepository()
		publisher := newFakeEventPublisher()
		uc := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

		envelope := newOrderCreatedEnvelope(
			"correlation-1",
			domain.OrderCreatedItem{ProductID: "product-1", Quantity: 3},
		)

		if err := uc.Execute(context.Background(), envelope); err != nil {
			t.Fatalf("first Execute() error = %v, want nil", err)
		}

		if err := uc.Execute(context.Background(), envelope); err != nil {
			t.Fatalf("second Execute() error = %v, want nil", err)
		}

		if got := stockRepo.rows["product-1"].Quantity; got != 7 {
			t.Errorf("product-1 quantity = %d, want 7 (unchanged after redelivery)", got)
		}

		if len(publisher.published) != 1 {
			t.Fatalf("published events = %d, want 1 (no second round of publishes)", len(publisher.published))
		}
	})

	t.Run("skips a line item with non-positive quantity instead of decrementing", func(t *testing.T) {
		stockRepo := newFakeStockRepository()
		stockRepo.rows["product-1"] = &domain.Stock{ProductID: "product-1", Quantity: 10}
		processedRepo := newFakeProcessedEventRepository()
		publisher := newFakeEventPublisher()
		uc := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

		envelope := newOrderCreatedEnvelope(
			"correlation-1",
			domain.OrderCreatedItem{ProductID: "product-1", Quantity: 0},
			domain.OrderCreatedItem{ProductID: "product-1", Quantity: -5},
		)

		if err := uc.Execute(context.Background(), envelope); err != nil {
			t.Fatalf("Execute() error = %v, want nil", err)
		}

		if got := stockRepo.rows["product-1"].Quantity; got != 10 {
			t.Errorf("product-1 quantity = %d, want unchanged 10 (negative delta must never increase stock)", got)
		}

		if len(publisher.published) != 0 {
			t.Fatalf("published events = %d, want 0 (nothing decremented)", len(publisher.published))
		}
	})
}

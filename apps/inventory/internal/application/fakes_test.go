package application_test

import (
	"context"
	"time"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// fakeStockRepository is a small in-memory StockRepository for tests.
type fakeStockRepository struct {
	rows map[string]*domain.Stock
}

func newFakeStockRepository() *fakeStockRepository {
	return &fakeStockRepository{rows: map[string]*domain.Stock{}}
}

func (r *fakeStockRepository) GetByProductID(_ context.Context, productID string) (*domain.Stock, error) {
	stock, ok := r.rows[productID]
	if !ok {
		return nil, nil
	}

	copied := *stock

	return &copied, nil
}

func (r *fakeStockRepository) SetQuantity(_ context.Context, productID string, quantity int) (*domain.Stock, error) {
	now := time.Now()

	existing, ok := r.rows[productID]
	createdAt := now
	if ok {
		createdAt = existing.CreatedAt
	}

	stock := &domain.Stock{
		ProductID: productID,
		Quantity:  quantity,
		CreatedAt: createdAt,
		UpdatedAt: now,
	}
	r.rows[productID] = stock

	copied := *stock

	return &copied, nil
}

func (r *fakeStockRepository) DecrementQuantity(_ context.Context, productID string, delta int) (*domain.Stock, error) {
	now := time.Now()

	existing, ok := r.rows[productID]
	current := 0
	createdAt := now
	if ok {
		current = existing.Quantity
		createdAt = existing.CreatedAt
	}

	next := current - delta
	if next < 0 {
		next = 0
	}

	stock := &domain.Stock{
		ProductID: productID,
		Quantity:  next,
		CreatedAt: createdAt,
		UpdatedAt: now,
	}
	r.rows[productID] = stock

	copied := *stock

	return &copied, nil
}

// fakeProcessedEventRepository is a small in-memory
// ProcessedEventRepository for tests.
type fakeProcessedEventRepository struct {
	processed map[string]bool
}

func newFakeProcessedEventRepository() *fakeProcessedEventRepository {
	return &fakeProcessedEventRepository{processed: map[string]bool{}}
}

func (r *fakeProcessedEventRepository) TryClaim(_ context.Context, correlationID string) (bool, error) {
	if r.processed[correlationID] {
		return false, nil
	}

	r.processed[correlationID] = true

	return true, nil
}

// publishedEvent records a single call recorded by fakeEventPublisher.
type publishedEvent struct {
	Event         string
	CorrelationID string
	Data          any
}

// fakeEventPublisher is a small in-memory EventPublisher for tests.
type fakeEventPublisher struct {
	published []publishedEvent
}

func newFakeEventPublisher() *fakeEventPublisher {
	return &fakeEventPublisher{published: []publishedEvent{}}
}

func (p *fakeEventPublisher) Publish(_ context.Context, event string, correlationID string, data any) error {
	p.published = append(p.published, publishedEvent{
		Event:         event,
		CorrelationID: correlationID,
		Data:          data,
	})

	return nil
}

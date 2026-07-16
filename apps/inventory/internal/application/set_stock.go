package application

import (
	"context"
	"fmt"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// SetStockUseCase sets the absolute stock quantity for a product,
// creating the row if it does not already exist (upsert).
type SetStockUseCase struct {
	stockRepo StockRepository
}

// NewSetStockUseCase constructs a SetStockUseCase.
func NewSetStockUseCase(stockRepo StockRepository) *SetStockUseCase {
	return &SetStockUseCase{stockRepo: stockRepo}
}

// Execute sets productID's stock to quantity. It returns ErrInvalidQuantity
// if quantity is negative, without calling the repository.
func (uc *SetStockUseCase) Execute(ctx context.Context, productID string, quantity int) (*domain.Stock, error) {
	if quantity < 0 {
		return nil, ErrInvalidQuantity
	}

	stock, err := uc.stockRepo.SetQuantity(ctx, productID, quantity)
	if err != nil {
		return nil, fmt.Errorf("set stock for product %q to %d: %w", productID, quantity, err)
	}

	return stock, nil
}

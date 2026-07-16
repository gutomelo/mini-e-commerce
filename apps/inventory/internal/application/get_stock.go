package application

import (
	"context"
	"fmt"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// GetStockUseCase retrieves the current stock for a product.
type GetStockUseCase struct {
	stockRepo StockRepository
}

// NewGetStockUseCase constructs a GetStockUseCase.
func NewGetStockUseCase(stockRepo StockRepository) *GetStockUseCase {
	return &GetStockUseCase{stockRepo: stockRepo}
}

// Execute returns the stock for productID, or ErrNotFound if no stock row
// exists for it.
func (uc *GetStockUseCase) Execute(ctx context.Context, productID string) (*domain.Stock, error) {
	stock, err := uc.stockRepo.GetByProductID(ctx, productID)
	if err != nil {
		return nil, fmt.Errorf("get stock for product %q: %w", productID, err)
	}

	if stock == nil {
		return nil, ErrNotFound
	}

	return stock, nil
}

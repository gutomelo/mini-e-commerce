package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

func TestGetStockUseCase_Execute(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		repo := newFakeStockRepository()
		repo.rows["product-1"] = &domain.Stock{
			ProductID: "product-1",
			Quantity:  10,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		uc := application.NewGetStockUseCase(repo)

		stock, err := uc.Execute(context.Background(), "product-1")
		if err != nil {
			t.Fatalf("Execute() error = %v, want nil", err)
		}

		if stock.Quantity != 10 {
			t.Errorf("Quantity = %d, want 10", stock.Quantity)
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := newFakeStockRepository()
		uc := application.NewGetStockUseCase(repo)

		_, err := uc.Execute(context.Background(), "unknown")
		if !errors.Is(err, application.ErrNotFound) {
			t.Fatalf("Execute() error = %v, want ErrNotFound", err)
		}
	})
}

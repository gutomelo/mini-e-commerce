package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
)

func TestSetStockUseCase_Execute(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newFakeStockRepository()
		uc := application.NewSetStockUseCase(repo)

		stock, err := uc.Execute(context.Background(), "product-1", 20)
		if err != nil {
			t.Fatalf("Execute() error = %v, want nil", err)
		}

		if stock.Quantity != 20 {
			t.Errorf("Quantity = %d, want 20", stock.Quantity)
		}
	})

	t.Run("negative quantity rejected", func(t *testing.T) {
		repo := newFakeStockRepository()
		uc := application.NewSetStockUseCase(repo)

		_, err := uc.Execute(context.Background(), "product-1", -1)
		if !errors.Is(err, application.ErrInvalidQuantity) {
			t.Fatalf("Execute() error = %v, want ErrInvalidQuantity", err)
		}

		if _, ok := repo.rows["product-1"]; ok {
			t.Error("repository should not have been written to on validation failure")
		}
	})
}

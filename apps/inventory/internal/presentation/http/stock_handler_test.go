package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
	presentationhttp "github.com/gmsoftware/mini-e-commerce/inventory/internal/presentation/http"
)

// fakeStockRepository is a minimal in-memory application.StockRepository
// used to exercise StockHandler without a real database.
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

	return stock, nil
}

func (r *fakeStockRepository) SetQuantity(_ context.Context, productID string, quantity int) (*domain.Stock, error) {
	stock := &domain.Stock{ProductID: productID, Quantity: quantity, UpdatedAt: time.Now()}
	r.rows[productID] = stock

	return stock, nil
}

func (r *fakeStockRepository) DecrementQuantity(_ context.Context, productID string, delta int) (*domain.Stock, error) {
	current := 0
	if stock, ok := r.rows[productID]; ok {
		current = stock.Quantity
	}

	next := current - delta
	if next < 0 {
		next = 0
	}

	stock := &domain.Stock{ProductID: productID, Quantity: next, UpdatedAt: time.Now()}
	r.rows[productID] = stock

	return stock, nil
}

func newTestStockHandler(repo application.StockRepository) *presentationhttp.StockHandler {
	getStock := application.NewGetStockUseCase(repo)
	setStock := application.NewSetStockUseCase(repo)

	return presentationhttp.NewStockHandler(getStock, setStock)
}

func TestStockHandlerGet(t *testing.T) {
	t.Parallel()

	const knownID = "11111111-1111-1111-1111-111111111111"
	const unknownID = "22222222-2222-2222-2222-222222222222"

	tests := []struct {
		name       string
		productID  string
		seed       bool
		wantStatus int
	}{
		{name: "known product returns 200", productID: knownID, seed: true, wantStatus: http.StatusOK},
		{name: "unknown product returns 404", productID: unknownID, seed: false, wantStatus: http.StatusNotFound},
		{name: "malformed product id returns 400", productID: "not-a-uuid", seed: false, wantStatus: http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := newFakeStockRepository()
			if tt.seed {
				repo.rows[tt.productID] = &domain.Stock{ProductID: tt.productID, Quantity: 5}
			}

			handler := newTestStockHandler(repo)

			mux := http.NewServeMux()
			mux.HandleFunc("GET /internal/v1/stock/{productId}", handler.Get)

			req := httptest.NewRequest(http.MethodGet, "/internal/v1/stock/"+tt.productID, nil)
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
		})
	}
}

func TestStockHandlerSet(t *testing.T) {
	t.Parallel()

	const productID = "33333333-3333-3333-3333-333333333333"

	tests := []struct {
		name       string
		productID  string
		body       string
		wantStatus int
	}{
		{name: "valid quantity returns 200", productID: productID, body: `{"quantity": 5}`, wantStatus: http.StatusOK},
		{name: "negative quantity returns 400", productID: productID, body: `{"quantity": -1}`, wantStatus: http.StatusBadRequest},
		{name: "malformed body returns 400", productID: productID, body: `not-json`, wantStatus: http.StatusBadRequest},
		{name: "malformed product id returns 400", productID: "not-a-uuid", body: `{"quantity": 5}`, wantStatus: http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := newFakeStockRepository()
			handler := newTestStockHandler(repo)

			mux := http.NewServeMux()
			mux.HandleFunc("PATCH /internal/v1/stock/{productId}", handler.Set)

			req := httptest.NewRequest(http.MethodPatch, "/internal/v1/stock/"+tt.productID, bytes.NewBufferString(tt.body))
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body: %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}

			if tt.wantStatus != http.StatusOK {
				return
			}

			var got struct {
				Quantity int `json:"quantity"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
				t.Fatalf("decode response: %v", err)
			}

			if got.Quantity != 5 {
				t.Fatalf("quantity = %d, want 5", got.Quantity)
			}
		})
	}
}

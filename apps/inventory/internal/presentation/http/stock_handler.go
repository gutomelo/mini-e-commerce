package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// stockResponse is the JSON shape returned by both stock endpoints.
type stockResponse struct {
	ProductID string    `json:"productId"`
	Quantity  int       `json:"quantity"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// setStockRequest is the PATCH endpoint's request body. Quantity is a
// pointer so a missing field is distinguishable from an explicit zero.
type setStockRequest struct {
	Quantity *int `json:"quantity"`
}

// StockHandler exposes the stock query/update use cases over HTTP.
type StockHandler struct {
	getStock *application.GetStockUseCase
	setStock *application.SetStockUseCase
}

// NewStockHandler constructs a StockHandler.
func NewStockHandler(getStock *application.GetStockUseCase, setStock *application.SetStockUseCase) *StockHandler {
	return &StockHandler{getStock: getStock, setStock: setStock}
}

// Get handles GET /internal/v1/stock/{productId}.
func (h *StockHandler) Get(w http.ResponseWriter, r *http.Request) {
	productID := r.PathValue("productId")
	if !isValidUUID(productID) {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	stock, err := h.getStock.Execute(r.Context(), productID)
	if err != nil {
		if errors.Is(err, application.ErrNotFound) {
			writeError(w, http.StatusNotFound, "stock not found")
			return
		}

		slog.Error(
			"stock handler: get stock",
			"productId", productID,
			"correlationId", CorrelationIDFromContext(r.Context()),
			"error", err,
		)
		writeError(w, http.StatusInternalServerError, "internal error")

		return
	}

	writeJSON(w, http.StatusOK, toStockResponse(stock))
}

// Set handles PATCH /internal/v1/stock/{productId}.
func (h *StockHandler) Set(w http.ResponseWriter, r *http.Request) {
	productID := r.PathValue("productId")
	if !isValidUUID(productID) {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	var body setStockRequest

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if body.Quantity == nil {
		writeError(w, http.StatusBadRequest, "quantity is required")
		return
	}

	stock, err := h.setStock.Execute(r.Context(), productID, *body.Quantity)
	if err != nil {
		if errors.Is(err, application.ErrInvalidQuantity) {
			writeError(w, http.StatusBadRequest, "quantity must be >= 0")
			return
		}

		slog.Error(
			"stock handler: set stock",
			"productId", productID,
			"correlationId", CorrelationIDFromContext(r.Context()),
			"error", err,
		)
		writeError(w, http.StatusInternalServerError, "internal error")

		return
	}

	writeJSON(w, http.StatusOK, toStockResponse(stock))
}

// toStockResponse maps a domain.Stock to its wire representation.
func toStockResponse(stock *domain.Stock) stockResponse {
	return stockResponse{
		ProductID: stock.ProductID,
		Quantity:  stock.Quantity,
		UpdatedAt: stock.UpdatedAt,
	}
}

// Package postgres holds database/sql-backed implementations of the
// application layer's persistence ports, built on the pgx/v5 stdlib driver
// (the same driver cmd/migrate already uses, for a single Postgres access
// style across the service).
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
)

// PostgresStockRepository implements application.StockRepository against
// the mini_ecommerce_inventory database's stock table. The connection's
// lifecycle (opening, pooling, closing) is the caller's responsibility;
// this type only ever reads db, it never closes it.
type PostgresStockRepository struct {
	db *sql.DB
}

// NewPostgresStockRepository constructs a PostgresStockRepository around an
// already-open *sql.DB.
func NewPostgresStockRepository(db *sql.DB) *PostgresStockRepository {
	return &PostgresStockRepository{db: db}
}

// GetByProductID returns the stock row for productID, or (nil, nil) if no
// row exists, per the StockRepository port's documented not-found contract.
func (r *PostgresStockRepository) GetByProductID(ctx context.Context, productID string) (*domain.Stock, error) {
	const query = `
		SELECT product_id, quantity, created_at, updated_at
		FROM stock
		WHERE product_id = $1::uuid
	`

	stock, err := scanStock(r.db.QueryRowContext(ctx, query, productID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("get stock for product %q: %w", productID, err)
	}

	return stock, nil
}

// SetQuantity upserts the stock row for productID to the given absolute
// quantity, creating the row if it does not already exist.
func (r *PostgresStockRepository) SetQuantity(ctx context.Context, productID string, quantity int) (*domain.Stock, error) {
	const query = `
		INSERT INTO stock (product_id, quantity, created_at, updated_at)
		VALUES ($1::uuid, $2, now(), now())
		ON CONFLICT (product_id) DO UPDATE
		SET quantity = EXCLUDED.quantity, updated_at = now()
		RETURNING product_id, quantity, created_at, updated_at
	`

	stock, err := scanStock(r.db.QueryRowContext(ctx, query, productID, quantity))
	if err != nil {
		return nil, fmt.Errorf("set quantity for product %q: %w", productID, err)
	}

	return stock, nil
}

// DecrementQuantity reduces the stock row for productID by delta, clamped
// at zero. It is a single upsert statement rather than a read-then-write
// sequence, so concurrent decrements against the same product serialize on
// the row lock Postgres already takes for the INSERT ... ON CONFLICT DO
// UPDATE, instead of racing on a separate read. If no row exists yet, the
// insert branch starts from an assumed zero baseline before clamping, so a
// decrement against an unknown product creates a zero-or-clamped row rather
// than erroring — matching the port's documented contract.
func (r *PostgresStockRepository) DecrementQuantity(ctx context.Context, productID string, delta int) (*domain.Stock, error) {
	const query = `
		INSERT INTO stock (product_id, quantity, created_at, updated_at)
		VALUES ($1::uuid, GREATEST(0, 0 - $2), now(), now())
		ON CONFLICT (product_id) DO UPDATE
		SET quantity = GREATEST(0, stock.quantity - $2), updated_at = now()
		RETURNING product_id, quantity, created_at, updated_at
	`

	stock, err := scanStock(r.db.QueryRowContext(ctx, query, productID, delta))
	if err != nil {
		return nil, fmt.Errorf("decrement quantity for product %q: %w", productID, err)
	}

	return stock, nil
}

// rowScanner is satisfied by both *sql.Row and *sql.Rows, letting scanStock
// serve either a QueryRowContext or a future QueryContext caller.
type rowScanner interface {
	Scan(dest ...any) error
}

// scanStock scans a single stock row (product_id, quantity, created_at,
// updated_at, in that order) from row.
func scanStock(row rowScanner) (*domain.Stock, error) {
	var stock domain.Stock

	err := row.Scan(&stock.ProductID, &stock.Quantity, &stock.CreatedAt, &stock.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &stock, nil
}

package postgres_test

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/postgres"
)

// openTestDB opens a connection to INVENTORY_DATABASE_URL and skips the
// calling test if it is not set, so `go test ./...` does not hard-fail in
// an environment with no Postgres available (e.g. CI without the compose
// stack running). Run `docker compose up -d --wait postgres` and
// `go run ./cmd/migrate` against that database before running these tests
// locally.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	databaseURL := os.Getenv("INVENTORY_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("INVENTORY_DATABASE_URL not set, skipping Postgres-backed test")
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}

	t.Cleanup(func() { _ = db.Close() })

	if err := db.Ping(); err != nil {
		t.Fatalf("ping database: %v", err)
	}

	return db
}

// newTestProductID returns a fresh, random UUID-shaped id for each test, so
// tests never collide with each other or with rows left behind by a
// previous run.
func newTestProductID(t *testing.T) string {
	t.Helper()

	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("generate random product id: %v", err)
	}

	// Set the version (4) and variant bits per RFC 4122 so the value is a
	// well-formed UUID the `product_id UUID` column accepts.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func TestPostgresStockRepository(t *testing.T) {
	db := openTestDB(t)
	repo := postgres.NewPostgresStockRepository(db)
	ctx := context.Background()

	t.Run("GetByProductID returns nil, nil for an unknown product", func(t *testing.T) {
		stock, err := repo.GetByProductID(ctx, newTestProductID(t))
		if err != nil {
			t.Fatalf("GetByProductID() error = %v, want nil", err)
		}

		if stock != nil {
			t.Fatalf("GetByProductID() = %+v, want nil", stock)
		}
	})

	t.Run("SetQuantity then GetByProductID round-trips", func(t *testing.T) {
		productID := newTestProductID(t)

		set, err := repo.SetQuantity(ctx, productID, 42)
		if err != nil {
			t.Fatalf("SetQuantity() error = %v, want nil", err)
		}

		if set.Quantity != 42 {
			t.Fatalf("SetQuantity() quantity = %d, want 42", set.Quantity)
		}

		got, err := repo.GetByProductID(ctx, productID)
		if err != nil {
			t.Fatalf("GetByProductID() error = %v, want nil", err)
		}

		if got == nil || got.Quantity != 42 {
			t.Fatalf("GetByProductID() = %+v, want quantity 42", got)
		}
	})

	t.Run("SetQuantity overwrites an existing row", func(t *testing.T) {
		productID := newTestProductID(t)

		if _, err := repo.SetQuantity(ctx, productID, 10); err != nil {
			t.Fatalf("SetQuantity() error = %v, want nil", err)
		}

		updated, err := repo.SetQuantity(ctx, productID, 5)
		if err != nil {
			t.Fatalf("SetQuantity() error = %v, want nil", err)
		}

		if updated.Quantity != 5 {
			t.Fatalf("SetQuantity() quantity = %d, want 5", updated.Quantity)
		}
	})

	t.Run("DecrementQuantity against an unknown product creates a clamped row", func(t *testing.T) {
		productID := newTestProductID(t)

		stock, err := repo.DecrementQuantity(ctx, productID, 3)
		if err != nil {
			t.Fatalf("DecrementQuantity() error = %v, want nil", err)
		}

		if stock.Quantity != 0 {
			t.Fatalf("DecrementQuantity() quantity = %d, want 0 (clamped)", stock.Quantity)
		}
	})

	t.Run("DecrementQuantity below zero clamps at zero", func(t *testing.T) {
		productID := newTestProductID(t)

		if _, err := repo.SetQuantity(ctx, productID, 2); err != nil {
			t.Fatalf("SetQuantity() error = %v, want nil", err)
		}

		stock, err := repo.DecrementQuantity(ctx, productID, 10)
		if err != nil {
			t.Fatalf("DecrementQuantity() error = %v, want nil", err)
		}

		if stock.Quantity != 0 {
			t.Fatalf("DecrementQuantity() quantity = %d, want 0 (clamped)", stock.Quantity)
		}
	})

	t.Run("DecrementQuantity reduces quantity without going negative", func(t *testing.T) {
		productID := newTestProductID(t)

		if _, err := repo.SetQuantity(ctx, productID, 10); err != nil {
			t.Fatalf("SetQuantity() error = %v, want nil", err)
		}

		stock, err := repo.DecrementQuantity(ctx, productID, 4)
		if err != nil {
			t.Fatalf("DecrementQuantity() error = %v, want nil", err)
		}

		if stock.Quantity != 6 {
			t.Fatalf("DecrementQuantity() quantity = %d, want 6", stock.Quantity)
		}
	})
}

func TestPostgresProcessedEventRepository(t *testing.T) {
	db := openTestDB(t)
	repo := postgres.NewPostgresProcessedEventRepository(db)
	ctx := context.Background()

	t.Run("IsProcessed is false for an unknown correlation id", func(t *testing.T) {
		processed, err := repo.IsProcessed(ctx, newTestProductID(t))
		if err != nil {
			t.Fatalf("IsProcessed() error = %v, want nil", err)
		}

		if processed {
			t.Fatal("IsProcessed() = true, want false")
		}
	})

	t.Run("MarkProcessed then IsProcessed reflects reality", func(t *testing.T) {
		correlationID := newTestProductID(t)

		if err := repo.MarkProcessed(ctx, correlationID); err != nil {
			t.Fatalf("MarkProcessed() error = %v, want nil", err)
		}

		processed, err := repo.IsProcessed(ctx, correlationID)
		if err != nil {
			t.Fatalf("IsProcessed() error = %v, want nil", err)
		}

		if !processed {
			t.Fatal("IsProcessed() = false, want true")
		}
	})

	t.Run("MarkProcessed twice with the same id does not error", func(t *testing.T) {
		correlationID := newTestProductID(t)

		if err := repo.MarkProcessed(ctx, correlationID); err != nil {
			t.Fatalf("first MarkProcessed() error = %v, want nil", err)
		}

		if err := repo.MarkProcessed(ctx, correlationID); err != nil {
			t.Fatalf("second MarkProcessed() error = %v, want nil", err)
		}
	})
}

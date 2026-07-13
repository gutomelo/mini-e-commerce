package postgres

import (
	"context"
	"database/sql"
	"fmt"
)

// PostgresProcessedEventRepository implements
// application.ProcessedEventRepository against the mini_ecommerce_inventory
// database's processed_events table.
type PostgresProcessedEventRepository struct {
	db *sql.DB
}

// NewPostgresProcessedEventRepository constructs a
// PostgresProcessedEventRepository around an already-open *sql.DB.
func NewPostgresProcessedEventRepository(db *sql.DB) *PostgresProcessedEventRepository {
	return &PostgresProcessedEventRepository{db: db}
}

// IsProcessed reports whether an event with the given correlation ID has
// already been recorded as processed.
func (r *PostgresProcessedEventRepository) IsProcessed(ctx context.Context, correlationID string) (bool, error) {
	const query = `SELECT EXISTS (SELECT 1 FROM processed_events WHERE correlation_id = $1)`

	var exists bool

	if err := r.db.QueryRowContext(ctx, query, correlationID).Scan(&exists); err != nil {
		return false, fmt.Errorf("check processed state for correlation %q: %w", correlationID, err)
	}

	return exists, nil
}

// MarkProcessed records the given correlation ID as processed. Calling it
// twice with the same id is safe and does not error — the use case's own
// upfront IsProcessed check should prevent that in practice, but the
// ON CONFLICT DO NOTHING here is cheap defense in depth.
func (r *PostgresProcessedEventRepository) MarkProcessed(ctx context.Context, correlationID string) error {
	const query = `
		INSERT INTO processed_events (correlation_id)
		VALUES ($1)
		ON CONFLICT (correlation_id) DO NOTHING
	`

	if _, err := r.db.ExecContext(ctx, query, correlationID); err != nil {
		return fmt.Errorf("mark correlation %q processed: %w", correlationID, err)
	}

	return nil
}

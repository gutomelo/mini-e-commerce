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

// TryClaim atomically inserts correlationID into processed_events and
// reports whether this call performed the insert. A single
// INSERT ... ON CONFLICT DO NOTHING is what makes this atomic: Postgres
// serializes concurrent inserts of the same key at the row level, so of
// two concurrent callers claiming the same correlationID, exactly one
// gets rows-affected = 1 (claimed) and the other gets 0 (already claimed)
// — there is no separate read-then-write window for both to race through.
func (r *PostgresProcessedEventRepository) TryClaim(ctx context.Context, correlationID string) (bool, error) {
	const query = `
		INSERT INTO processed_events (correlation_id)
		VALUES ($1)
		ON CONFLICT (correlation_id) DO NOTHING
	`

	result, err := r.db.ExecContext(ctx, query, correlationID)
	if err != nil {
		return false, fmt.Errorf("claim correlation %q: %w", correlationID, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read rows affected for correlation %q: %w", correlationID, err)
	}

	return rowsAffected > 0, nil
}

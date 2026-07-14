CREATE TABLE processed_events (
    correlation_id TEXT PRIMARY KEY,
    processed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

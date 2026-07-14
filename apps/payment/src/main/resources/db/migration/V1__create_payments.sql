CREATE TABLE payments (
    id                UUID PRIMARY KEY,
    order_id          TEXT NOT NULL UNIQUE,
    amount_cents      INTEGER NOT NULL,
    status            TEXT NOT NULL,
    gateway_reference TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

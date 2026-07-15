// Command server runs the inventory service HTTP server.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/fake"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/postgres"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/qstash"
	presentationhttp "github.com/gmsoftware/mini-e-commerce/inventory/internal/presentation/http"
)

const (
	defaultPort        = "8081"
	shutdownTimeout    = 10 * time.Second
	dbConnectTimeout   = 5 * time.Second
	defaultDatabaseURL = "postgresql://postgres:change-me@localhost:5433/mini_ecommerce_inventory"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("inventory: %v", err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := openDatabase(ctx)
	if err != nil {
		return fmt.Errorf("opening database: %w", err)
	}
	defer db.Close()

	mux, err := newMux(db)
	if err != nil {
		return fmt.Errorf("building routes: %w", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		log.Printf("inventory: listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- fmt.Errorf("serving on %s: %w", srv.Addr, err)
		}
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	log.Print("inventory: shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutting down server: %w", err)
	}

	return nil
}

// openDatabase opens the Postgres connection pool used by the repository
// adapters and verifies connectivity with a bounded-time ping. Reads
// INVENTORY_DATABASE_URL the same way cmd/migrate does, including the same
// local-dev fallback default, so both commands agree on where the database
// lives when the env var is unset.
func openDatabase(ctx context.Context) (*sql.DB, error) {
	databaseURL := os.Getenv("INVENTORY_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = defaultDatabaseURL
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("opening connection pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, dbConnectTimeout)
	defer cancel()

	if err := db.PingContext(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return db, nil
}

// newMux wires the persistence adapters, use cases, and HTTP handlers
// together and registers every route (including the pre-existing
// GET /health) on a fresh http.ServeMux.
//
// EventPublisher choice: which adapter backs the event publisher is a
// runtime choice driven by EVENT_PUBLISHER_MODE (see newEventPublisher) —
// "real" delivers inventory.updated to Upstash QStash, anything else
// (including unset) keeps the in-memory fake so local runs and tests don't
// need network access or a QStash destination.
func newMux(db *sql.DB) (*http.ServeMux, error) {
	stockRepo := postgres.NewPostgresStockRepository(db)
	processedRepo := postgres.NewPostgresProcessedEventRepository(db)

	internalAPIKey := os.Getenv("INTERNAL_API_KEY")
	if internalAPIKey == "" {
		return nil, errors.New("INTERNAL_API_KEY must be set")
	}

	currentSigningKey := os.Getenv("QSTASH_CURRENT_SIGNING_KEY")
	nextSigningKey := os.Getenv("QSTASH_NEXT_SIGNING_KEY")
	verifier := qstash.NewSignatureVerifier(currentSigningKey, nextSigningKey)

	// destinationURL must match exactly what QStash was told to deliver to;
	// see QSTASH_DESTINATION_URL in the deployment env vars. It is also the
	// destination the real event publisher posts outbound events to.
	destinationURL := os.Getenv("QSTASH_DESTINATION_URL")

	publisher := newEventPublisher(os.Getenv("EVENT_PUBLISHER_MODE"), destinationURL, os.Getenv("QSTASH_TOKEN"))

	getStock := application.NewGetStockUseCase(stockRepo)
	setStock := application.NewSetStockUseCase(stockRepo)
	consumeOrderCreated := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

	stockHandler := presentationhttp.NewStockHandler(getStock, setStock)
	qstashHandler := presentationhttp.NewQStashHandler(verifier, consumeOrderCreated, destinationURL)
	requireInternalAPIKey := presentationhttp.RequireInternalAPIKey(internalAPIKey)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)

	// The QStash webhook authenticates via the Upstash-Signature header
	// (verified inside qstashHandler.Handle), not the shared internal API
	// key — QStash itself has no way to send that header — so it is
	// registered without requireInternalAPIKey. Its correlation id comes
	// from the event envelope (see qstashHandler.Handle), not an HTTP
	// header, so it does not use presentationhttp.WithCorrelationID either.
	mux.HandleFunc("POST /internal/v1/events/qstash", qstashHandler.Handle)

	mux.Handle(
		"GET /internal/v1/stock/{productId}",
		presentationhttp.WithCorrelationID(requireInternalAPIKey(http.HandlerFunc(stockHandler.Get))),
	)
	mux.Handle(
		"PATCH /internal/v1/stock/{productId}",
		presentationhttp.WithCorrelationID(requireInternalAPIKey(http.HandlerFunc(stockHandler.Set))),
	)

	return mux, nil
}

// realEventPublisherMode is the only EVENT_PUBLISHER_MODE value that
// selects the real qstash.EventPublisher; every other value — including
// unset, empty, or a typo — falls back to the in-memory fake so a
// misconfigured environment never silently starts delivering real events.
const realEventPublisherMode = "real"

// newEventPublisher selects the EventPublisher adapter based on mode.
// destinationURL and token are only used when mode is "real"; the fake
// adapter ignores them.
func newEventPublisher(mode, destinationURL, token string) application.EventPublisher {
	if mode == realEventPublisherMode {
		return qstash.NewEventPublisher(destinationURL, token)
	}

	return fake.NewEventPublisher()
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok","service":"inventory"}`))
}

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
// EventPublisher choice: the in-memory fake.EventPublisher is used here
// rather than qstash.EventPublisher. The real publisher needs a destination
// URL and QSTASH_TOKEN to actually deliver inventory.updated to Upstash, and
// nothing yet subscribes to that event (per the phase spec's non-goals), so
// wiring the live HTTP client here would add a hard dependency on
// Upstash/network access for local runs without any consumer to observe the
// result. Swapping in qstash.NewEventPublisher(destination, token) is a
// one-line change once a real destination is needed.
func newMux(db *sql.DB) (*http.ServeMux, error) {
	stockRepo := postgres.NewPostgresStockRepository(db)
	processedRepo := postgres.NewPostgresProcessedEventRepository(db)
	publisher := fake.NewEventPublisher()

	getStock := application.NewGetStockUseCase(stockRepo)
	setStock := application.NewSetStockUseCase(stockRepo)
	consumeOrderCreated := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

	internalAPIKey := os.Getenv("INTERNAL_API_KEY")
	if internalAPIKey == "" {
		return nil, errors.New("INTERNAL_API_KEY must be set")
	}

	currentSigningKey := os.Getenv("QSTASH_CURRENT_SIGNING_KEY")
	nextSigningKey := os.Getenv("QSTASH_NEXT_SIGNING_KEY")
	verifier := qstash.NewSignatureVerifier(currentSigningKey, nextSigningKey)

	// destinationURL must match exactly what QStash was told to deliver to;
	// see QSTASH_DESTINATION_URL in the deployment env vars.
	destinationURL := os.Getenv("QSTASH_DESTINATION_URL")

	stockHandler := presentationhttp.NewStockHandler(getStock, setStock)
	qstashHandler := presentationhttp.NewQStashHandler(verifier, consumeOrderCreated, destinationURL)
	requireInternalAPIKey := presentationhttp.RequireInternalAPIKey(internalAPIKey)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)

	// The QStash webhook authenticates via the Upstash-Signature header
	// (verified inside qstashHandler.Handle), not the shared internal API
	// key — QStash itself has no way to send that header — so it is
	// registered without requireInternalAPIKey.
	mux.HandleFunc("POST /internal/v1/events/qstash", qstashHandler.Handle)

	mux.Handle("GET /internal/v1/stock/{productId}", requireInternalAPIKey(http.HandlerFunc(stockHandler.Get)))
	mux.Handle("PATCH /internal/v1/stock/{productId}", requireInternalAPIKey(http.HandlerFunc(stockHandler.Set)))

	return mux, nil
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok","service":"inventory"}`))
}

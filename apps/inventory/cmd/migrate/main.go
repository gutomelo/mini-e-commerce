// Command migrate ensures the inventory database exists and applies every
// pending golang-migrate migration to it. It is safe to run repeatedly:
// with no new migrations pending, it exits 0 without making changes.
package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/gmsoftware/mini-e-commerce/inventory/migrations"
)

// defaultDatabaseURL matches the local dev default documented in
// .env.example for INVENTORY_DATABASE_URL.
const defaultDatabaseURL = "postgresql://postgres:change-me@localhost:5433/mini_ecommerce_inventory"

func main() {
	if err := run(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
}

func run() error {
	databaseURL := os.Getenv("INVENTORY_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = defaultDatabaseURL
	}

	if err := ensureDatabaseExists(databaseURL); err != nil {
		return fmt.Errorf("ensuring database exists: %w", err)
	}

	if err := applyMigrations(databaseURL); err != nil {
		return fmt.Errorf("applying migrations: %w", err)
	}

	log.Print("migrate: database ready, migrations up to date")

	return nil
}

// ensureDatabaseExists connects to the "postgres" maintenance database on
// the same host/credentials as databaseURL and creates the target database
// if it does not already exist. Postgres has no CREATE DATABASE IF NOT
// EXISTS, so this does a check-then-create, mirroring the pattern
// apps/api's own e2e test suite uses for its test database.
func ensureDatabaseExists(databaseURL string) error {
	target, err := url.Parse(databaseURL)
	if err != nil {
		return fmt.Errorf("parsing database URL: %w", err)
	}

	dbName := strings.TrimPrefix(target.Path, "/")
	if dbName == "" {
		return errors.New("database URL has no database name")
	}

	maintenanceURL := *target
	maintenanceURL.Path = "/postgres"

	db, err := sql.Open("pgx", maintenanceURL.String())
	if err != nil {
		return fmt.Errorf("opening maintenance connection: %w", err)
	}
	defer db.Close()

	var exists int

	err = db.QueryRow("SELECT 1 FROM pg_database WHERE datname = $1", dbName).Scan(&exists)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		// dbName comes from our own env-configured connection string, not
		// user input, so building the statement with fmt is safe here;
		// CREATE DATABASE cannot be parameterized.
		if _, err := db.Exec(fmt.Sprintf("CREATE DATABASE %q", dbName)); err != nil {
			return fmt.Errorf("creating database %q: %w", dbName, err)
		}

		log.Printf("migrate: created database %q", dbName)
	case err != nil:
		return fmt.Errorf("checking database existence: %w", err)
	}

	return nil
}

// applyMigrations runs every pending migration embedded in the migrations
// package against databaseURL.
func applyMigrations(databaseURL string) error {
	sourceDriver, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("loading embedded migrations: %w", err)
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("opening database connection: %w", err)
	}
	defer db.Close()

	dbDriver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("creating postgres driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		return fmt.Errorf("creating migrator: %w", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("running migrations: %w", err)
	}

	return nil
}

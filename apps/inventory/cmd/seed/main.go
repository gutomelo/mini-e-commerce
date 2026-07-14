// Command seed ensures every product from apps/api's known catalog fixture
// has a stock row in the inventory database, with a default starting
// quantity. It is independent of apps/api's own Prisma seed but depends on
// it having already run: this command resolves each fixture's stable slug
// to apps/api's (dynamically generated) product id by calling apps/api's
// public GET /api/v1/products endpoint, then upserts a stock row per
// resolved id. Rerunning it is always safe: SetQuantity is an upsert, and
// an unresolved slug is logged as a warning and skipped rather than
// failing the whole run.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/catalog"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/postgres"
)

// defaultAPIBaseURL matches the local dev default documented in
// .env.example for API_BASE_URL.
const defaultAPIBaseURL = "http://localhost:3001"

// defaultDatabaseURL matches the local dev default documented in
// .env.example for INVENTORY_DATABASE_URL (the same default cmd/migrate
// uses).
const defaultDatabaseURL = "postgresql://postgres:change-me@localhost:5433/mini_ecommerce_inventory"

// defaultStockQuantity is the starting quantity applied to every seeded
// product. A single flat default is enough for this project: nothing
// depends on per-product starting stock varying.
const defaultStockQuantity = 50

// requestTimeout bounds each external call this command makes (the
// catalog HTTP request, and each Postgres upsert).
const requestTimeout = 10 * time.Second

// seedSlugs is the fixture list of the 12 products apps/api's
// prisma/seed.ts seeds (see apps/api/prisma/seed.ts). It is keyed by slug,
// not id: apps/api's Product.id is a @default(uuid()) generated fresh on
// every clean database volume, so only slugs are stable across
// environments.
var seedSlugs = []string{
	"wireless-bluetooth-headphones",
	"smart-fitness-watch",
	"portable-bluetooth-speaker",
	"usb-c-charging-hub",
	"classic-cotton-t-shirt",
	"slim-fit-denim-jeans",
	"hooded-fleece-sweatshirt",
	"canvas-low-top-sneakers",
	"stainless-steel-french-press",
	"ceramic-pour-over-coffee-set",
	"bamboo-cutting-board-set",
	"10-inch-cast-iron-skillet",
}

func main() {
	if err := run(); err != nil {
		log.Fatalf("seed: %v", err)
	}
}

func run() error {
	apiBaseURL := os.Getenv("API_BASE_URL")
	if apiBaseURL == "" {
		apiBaseURL = defaultAPIBaseURL
	}

	databaseURL := os.Getenv("INVENTORY_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = defaultDatabaseURL
	}

	slugToID, err := fetchSlugToID(apiBaseURL)
	if err != nil {
		return fmt.Errorf("fetching product catalog from %s: %w", apiBaseURL, err)
	}

	resolved, skipped := resolveProductIDs(seedSlugs, slugToID)
	for _, slug := range skipped {
		log.Printf(
			"seed: WARNING skipping slug %q: not found in apps/api's product catalog "+
				"(has apps/api been seeded yet? was the slug renamed?)",
			slug,
		)
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("opening database connection: %w", err)
	}
	defer db.Close()

	if err := seedStock(db, resolved); err != nil {
		return err
	}

	log.Printf("seed: stock ensured: %d/%d products", len(resolved), len(seedSlugs))

	return nil
}

// fetchSlugToID calls apps/api's product catalog and returns the
// slug-to-id map used to resolve seedSlugs.
func fetchSlugToID(apiBaseURL string) (map[string]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
	defer cancel()

	productClient := catalog.NewProductClient(apiBaseURL)

	return productClient.SlugToID(ctx)
}

// seedStock upserts a stock row (at defaultStockQuantity) for every
// resolved product id.
func seedStock(db *sql.DB, productIDs []string) error {
	stockRepository := postgres.NewPostgresStockRepository(db)

	for _, productID := range productIDs {
		ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
		_, err := stockRepository.SetQuantity(ctx, productID, defaultStockQuantity)
		cancel()

		if err != nil {
			return fmt.Errorf("seeding stock for product %q: %w", productID, err)
		}
	}

	return nil
}

// resolveProductIDs looks up each fixture slug in slugToID, returning the
// resolved ids (one per matched slug) and the list of slugs that had no
// match. A missing slug is not an error: apps/api may not have been
// seeded yet, or a slug may have been renamed, and a partial seed is
// better than none.
func resolveProductIDs(slugs []string, slugToID map[string]string) (resolved, skipped []string) {
	resolved = make([]string, 0, len(slugs))
	skipped = make([]string, 0)

	for _, slug := range slugs {
		id, ok := slugToID[slug]
		if !ok {
			skipped = append(skipped, slug)
			continue
		}

		resolved = append(resolved, id)
	}

	return resolved, skipped
}

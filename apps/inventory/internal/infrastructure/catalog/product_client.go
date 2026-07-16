// Package catalog holds a read-only HTTP client for apps/api's public
// product catalog. It exists solely to resolve product slugs to ids for
// cmd/seed: apps/api's Prisma seed generates product ids dynamically
// (@default(uuid())) on every fresh database volume, so only slugs are
// stable across environments.
package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// productsPath is apps/api's public, unauthenticated product listing
// endpoint — the same one the storefront uses.
const productsPath = "/api/v1/products"

// pageSize is the maximum limit apps/api's ListProductsQueryDto accepts
// (see apps/api/src/presentation/products/dto/list-products-query.dto.ts),
// used to minimize the number of pages fetched.
const pageSize = 100

// defaultTimeout bounds each HTTP call to apps/api when the caller does
// not already scope ctx with its own deadline.
const defaultTimeout = 10 * time.Second

// product is the subset of apps/api's ProductOutput this client needs.
type product struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
}

// listResponse mirrors apps/api's ListResponse<ProductOutput> envelope
// (see apps/api/src/presentation/contracts.ts).
type listResponse struct {
	Data []product `json:"data"`
	Meta struct {
		Page       int `json:"page"`
		Limit      int `json:"limit"`
		Total      int `json:"total"`
		TotalPages int `json:"totalPages"`
	} `json:"meta"`
}

// ProductClient reads apps/api's product catalog over HTTP.
type ProductClient struct {
	baseURL    string
	httpClient *http.Client
}

// Option configures a ProductClient constructed by NewProductClient.
type Option func(*ProductClient)

// WithHTTPClient overrides the default HTTP client (a 10-second timeout).
// It exists so tests can inject a client pointed at an httptest.Server.
func WithHTTPClient(httpClient *http.Client) Option {
	return func(c *ProductClient) { c.httpClient = httpClient }
}

// NewProductClient constructs a ProductClient against baseURL — apps/api's
// API_BASE_URL, e.g. http://api:3001 in-container or http://localhost:3001
// for local dev outside Docker.
func NewProductClient(baseURL string, opts ...Option) *ProductClient {
	c := &ProductClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultTimeout},
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// SlugToID fetches every product from apps/api's catalog and returns a map
// of slug to id. It pages through the endpoint at the server's maximum
// page size (100) rather than assuming the whole catalog fits on one
// page, so it stays correct if the catalog grows past that in the future.
func (c *ProductClient) SlugToID(ctx context.Context) (map[string]string, error) {
	slugToID := map[string]string{}

	for page := 1; ; page++ {
		resp, err := c.fetchPage(ctx, page)
		if err != nil {
			return nil, fmt.Errorf("fetching products page %d: %w", page, err)
		}

		for _, p := range resp.Data {
			slugToID[p.Slug] = p.ID
		}

		if page >= resp.Meta.TotalPages {
			break
		}
	}

	return slugToID, nil
}

// fetchPage requests a single page of the product catalog.
func (c *ProductClient) fetchPage(ctx context.Context, page int) (*listResponse, error) {
	endpoint, err := url.Parse(c.baseURL + productsPath)
	if err != nil {
		return nil, fmt.Errorf("parsing base URL %q: %w", c.baseURL, err)
	}

	query := endpoint.Query()
	query.Set("page", strconv.Itoa(page))
	query.Set("limit", strconv.Itoa(pageSize))
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling %s: %w", endpoint.String(), err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, endpoint.String())
	}

	var out listResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decoding response body from %s: %w", endpoint.String(), err)
	}

	return &out, nil
}

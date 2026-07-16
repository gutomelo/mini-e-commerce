package catalog_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/catalog"
)

// fakeProduct mirrors the fields the ProductClient reads off apps/api's
// ProductOutput.
type fakeProduct struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
}

func TestProductClient_SlugToID_SinglePage(t *testing.T) {
	products := []fakeProduct{
		{ID: "id-1", Slug: "wireless-bluetooth-headphones"},
		{ID: "id-2", Slug: "smart-fitness-watch"},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/products" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		writeListResponse(t, w, products, 1, 1)
	}))
	defer server.Close()

	client := catalog.NewProductClient(server.URL)

	slugToID, err := client.SlugToID(context.Background())
	if err != nil {
		t.Fatalf("SlugToID: %v", err)
	}

	want := map[string]string{
		"wireless-bluetooth-headphones": "id-1",
		"smart-fitness-watch":           "id-2",
	}
	assertEqualMaps(t, want, slugToID)
}

func TestProductClient_SlugToID_Paginates(t *testing.T) {
	pages := [][]fakeProduct{
		{{ID: "id-1", Slug: "slug-1"}},
		{{ID: "id-2", Slug: "slug-2"}},
		{{ID: "id-3", Slug: "slug-3"}},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page, err := strconv.Atoi(r.URL.Query().Get("page"))
		if err != nil || page < 1 || page > len(pages) {
			t.Fatalf("unexpected page query param: %q", r.URL.Query().Get("page"))
		}

		writeListResponse(t, w, pages[page-1], page, len(pages))
	}))
	defer server.Close()

	client := catalog.NewProductClient(server.URL)

	slugToID, err := client.SlugToID(context.Background())
	if err != nil {
		t.Fatalf("SlugToID: %v", err)
	}

	want := map[string]string{
		"slug-1": "id-1",
		"slug-2": "id-2",
		"slug-3": "id-3",
	}
	assertEqualMaps(t, want, slugToID)
}

func TestProductClient_SlugToID_ErrorsOnNonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := catalog.NewProductClient(server.URL)

	if _, err := client.SlugToID(context.Background()); err == nil {
		t.Fatal("expected an error for a non-200 response, got nil")
	}
}

// writeListResponse writes a JSON body shaped like apps/api's
// ListResponse<ProductOutput> envelope.
func writeListResponse(t *testing.T, w http.ResponseWriter, data []fakeProduct, page, totalPages int) {
	t.Helper()

	body := map[string]any{
		"data": data,
		"meta": map[string]any{
			"page":       page,
			"limit":      100,
			"total":      totalPages,
			"totalPages": totalPages,
		},
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(body); err != nil {
		t.Fatalf("encoding response: %v", err)
	}
}

func assertEqualMaps(t *testing.T, want, got map[string]string) {
	t.Helper()

	if len(want) != len(got) {
		t.Fatalf("map length mismatch: want %d, got %d (%v)", len(want), len(got), got)
	}

	for slug, id := range want {
		gotID, ok := got[slug]
		if !ok {
			t.Fatalf("missing slug %q in result: %v", slug, got)
		}

		if gotID != id {
			t.Fatalf("slug %q: want id %q, got %q", slug, id, gotID)
		}
	}
}

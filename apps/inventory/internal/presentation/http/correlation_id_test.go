package http_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	presentationhttp "github.com/gmsoftware/mini-e-commerce/inventory/internal/presentation/http"
)

func TestWithCorrelationIDPreservesProvidedHeader(t *testing.T) {
	t.Parallel()

	const provided = "test-correlation-id"

	var gotFromContext string

	next := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		gotFromContext = presentationhttp.CorrelationIDFromContext(r.Context())
	})

	handler := presentationhttp.WithCorrelationID(next)

	req := httptest.NewRequest(http.MethodGet, "/internal/v1/stock/x", nil)
	req.Header.Set("X-Correlation-Id", provided)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Correlation-Id"); got != provided {
		t.Fatalf("response header = %q, want %q", got, provided)
	}

	if gotFromContext != provided {
		t.Fatalf("context correlation id = %q, want %q", gotFromContext, provided)
	}
}

func TestWithCorrelationIDGeneratesWhenMissing(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := presentationhttp.WithCorrelationID(next)

	req1 := httptest.NewRequest(http.MethodGet, "/internal/v1/stock/x", nil)
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	got1 := rec1.Header().Get("X-Correlation-Id")
	if got1 == "" {
		t.Fatal("expected a generated correlation id, got empty string")
	}

	req2 := httptest.NewRequest(http.MethodGet, "/internal/v1/stock/x", nil)
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	got2 := rec2.Header().Get("X-Correlation-Id")
	if got2 == "" {
		t.Fatal("expected a generated correlation id, got empty string")
	}

	if got1 == got2 {
		t.Fatalf("expected distinct generated correlation ids, both were %q", got1)
	}
}

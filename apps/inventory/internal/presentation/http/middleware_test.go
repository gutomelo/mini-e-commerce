package http_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	presentationhttp "github.com/gmsoftware/mini-e-commerce/inventory/internal/presentation/http"
)

func TestRequireInternalAPIKey(t *testing.T) {
	t.Parallel()

	const expectedKey = "test-internal-key"

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name       string
		headerVal  string
		wantStatus int
		wantNext   bool
	}{
		{name: "missing header returns 401", headerVal: "", wantStatus: http.StatusUnauthorized, wantNext: false},
		{name: "wrong key returns 401", headerVal: "wrong", wantStatus: http.StatusUnauthorized, wantNext: false},
		{name: "correct key calls next", headerVal: expectedKey, wantStatus: http.StatusOK, wantNext: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nextCalled = false

			handler := presentationhttp.RequireInternalAPIKey(expectedKey)(next)

			req := httptest.NewRequest(http.MethodGet, "/internal/v1/stock/x", nil)
			if tt.headerVal != "" {
				req.Header.Set("X-Internal-Api-Key", tt.headerVal)
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}

			if nextCalled != tt.wantNext {
				t.Fatalf("next called = %v, want %v", nextCalled, tt.wantNext)
			}
		})
	}
}

// Package http holds the inventory service's HTTP handlers and middleware:
// the stock query/update endpoints, the QStash webhook consumer, and the
// shared-secret middleware guarding every route except GET /health. Handlers
// stay thin — they validate input, call an application-layer use case, and
// map its result (or sentinel error) to an HTTP response; no business logic
// lives here.
package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// errorResponse is the JSON body written on every non-2xx response from this
// package's handlers. It is intentionally simpler than apps/api's response
// envelope convention — this is an internal, service-to-service surface, not
// a public API.
type errorResponse struct {
	Error string `json:"error"`
}

// writeJSON encodes body as the response, setting status and the JSON
// content type first.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("presentation: encode response body", "error", err)
	}
}

// writeError writes a JSON error body ({"error": message}) with status.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

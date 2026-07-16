package http

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
)

// correlationIDHeader is the inbound/outbound header carrying a request's
// correlation id, mirroring apps/api's x-correlation-id convention (Go's
// net/http header lookup is already case-insensitive).
const correlationIDHeader = "X-Correlation-Id"

// correlationIDKey is an unexported context key type so this package's
// context values cannot collide with keys set by other packages.
type correlationIDKey struct{}

// WithCorrelationID returns middleware that reads the inbound
// X-Correlation-Id header, generating one if it is absent or blank, stores
// it in the request context, and echoes it on the response header. It is
// applied to the plain REST stock routes only — the QStash webhook route
// sources its correlation id from the event envelope instead and must not
// use this middleware.
func WithCorrelationID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		correlationID := r.Header.Get(correlationIDHeader)
		if correlationID == "" {
			generated, err := newCorrelationID()
			if err != nil {
				slog.Error("correlation id middleware: generate id", "error", err)
				writeError(w, http.StatusInternalServerError, "internal error")

				return
			}

			correlationID = generated
		}

		w.Header().Set(correlationIDHeader, correlationID)

		ctx := context.WithValue(r.Context(), correlationIDKey{}, correlationID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// CorrelationIDFromContext returns the correlation id stored by
// WithCorrelationID, or "" if none is present — e.g. the context was not
// derived from a request that passed through the middleware.
func CorrelationIDFromContext(ctx context.Context) string {
	correlationID, _ := ctx.Value(correlationIDKey{}).(string)
	return correlationID
}

// newCorrelationID generates an opaque, unique id from 16 random bytes,
// hex-encoded. This gives the same uniqueness guarantee a UUIDv4 would,
// without adding a UUID library dependency for a single call site.
func newCorrelationID() (string, error) {
	buf := make([]byte, 16)

	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}

	return hex.EncodeToString(buf), nil
}

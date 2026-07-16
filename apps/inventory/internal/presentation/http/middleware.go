package http

import (
	"crypto/subtle"
	"net/http"
)

// internalAPIKeyHeader is the shared-secret header every internal route
// (everything except GET /health) requires, per the phase spec.
const internalAPIKeyHeader = "X-Internal-Api-Key"

// RequireInternalAPIKey returns middleware that rejects any request whose
// X-Internal-Api-Key header does not match expectedKey with a 401 JSON
// error body, without calling next. The comparison is constant-time so a
// mismatched key cannot be brute-forced via response-time side channels.
func RequireInternalAPIKey(expectedKey string) func(http.Handler) http.Handler {
	expected := []byte(expectedKey)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got := []byte(r.Header.Get(internalAPIKeyHeader))

			match := len(got) == len(expected) && subtle.ConstantTimeCompare(got, expected) == 1
			if !match {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

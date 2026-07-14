package http_test

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/application"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/fake"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/postgres"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/qstash"
	presentationhttp "github.com/gmsoftware/mini-e-commerce/inventory/internal/presentation/http"
)

// This file proves every acceptance criterion from
// docs/specs/2026-07-13-inventory-service.md against the fully assembled
// HTTP surface (net/http/httptest driving the real *http.ServeMux, real
// Postgres repositories, a fake.EventPublisher, and a qstash.SignatureVerifier
// built from known test signing keys) — the same wiring cmd/server's newMux
// assembles in production, minus the live QStash HTTP client the phase spec
// explicitly excludes from automated verification.
//
// Test-database strategy: rather than truncating a shared database before
// each run (the Jest/Playwright globalSetup pattern used by apps/api and
// apps/web), every test generates its own random UUID product ids and
// correlation ids (see newTestProductID/newTestCorrelationID below, the same
// technique internal/infrastructure/postgres's own integration tests already
// use). Tests never collide with each other or with rows left behind by a
// previous run, so reruns are idempotent without any reset step, and tests
// stay independent without a global setup/teardown hook. The whole file is
// gated on INVENTORY_DATABASE_URL, following the same skip convention as
// internal/infrastructure/postgres/postgres_test.go, so `go test ./...`
// never hard-fails when no Postgres is available.

const (
	testInternalAPIKey    = "integration-test-internal-key"
	testCurrentSigningKey = "integration-test-current-signing-key"
	testNextSigningKey    = "integration-test-next-signing-key"
	testDestinationURL    = "https://inventory.example.com/internal/v1/events/qstash"
)

// testServer bundles the assembled mux with the fake publisher backing it,
// so tests can both drive HTTP requests and inspect published events.
type testServer struct {
	mux       *http.ServeMux
	publisher *fake.EventPublisher
}

// newTestServer opens INVENTORY_DATABASE_URL and wires the same
// repository/use-case/handler stack as cmd/server's newMux, skipping the
// calling test if no test database is configured.
func newTestServer(t *testing.T) *testServer {
	t.Helper()

	databaseURL := os.Getenv("INVENTORY_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("INVENTORY_DATABASE_URL not set, skipping HTTP integration test")
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}

	t.Cleanup(func() { _ = db.Close() })

	if err := db.Ping(); err != nil {
		t.Fatalf("ping database: %v", err)
	}

	stockRepo := postgres.NewPostgresStockRepository(db)
	processedRepo := postgres.NewPostgresProcessedEventRepository(db)
	publisher := fake.NewEventPublisher()

	getStock := application.NewGetStockUseCase(stockRepo)
	setStock := application.NewSetStockUseCase(stockRepo)
	consumeOrderCreated := application.NewConsumeOrderCreatedUseCase(stockRepo, processedRepo, publisher)

	verifier := qstash.NewSignatureVerifier(testCurrentSigningKey, testNextSigningKey)

	stockHandler := presentationhttp.NewStockHandler(getStock, setStock)
	qstashHandler := presentationhttp.NewQStashHandler(verifier, consumeOrderCreated, testDestinationURL)
	requireInternalAPIKey := presentationhttp.RequireInternalAPIKey(testInternalAPIKey)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// The QStash webhook authenticates via its own Upstash-Signature check,
	// not the shared internal API key, matching cmd/server's newMux wiring.
	mux.HandleFunc("POST /internal/v1/events/qstash", qstashHandler.Handle)

	mux.Handle("GET /internal/v1/stock/{productId}", requireInternalAPIKey(http.HandlerFunc(stockHandler.Get)))
	mux.Handle("PATCH /internal/v1/stock/{productId}", requireInternalAPIKey(http.HandlerFunc(stockHandler.Set)))

	return &testServer{mux: mux, publisher: publisher}
}

// newTestProductID returns a fresh, random UUID-shaped id so tests never
// collide with each other or with rows a previous run left behind.
func newTestProductID(t *testing.T) string {
	t.Helper()
	return newTestUUID(t)
}

// newTestCorrelationID returns a fresh, random UUID-shaped correlation id.
func newTestCorrelationID(t *testing.T) string {
	t.Helper()
	return newTestUUID(t)
}

func newTestUUID(t *testing.T) string {
	t.Helper()

	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("generate random uuid: %v", err)
	}

	// Set the version (4) and variant bits per RFC 4122.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// doRequest issues req against srv.mux and returns the recorded response.
func doRequest(srv *testServer, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	srv.mux.ServeHTTP(rec, req)

	return rec
}

// getStock issues an authenticated GET for productID.
func getStock(srv *testServer, productID, apiKey string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/internal/v1/stock/"+productID, nil)
	if apiKey != "" {
		req.Header.Set("X-Internal-Api-Key", apiKey)
	}

	return doRequest(srv, req)
}

// patchStock issues an authenticated PATCH for productID with the given raw
// JSON body.
func patchStock(srv *testServer, productID, apiKey, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPatch, "/internal/v1/stock/"+productID, bytes.NewBufferString(body))
	if apiKey != "" {
		req.Header.Set("X-Internal-Api-Key", apiKey)
	}

	return doRequest(srv, req)
}

// stockQuantity decodes rec's body as a stock response and returns its
// quantity field, failing the test if the response is not 200 or does not
// decode.
func stockQuantity(t *testing.T, rec *httptest.ResponseRecorder) int {
	t.Helper()

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	var got struct {
		Quantity int `json:"quantity"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	return got.Quantity
}

// orderCreatedBody builds the raw JSON body of an order.created event
// envelope carrying a single line item.
func orderCreatedBody(correlationID, productID string, quantity int) string {
	return fmt.Sprintf(
		`{"event":"order.created","correlationId":%q,"timestamp":"2026-01-01T00:00:00Z","data":{"orderId":"order-1","items":[{"productId":%q,"quantity":%d}]}}`,
		correlationID, productID, quantity,
	)
}

// bodyClaims mirrors the (unexported) claims shape QStash signs into its
// Upstash-Signature JWT, matching internal/infrastructure/qstash's own
// signature_test.go so this suite hand-signs requests the same way,
// without a live Upstash account.
type bodyClaims struct {
	Body string `json:"body"`
	jwt.RegisteredClaims
}

// signBody builds a QStash-shaped Upstash-Signature value for body, signed
// with signingKey and asserting destinationURL as its subject.
func signBody(t *testing.T, signingKey, destinationURL, body string) string {
	t.Helper()

	hash := sha256.Sum256([]byte(body))
	bodyHash := strings.TrimRight(base64.URLEncoding.EncodeToString(hash[:]), "=")

	claims := bodyClaims{
		Body: bodyHash,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "Upstash",
			Subject:   destinationURL,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := token.SignedString([]byte(signingKey))
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}

	return signed
}

// postQStashEvent posts body to the QStash webhook, signed with signature
// (empty means no Upstash-Signature header at all).
func postQStashEvent(srv *testServer, body, signature string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/internal/v1/events/qstash", bytes.NewBufferString(body))
	if signature != "" {
		req.Header.Set("Upstash-Signature", signature)
	}

	return doRequest(srv, req)
}

// Acceptance criterion 1: seeded GET returns the correct quantity; unknown
// id returns 404. Acceptance criterion 2: PATCH updates the quantity
// (verified by a follow-up GET) and rejects a negative/non-integer body
// with 400.
func TestIntegrationStockQueryAndUpdate(t *testing.T) {
	srv := newTestServer(t)

	productID := newTestProductID(t)
	unknownID := newTestProductID(t)

	if rec := getStock(srv, productID, testInternalAPIKey); rec.Code != http.StatusNotFound {
		t.Fatalf("GET before seeding: status = %d, want %d", rec.Code, http.StatusNotFound)
	}

	seedRec := patchStock(srv, productID, testInternalAPIKey, `{"quantity": 15}`)
	if quantity := stockQuantity(t, seedRec); quantity != 15 {
		t.Fatalf("PATCH seed quantity = %d, want 15", quantity)
	}

	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 15 {
		t.Fatalf("GET after seed quantity = %d, want 15", quantity)
	}

	updateRec := patchStock(srv, productID, testInternalAPIKey, `{"quantity": 4}`)
	if quantity := stockQuantity(t, updateRec); quantity != 4 {
		t.Fatalf("PATCH update quantity = %d, want 4", quantity)
	}

	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 4 {
		t.Fatalf("GET after update quantity = %d, want 4", quantity)
	}

	if rec := getStock(srv, unknownID, testInternalAPIKey); rec.Code != http.StatusNotFound {
		t.Fatalf("GET unknown id: status = %d, want %d", rec.Code, http.StatusNotFound)
	}

	if rec := patchStock(srv, productID, testInternalAPIKey, `{"quantity": -1}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("PATCH negative quantity: status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	if rec := patchStock(srv, productID, testInternalAPIKey, `{"quantity": "not-a-number"}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("PATCH non-integer quantity: status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	// The rejected updates above must not have changed the stored quantity.
	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 4 {
		t.Fatalf("GET after rejected updates quantity = %d, want unchanged 4", quantity)
	}
}

// Acceptance criterion 3: every non-health, non-QStash route 401s without
// X-Internal-Api-Key.
func TestIntegrationRequiresInternalAPIKeyExceptHealthAndQStash(t *testing.T) {
	srv := newTestServer(t)

	productID := newTestProductID(t)

	if rec := getStock(srv, productID, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET without api key: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}

	if rec := patchStock(srv, productID, "", `{"quantity": 1}`); rec.Code != http.StatusUnauthorized {
		t.Fatalf("PATCH without api key: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}

	if rec := getStock(srv, productID, "wrong-key"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET with wrong api key: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}

	healthReq := httptest.NewRequest(http.MethodGet, "/health", nil)
	if rec := doRequest(srv, healthReq); rec.Code != http.StatusOK {
		t.Fatalf("GET /health without api key: status = %d, want %d", rec.Code, http.StatusOK)
	}
}

// Acceptance criterion 4: a correctly signed order.created payload
// decrements the referenced products' stock and publishes one
// inventory.updated event per affected product.
func TestIntegrationQStashOrderCreatedDecrementsStockAndPublishes(t *testing.T) {
	srv := newTestServer(t)

	productA := newTestProductID(t)
	productB := newTestProductID(t)
	correlationID := newTestCorrelationID(t)

	patchStock(srv, productA, testInternalAPIKey, `{"quantity": 10}`)
	patchStock(srv, productB, testInternalAPIKey, `{"quantity": 20}`)

	body := fmt.Sprintf(
		`{"event":"order.created","correlationId":%q,"timestamp":"2026-01-01T00:00:00Z","data":{"orderId":"order-1","items":[{"productId":%q,"quantity":4},{"productId":%q,"quantity":6}]}}`,
		correlationID, productA, productB,
	)
	signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)

	if rec := postQStashEvent(srv, body, signature); rec.Code != http.StatusOK {
		t.Fatalf("POST qstash event: status = %d, want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	if quantity := stockQuantity(t, getStock(srv, productA, testInternalAPIKey)); quantity != 6 {
		t.Fatalf("product A quantity = %d, want 6", quantity)
	}

	if quantity := stockQuantity(t, getStock(srv, productB, testInternalAPIKey)); quantity != 14 {
		t.Fatalf("product B quantity = %d, want 14", quantity)
	}

	calls := srv.publisher.Calls()
	if len(calls) != 2 {
		t.Fatalf("published calls = %d, want 2 (one per affected product)", len(calls))
	}

	for _, call := range calls {
		if call.Event != application.InventoryUpdatedEvent {
			t.Fatalf("published event = %q, want %q", call.Event, application.InventoryUpdatedEvent)
		}

		if call.CorrelationID != correlationID {
			t.Fatalf("published correlationId = %q, want %q", call.CorrelationID, correlationID)
		}
	}
}

// Acceptance criterion 5: redelivering the identical signed payload (same
// correlationId) a second time does not double-decrement stock, and
// records no additional inventory.updated calls.
func TestIntegrationQStashRedeliveryIsIdempotent(t *testing.T) {
	srv := newTestServer(t)

	productID := newTestProductID(t)
	correlationID := newTestCorrelationID(t)

	patchStock(srv, productID, testInternalAPIKey, `{"quantity": 10}`)

	body := orderCreatedBody(correlationID, productID, 3)
	signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)

	if rec := postQStashEvent(srv, body, signature); rec.Code != http.StatusOK {
		t.Fatalf("first delivery: status = %d, want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 7 {
		t.Fatalf("quantity after first delivery = %d, want 7", quantity)
	}

	if got := len(srv.publisher.Calls()); got != 1 {
		t.Fatalf("published calls after first delivery = %d, want 1", got)
	}

	// Redeliver the exact same signed payload.
	if rec := postQStashEvent(srv, body, signature); rec.Code != http.StatusOK {
		t.Fatalf("redelivery: status = %d, want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 7 {
		t.Fatalf("quantity after redelivery = %d, want unchanged 7", quantity)
	}

	if got := len(srv.publisher.Calls()); got != 1 {
		t.Fatalf("published calls after redelivery = %d, want unchanged 1", got)
	}
}

// Acceptance criterion 6: an incorrectly signed payload is rejected with
// 401 and never reaches the decrement logic.
func TestIntegrationQStashInvalidSignatureRejected(t *testing.T) {
	srv := newTestServer(t)

	productID := newTestProductID(t)
	correlationID := newTestCorrelationID(t)

	patchStock(srv, productID, testInternalAPIKey, `{"quantity": 10}`)

	body := orderCreatedBody(correlationID, productID, 3)

	t.Run("signed with an unknown key", func(t *testing.T) {
		signature := signBody(t, "some-other-key-not-configured", testDestinationURL, body)

		rec := postQStashEvent(srv, body, signature)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
		}
	})

	t.Run("tampered body after signing", func(t *testing.T) {
		signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)
		tamperedBody := body[:len(body)-1] + `, "extra": true}`

		rec := postQStashEvent(srv, tamperedBody, signature)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
		}
	})

	t.Run("missing signature header", func(t *testing.T) {
		rec := postQStashEvent(srv, body, "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
		}
	})

	// None of the rejected deliveries above should have reached the
	// decrement logic: stock is unchanged and nothing was published.
	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 10 {
		t.Fatalf("quantity after rejected deliveries = %d, want unchanged 10", quantity)
	}

	if got := len(srv.publisher.Calls()); got != 0 {
		t.Fatalf("published calls after rejected deliveries = %d, want 0", got)
	}
}

// Acceptance criterion 7: a decrement that would take stock below zero
// clamps at zero rather than going negative or erroring the whole request.
func TestIntegrationQStashDecrementClampsAtZero(t *testing.T) {
	srv := newTestServer(t)

	productID := newTestProductID(t)
	correlationID := newTestCorrelationID(t)

	patchStock(srv, productID, testInternalAPIKey, `{"quantity": 2}`)

	body := orderCreatedBody(correlationID, productID, 10)
	signature := signBody(t, testCurrentSigningKey, testDestinationURL, body)

	if rec := postQStashEvent(srv, body, signature); rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
	}

	if quantity := stockQuantity(t, getStock(srv, productID, testInternalAPIKey)); quantity != 0 {
		t.Fatalf("quantity = %d, want 0 (clamped)", quantity)
	}

	calls := srv.publisher.Calls()
	if len(calls) != 1 {
		t.Fatalf("published calls = %d, want 1", len(calls))
	}
}

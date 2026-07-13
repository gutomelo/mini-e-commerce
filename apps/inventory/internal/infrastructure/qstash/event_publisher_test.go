package qstash_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/domain"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/qstash"
)

// TestEventPublisher_Publish exercises EventPublisher against an
// httptest.Server standing in for QStash's publish API, since there is no
// live Upstash account to test against in this phase. It asserts the
// request is well-formed: correct path, bearer token, and envelope body.
func TestEventPublisher_Publish(t *testing.T) {
	var (
		gotPath     string
		gotAuth     string
		gotEnvelope domain.EventEnvelope[map[string]any]
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")

		if err := json.NewDecoder(r.Body).Decode(&gotEnvelope); err != nil {
			t.Errorf("decode request body: %v", err)
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	const destinationTopic = "https://inventory.internal/internal/v1/events/qstash"

	publisher := qstash.NewEventPublisher(
		destinationTopic,
		"test-token",
		qstash.WithBaseURL(server.URL+"/v2/publish/"),
	)

	data := domain.InventoryUpdatedData{ProductID: "product-1", Quantity: 7}

	err := publisher.Publish(context.Background(), "inventory.updated", "correlation-1", data)
	if err != nil {
		t.Fatalf("Publish() = %v, want nil", err)
	}

	wantPath := "/v2/publish/" + destinationTopic
	if gotPath != wantPath {
		t.Errorf("request path = %q, want %q", gotPath, wantPath)
	}

	if gotAuth != "Bearer test-token" {
		t.Errorf("Authorization header = %q, want %q", gotAuth, "Bearer test-token")
	}

	if gotEnvelope.Event != "inventory.updated" {
		t.Errorf("envelope.Event = %q, want %q", gotEnvelope.Event, "inventory.updated")
	}

	if gotEnvelope.CorrelationID != "correlation-1" {
		t.Errorf("envelope.CorrelationID = %q, want %q", gotEnvelope.CorrelationID, "correlation-1")
	}

	if gotEnvelope.Data["productId"] != "product-1" {
		t.Errorf("envelope.Data[productId] = %v, want %q", gotEnvelope.Data["productId"], "product-1")
	}
}

// TestEventPublisher_Publish_ErrorStatus asserts a non-2xx response from
// QStash is surfaced as an error rather than silently ignored.
func TestEventPublisher_Publish_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	publisher := qstash.NewEventPublisher(server.URL, "wrong-token")

	err := publisher.Publish(context.Background(), "inventory.updated", "correlation-1", domain.InventoryUpdatedData{})
	if err == nil {
		t.Fatal("Publish() = nil, want error for a non-2xx response")
	}
}

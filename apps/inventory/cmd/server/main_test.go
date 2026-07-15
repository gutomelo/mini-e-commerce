package main

import (
	"testing"

	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/fake"
	"github.com/gmsoftware/mini-e-commerce/inventory/internal/infrastructure/qstash"
)

func TestNewEventPublisher(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		mode string
		want string // "real" or "fake"
	}{
		{name: "real mode selects qstash publisher", mode: "real", want: "real"},
		{name: "empty mode selects fake publisher", mode: "", want: "fake"},
		{name: "fake mode selects fake publisher", mode: "fake", want: "fake"},
		{name: "unrecognized mode selects fake publisher", mode: "bogus", want: "fake"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			publisher := newEventPublisher(tt.mode, "https://example.com/destination", "test-token")

			switch tt.want {
			case "real":
				if _, ok := publisher.(*qstash.EventPublisher); !ok {
					t.Fatalf("newEventPublisher(%q) = %T, want *qstash.EventPublisher", tt.mode, publisher)
				}
			case "fake":
				if _, ok := publisher.(*fake.EventPublisher); !ok {
					t.Fatalf("newEventPublisher(%q) = %T, want *fake.EventPublisher", tt.mode, publisher)
				}
			}
		})
	}
}

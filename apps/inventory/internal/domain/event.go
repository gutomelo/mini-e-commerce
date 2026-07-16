package domain

import "time"

// EventEnvelope mirrors the shape of packages/types' EventEnvelope<TData>
// from the TypeScript side, hand-typed here since this project has no
// shared codegen between TS and Go. Timestamp is a time.Time (rather than
// a raw string) because encoding/json already marshals and unmarshals
// time.Time as RFC3339, which is a valid ISO-8601 representation and
// matches the spec's "timestamp": "ISO-8601" example without any custom
// (un)marshalling code.
type EventEnvelope[T any] struct {
	Event         string    `json:"event"`
	CorrelationID string    `json:"correlationId"`
	Timestamp     time.Time `json:"timestamp"`
	Data          T         `json:"data"`
}

// OrderCreatedEvent is the EventEnvelope.Event value for an order.created
// event, the only event this service's QStash webhook currently consumes.
const OrderCreatedEvent = "order.created"

// OrderCreatedItem is one line item of an order.created event's data payload.
type OrderCreatedItem struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

// OrderCreatedData is the data payload of an order.created event: the order
// id and the line items whose stock must be decremented.
type OrderCreatedData struct {
	OrderID string             `json:"orderId"`
	Items   []OrderCreatedItem `json:"items"`
}

// InventoryUpdatedData is the data payload of the inventory.updated event
// this service publishes after a stock decrement: the affected product and
// its post-decrement quantity.
type InventoryUpdatedData struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

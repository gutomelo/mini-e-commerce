package com.miniecommerce.payment.payment.domain.event;

import java.time.Instant;

/**
 * Generic envelope shape shared by every event this service consumes or publishes:
 * {@code { event, correlationId, timestamp, data }}. The presentation layer owns deserializing an
 * inbound QStash payload into this shape (a later task); the application layer only needs the type
 * to exist so use case signatures can reference it where convenient.
 *
 * @param <T> the event-specific payload type, e.g. {@link OrderCreatedData}.
 */
public record EventEnvelope<T>(String event, String correlationId, Instant timestamp, T data) {
}

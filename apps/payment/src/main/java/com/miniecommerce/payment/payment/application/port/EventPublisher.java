package com.miniecommerce.payment.payment.application.port;

/**
 * Port for publishing an outbound event. Implementations (a later task): a real Upstash QStash
 * HTTP client for production/compose, and an in-memory fake used by local dev and every automated
 * test in this service.
 */
public interface EventPublisher {

    /**
     * Publishes one event.
     *
     * @param event the event name, e.g. {@code "payment.completed"}.
     * @param correlationId the correlation id carried through from the triggering event, or a
     *     freshly generated one if this event was not triggered by an inbound event.
     * @param data the event-specific payload, e.g. a record describing the outcome.
     */
    void publish(String event, String correlationId, Object data);
}

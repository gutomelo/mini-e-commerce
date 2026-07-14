package com.miniecommerce.payment.payment.presentation;

/**
 * Thrown by {@link QStashWebhookController} when a signature-verified webhook payload carries an
 * {@code event} value other than {@code "order.created"}. This route is currently the only QStash
 * subscription this service has, but the envelope's {@code event} field is part of the contract, so
 * a mismatched event is rejected explicitly rather than silently processed as if it were
 * {@code order.created}.
 */
public class UnsupportedEventException extends RuntimeException {

    public UnsupportedEventException(String event) {
        super("Unsupported event type '%s'".formatted(event));
    }
}

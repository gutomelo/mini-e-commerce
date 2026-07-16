package com.miniecommerce.payment.payment.presentation;

/**
 * Thrown by {@link QStashWebhookController} when a signature-verified webhook body cannot be
 * deserialized as an {@link com.miniecommerce.payment.payment.domain.event.EventEnvelope}. Maps to
 * {@code 400 Bad Request}.
 */
public class InvalidWebhookPayloadException extends RuntimeException {

    public InvalidWebhookPayloadException(String message, Throwable cause) {
        super(message, cause);
    }
}

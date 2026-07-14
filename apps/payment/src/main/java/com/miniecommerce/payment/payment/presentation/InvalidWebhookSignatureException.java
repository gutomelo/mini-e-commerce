package com.miniecommerce.payment.payment.presentation;

/**
 * Thrown by {@link QStashWebhookController} when the inbound {@code Upstash-Signature} header is
 * missing or fails verification. Maps to {@code 401 Unauthorized} — the request body is never
 * processed when this is thrown.
 */
public class InvalidWebhookSignatureException extends RuntimeException {

    public InvalidWebhookSignatureException(String message) {
        super(message);
    }
}

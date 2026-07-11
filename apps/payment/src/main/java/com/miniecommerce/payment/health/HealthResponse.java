package com.miniecommerce.payment.health;

/** Immutable response body for the {@code GET /health} contract. */
public record HealthResponse(String status, String service) {
}

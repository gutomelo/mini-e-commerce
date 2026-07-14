package com.miniecommerce.payment.payment.presentation.dto;

/**
 * Uniform JSON error body written by every non-2xx response from this service's presentation
 * layer. Intentionally minimal — this is an internal, service-to-service surface (mirroring the
 * convention apps/inventory's Go handlers use), not a public API.
 */
public record ErrorResponse(String error) {
}

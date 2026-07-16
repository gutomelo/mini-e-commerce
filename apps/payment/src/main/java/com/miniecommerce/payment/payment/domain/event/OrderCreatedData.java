package com.miniecommerce.payment.payment.domain.event;

/**
 * Payload of an {@code order.created} event, as consumed by the payment service. Defined locally
 * ahead of the real producer (see the Phase 5 spec's Non-Goals) — Phase 6 reconciles this shape
 * against {@code apps/api}'s canonical {@code order.created} schema once it exists.
 */
public record OrderCreatedData(String orderId, int totalCents) {
}

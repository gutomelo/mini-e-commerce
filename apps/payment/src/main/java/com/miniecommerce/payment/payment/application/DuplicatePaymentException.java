package com.miniecommerce.payment.payment.application;

/**
 * Thrown when an {@code order.created} event (under a correlation id not previously seen) refers
 * to an {@code orderId} that already has a payment record. This should not happen in practice —
 * the same order should always arrive under the same correlation id — but must surface as a clear,
 * well-typed conflict rather than an unhandled {@code DataIntegrityViolationException} bubbling up
 * from the database's unique constraint on {@code order_id}. A later task's controller/exception
 * handling maps this to an HTTP conflict response.
 */
public class DuplicatePaymentException extends RuntimeException {

    public DuplicatePaymentException(String orderId) {
        super("A payment already exists for orderId '%s'".formatted(orderId));
    }
}

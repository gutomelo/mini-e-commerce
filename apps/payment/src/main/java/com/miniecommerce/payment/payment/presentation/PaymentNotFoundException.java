package com.miniecommerce.payment.payment.presentation;

/**
 * Thrown by {@link PaymentController} when no payment record exists for the requested order id.
 * Kept in the presentation layer (rather than the application layer, where
 * {@link com.miniecommerce.payment.payment.application.GetPaymentUseCase} simply returns an empty
 * {@code Optional}) since "not found" is an HTTP-facing concept, not a business rule.
 */
public class PaymentNotFoundException extends RuntimeException {

    public PaymentNotFoundException(String orderId) {
        super("No payment found for orderId '%s'".formatted(orderId));
    }
}

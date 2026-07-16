package com.miniecommerce.payment.payment.presentation.dto;

import com.miniecommerce.payment.payment.domain.Payment;
import com.miniecommerce.payment.payment.domain.PaymentStatus;
import java.time.Instant;

/**
 * Response body for {@code GET /internal/v1/payments/{orderId}}.
 *
 * <p>{@code processedAt} is mapped from {@link Payment#getCreatedAt()}, not
 * {@link Payment#getUpdatedAt()}: a {@code Payment} row is written exactly once by
 * {@code ProcessOrderCreatedUseCase} (there is no reconciliation/refund flow yet that would ever
 * update an existing row), so "when this payment was processed" and "when this row was created"
 * are the same instant today. Should a future update path appear, this mapping should be revisited
 * to decide whether "processed" should track the original decision or the latest one.
 */
public record PaymentResponse(
        String orderId, PaymentStatus status, int amountCents, String gatewayReference, Instant processedAt) {

    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getOrderId(),
                payment.getStatus(),
                payment.getAmountCents(),
                payment.getGatewayReference(),
                payment.getCreatedAt());
    }
}

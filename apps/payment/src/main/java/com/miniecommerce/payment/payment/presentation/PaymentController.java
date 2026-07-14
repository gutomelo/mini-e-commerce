package com.miniecommerce.payment.payment.presentation;

import com.miniecommerce.payment.payment.application.GetPaymentUseCase;
import com.miniecommerce.payment.payment.presentation.dto.PaymentResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes payment status to internal callers (e.g. apps/api). Guarded by
 * {@link InternalApiKeyFilter} like every other route except {@code GET /health} and the QStash
 * webhook. Contains no business logic — it only maps {@link GetPaymentUseCase}'s result to an HTTP
 * response.
 */
@RestController
public class PaymentController {

    private final GetPaymentUseCase getPaymentUseCase;

    public PaymentController(GetPaymentUseCase getPaymentUseCase) {
        this.getPaymentUseCase = getPaymentUseCase;
    }

    @GetMapping("/internal/v1/payments/{orderId}")
    public PaymentResponse getPayment(@PathVariable String orderId) {
        return getPaymentUseCase
                .execute(orderId)
                .map(PaymentResponse::from)
                .orElseThrow(() -> new PaymentNotFoundException(orderId));
    }
}

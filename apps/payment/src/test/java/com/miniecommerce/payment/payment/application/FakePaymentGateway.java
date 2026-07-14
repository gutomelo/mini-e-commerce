package com.miniecommerce.payment.payment.application;

import com.miniecommerce.payment.payment.application.port.PaymentDecision;
import com.miniecommerce.payment.payment.application.port.PaymentGateway;

/**
 * Hand-written fake {@link PaymentGateway} for unit tests: returns a fixed decision configured by
 * the test, so charge outcomes are deterministic rather than depending on a success-rate RNG.
 */
class FakePaymentGateway implements PaymentGateway {

    private final boolean approve;
    private final String gatewayReference;

    FakePaymentGateway(boolean approve, String gatewayReference) {
        this.approve = approve;
        this.gatewayReference = gatewayReference;
    }

    @Override
    public PaymentDecision charge(int amountCents) {
        return new PaymentDecision(approve, gatewayReference);
    }
}

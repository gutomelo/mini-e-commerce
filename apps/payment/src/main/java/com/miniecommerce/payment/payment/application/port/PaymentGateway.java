package com.miniecommerce.payment.payment.application.port;

/**
 * Port representing the simulated payment gateway's charge decision. The real implementation
 * (success-rate + sentinel-amount logic) is a later task; this task only defines the shape the use
 * case depends on.
 */
public interface PaymentGateway {

    /**
     * Attempts to charge {@code amountCents}, returning the gateway's decision.
     */
    PaymentDecision charge(int amountCents);
}

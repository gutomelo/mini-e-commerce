package com.miniecommerce.payment.payment.application.port;

/**
 * Outcome of a simulated charge attempt, as decided by {@link PaymentGateway}.
 *
 * @param approved whether the gateway approved the charge.
 * @param gatewayReference a simulated transaction id (e.g. a random UUID), always present
 *     regardless of outcome, mirroring how a real gateway would return a reference for both
 *     approved and declined attempts.
 */
public record PaymentDecision(boolean approved, String gatewayReference) {
}

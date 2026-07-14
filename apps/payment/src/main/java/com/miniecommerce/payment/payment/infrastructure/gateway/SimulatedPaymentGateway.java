package com.miniecommerce.payment.payment.infrastructure.gateway;

import com.miniecommerce.payment.payment.application.port.PaymentDecision;
import com.miniecommerce.payment.payment.application.port.PaymentGateway;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Simulated payment gateway: approves a charge with a configurable success rate, except a reserved
 * sentinel amount ({@code amountCents == 66600}, i.e. exactly $666.00) which always fails regardless
 * of the configured success rate. The sentinel gives tests (and manual exploration) a deterministic
 * way to exercise the decline path without depending on random chance or mocking the RNG.
 *
 * <p>This is the only place in the service that knows about "success rate" or randomness; the
 * {@link PaymentGateway} interface keeps the use case layer ignorant of how the decision is made, so
 * a real gateway integration could later replace this class without touching
 * {@code ProcessOrderCreatedUseCase}.
 */
@Component
public class SimulatedPaymentGateway implements PaymentGateway {

    /** Reserved amount (exactly $666.00) that always declines, regardless of the success rate. */
    static final int SENTINEL_DECLINE_AMOUNT_CENTS = 66_600;

    private final double successRate;

    public SimulatedPaymentGateway(
            @Value("${payment.gateway.success-rate:0.9}") double successRate) {
        if (successRate < 0.0 || successRate > 1.0) {
            throw new IllegalArgumentException("successRate must be between 0.0 and 1.0, got " + successRate);
        }
        this.successRate = successRate;
    }

    @Override
    public PaymentDecision charge(int amountCents) {
        String gatewayReference = UUID.randomUUID().toString();

        if (amountCents == SENTINEL_DECLINE_AMOUNT_CENTS) {
            return new PaymentDecision(false, gatewayReference);
        }

        boolean approved = ThreadLocalRandom.current().nextDouble() < successRate;
        return new PaymentDecision(approved, gatewayReference);
    }
}

package com.miniecommerce.payment.payment.infrastructure.gateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.miniecommerce.payment.payment.application.port.PaymentDecision;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link SimulatedPaymentGateway}. These assert deterministic boundaries
 * (success rate 0.0 / 1.0, and the always-fail sentinel amount) rather than statistical behavior at
 * an intermediate rate, so the suite never flakes.
 */
class SimulatedPaymentGatewayTest {

    private static final int ORDINARY_AMOUNT_CENTS = 4_999;
    private static final int SENTINEL_AMOUNT_CENTS = 66_600;

    @Test
    void sentinelAmountAlwaysDeclinesEvenWithAGuaranteedSuccessRate() {
        SimulatedPaymentGateway gateway = new SimulatedPaymentGateway(1.0);

        for (int i = 0; i < 20; i++) {
            PaymentDecision decision = gateway.charge(SENTINEL_AMOUNT_CENTS);
            assertThat(decision.approved()).isFalse();
            assertThat(decision.gatewayReference()).isNotBlank();
        }
    }

    @Test
    void successRateOfOneAlwaysApprovesOrdinaryAmounts() {
        SimulatedPaymentGateway gateway = new SimulatedPaymentGateway(1.0);

        for (int i = 0; i < 20; i++) {
            PaymentDecision decision = gateway.charge(ORDINARY_AMOUNT_CENTS);
            assertThat(decision.approved()).isTrue();
            assertThat(decision.gatewayReference()).isNotBlank();
        }
    }

    @Test
    void successRateOfZeroAlwaysDeclinesOrdinaryAmounts() {
        SimulatedPaymentGateway gateway = new SimulatedPaymentGateway(0.0);

        for (int i = 0; i < 20; i++) {
            PaymentDecision decision = gateway.charge(ORDINARY_AMOUNT_CENTS);
            assertThat(decision.approved()).isFalse();
            assertThat(decision.gatewayReference()).isNotBlank();
        }
    }

    @Test
    void everyDecisionGetsADistinctGatewayReference() {
        SimulatedPaymentGateway gateway = new SimulatedPaymentGateway(1.0);

        PaymentDecision first = gateway.charge(ORDINARY_AMOUNT_CENTS);
        PaymentDecision second = gateway.charge(ORDINARY_AMOUNT_CENTS);

        assertThat(first.gatewayReference()).isNotEqualTo(second.gatewayReference());
    }

    @Test
    void rejectsAnOutOfRangeSuccessRate() {
        assertThatThrownBy(() -> new SimulatedPaymentGateway(1.5))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SimulatedPaymentGateway(-0.1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

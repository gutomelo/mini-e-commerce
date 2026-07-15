package com.miniecommerce.payment.payment.presentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.miniecommerce.payment.payment.application.port.EventPublisher;
import com.miniecommerce.payment.payment.infrastructure.fake.InMemoryEventPublisher;
import com.miniecommerce.payment.payment.infrastructure.qstash.QStashEventPublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Unit tests for {@link PaymentBeanConfiguration#eventPublisher}'s mode-selection logic: only the
 * exact value {@code "real"} wires the real {@link QStashEventPublisher}; every other value —
 * unset/empty/a typo — falls back to {@link InMemoryEventPublisher}, so a misconfigured
 * environment never silently starts (or fails to start) publishing real events.
 */
class PaymentBeanConfigurationTest {

    private final PaymentBeanConfiguration configuration = new PaymentBeanConfiguration();

    @Test
    void realModeWiresTheRealQStashEventPublisher() {
        EventPublisher publisher =
                configuration.eventPublisher("real", "https://example.com/webhook", "test-token");

        assertThat(publisher).isInstanceOf(QStashEventPublisher.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"fake", "bogus"})
    void anyNonRealModeWiresTheInMemoryFake(String mode) {
        EventPublisher publisher =
                configuration.eventPublisher(mode, "https://example.com/webhook", "test-token");

        assertThat(publisher).isInstanceOf(InMemoryEventPublisher.class);
    }

    @Test
    void emptyModeWiresTheInMemoryFake() {
        EventPublisher publisher =
                configuration.eventPublisher("", "https://example.com/webhook", "test-token");

        assertThat(publisher).isInstanceOf(InMemoryEventPublisher.class);
    }
}

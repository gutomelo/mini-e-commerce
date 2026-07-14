package com.miniecommerce.payment.payment.presentation;

import com.miniecommerce.payment.payment.application.GetPaymentUseCase;
import com.miniecommerce.payment.payment.application.ProcessOrderCreatedUseCase;
import com.miniecommerce.payment.payment.application.port.EventPublisher;
import com.miniecommerce.payment.payment.application.port.PaymentGateway;
import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.application.port.ProcessedEventRepository;
import com.miniecommerce.payment.payment.infrastructure.fake.InMemoryEventPublisher;
import com.miniecommerce.payment.payment.infrastructure.qstash.QStashSignatureVerifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the payment use cases and their supporting adapters into Spring beans, now that the real
 * infrastructure (JPA repositories, {@link com.miniecommerce.payment.payment.infrastructure.gateway.SimulatedPaymentGateway},
 * and a real database) exists for them to depend on.
 *
 * <p><b>EventPublisher wiring decision:</b> this configuration wires {@link InMemoryEventPublisher}
 * as the {@link EventPublisher} bean, not the real {@code QStashEventPublisher}. Per the Phase 5
 * spec's Non-Goals, a real QStash round-trip for outbound publishing is not required yet, and
 * Phase 4's inventory service set the precedent of defaulting to the in-memory fake until a
 * consumer of {@code payment.completed}/{@code payment.failed} actually exists. Introducing
 * profile-switching machinery (e.g. a {@code @Profile("prod")} real bean plus a
 * {@code @Profile("!prod")} fake bean) to support a code path nothing yet calls would be exactly
 * the kind of unnecessary abstraction the project's engineering rules ask to avoid — this can be
 * revisited in the phase that actually adds a payment-event consumer.
 */
@Configuration
public class PaymentBeanConfiguration {

    @Bean
    public EventPublisher eventPublisher() {
        return new InMemoryEventPublisher();
    }

    @Bean
    public ProcessOrderCreatedUseCase processOrderCreatedUseCase(
            ProcessedEventRepository processedEventRepository,
            PaymentRepository paymentRepository,
            PaymentGateway paymentGateway,
            EventPublisher eventPublisher) {
        return new ProcessOrderCreatedUseCase(
                processedEventRepository, paymentRepository, paymentGateway, eventPublisher);
    }

    @Bean
    public GetPaymentUseCase getPaymentUseCase(PaymentRepository paymentRepository) {
        return new GetPaymentUseCase(paymentRepository);
    }

    @Bean
    public QStashSignatureVerifier qStashSignatureVerifier(
            @Value("${qstash.current-signing-key}") String currentSigningKey,
            @Value("${qstash.next-signing-key}") String nextSigningKey) {
        return new QStashSignatureVerifier(currentSigningKey, nextSigningKey);
    }
}

package com.miniecommerce.payment.payment.presentation;

import com.miniecommerce.payment.payment.application.GetPaymentUseCase;
import com.miniecommerce.payment.payment.application.ProcessOrderCreatedUseCase;
import com.miniecommerce.payment.payment.application.port.EventPublisher;
import com.miniecommerce.payment.payment.application.port.PaymentGateway;
import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.application.port.ProcessedEventRepository;
import com.miniecommerce.payment.payment.infrastructure.fake.InMemoryEventPublisher;
import com.miniecommerce.payment.payment.infrastructure.qstash.QStashEventPublisher;
import com.miniecommerce.payment.payment.infrastructure.qstash.QStashSignatureVerifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Wires the payment use cases and their supporting adapters into Spring beans, now that the real
 * infrastructure (JPA repositories, {@link com.miniecommerce.payment.payment.infrastructure.gateway.SimulatedPaymentGateway},
 * and a real database) exists for them to depend on.
 *
 * <p><b>EventPublisher wiring decision:</b> this configuration selects between
 * {@link InMemoryEventPublisher} and the real {@link QStashEventPublisher} at runtime, based on the
 * {@code EVENT_PUBLISHER_MODE} environment variable (mapped to {@code event.publisher.mode}). Only
 * the exact value {@code "real"} selects the QStash adapter; anything else — unset, empty, or a
 * typo — falls back to the in-memory fake, so a misconfigured environment never silently starts
 * publishing (or failing to publish) real events. This mirrors the same toggle added to
 * {@code apps/inventory} and {@code apps/api} in Phase 8, now that a real consumer of
 * {@code payment.completed}/{@code payment.failed} exists.
 */
@Configuration
public class PaymentBeanConfiguration {

    private static final String REAL_MODE = "real";

    @Bean
    public EventPublisher eventPublisher(
            @Value("${event.publisher.mode:fake}") String publisherMode,
            @Value("${payment.qstash.destination-url}") String destinationUrl,
            @Value("${qstash.token}") String token) {
        if (REAL_MODE.equals(publisherMode)) {
            return new QStashEventPublisher(RestClient.builder(), destinationUrl, token);
        }
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

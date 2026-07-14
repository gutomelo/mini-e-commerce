package com.miniecommerce.payment.payment.application;

import com.miniecommerce.payment.payment.application.port.EventPublisher;
import com.miniecommerce.payment.payment.application.port.PaymentDecision;
import com.miniecommerce.payment.payment.application.port.PaymentGateway;
import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.application.port.ProcessedEventRepository;
import com.miniecommerce.payment.payment.domain.Payment;
import com.miniecommerce.payment.payment.domain.PaymentStatus;
import com.miniecommerce.payment.payment.domain.event.OrderCreatedData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

/**
 * Processes an {@code order.created} event: claims the correlation id atomically, runs the
 * simulated charge, persists the resulting {@link Payment}, and publishes exactly one outcome
 * event.
 *
 * <p>Idempotency is enforced by claiming the correlation id via
 * {@link ProcessedEventRepository#tryClaim(String)} as the very first step, before any business
 * logic runs — applying, from the start, the fix Phase 4's inventory service needed to add after a
 * code review found its original check-then-act sequence racy under concurrent redelivery.
 *
 * <p>Not yet a Spring bean ({@code @Service}): its {@link PaymentGateway} and {@link EventPublisher}
 * dependencies have no implementation yet (those are later tasks — the real
 * {@code SimulatedPaymentGateway}, the real QStash publisher, and the in-memory fake). Making this
 * class a {@code @Service} today would also require a real, connectable datasource for
 * {@code PaymentRepository}/{@code ProcessedEventRepository} to become beans at all, which the
 * dedicated test-database setup (a later task, "Test suite proving every acceptance criterion")
 * hasn't been built yet. The presentation layer wires this use case explicitly (e.g. via a
 * {@code @Configuration} {@code @Bean} method) once those adapters exist.
 */
public class ProcessOrderCreatedUseCase {

    private static final Logger logger = LoggerFactory.getLogger(ProcessOrderCreatedUseCase.class);

    private static final String EVENT_PAYMENT_COMPLETED = "payment.completed";
    private static final String EVENT_PAYMENT_FAILED = "payment.failed";
    private static final String DECLINE_REASON = "Simulated gateway declined the charge";

    private final ProcessedEventRepository processedEventRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentGateway paymentGateway;
    private final EventPublisher eventPublisher;

    public ProcessOrderCreatedUseCase(
            ProcessedEventRepository processedEventRepository,
            PaymentRepository paymentRepository,
            PaymentGateway paymentGateway,
            EventPublisher eventPublisher) {
        this.processedEventRepository = processedEventRepository;
        this.paymentRepository = paymentRepository;
        this.paymentGateway = paymentGateway;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void execute(String correlationId, OrderCreatedData data) {
        if (!processedEventRepository.tryClaim(correlationId)) {
            logger.info(
                    "Ignoring redelivered order.created event, correlationId={}, orderId={}",
                    correlationId,
                    data.orderId());
            return;
        }

        if (paymentRepository.findByOrderId(data.orderId()).isPresent()) {
            throw new DuplicatePaymentException(data.orderId());
        }

        PaymentDecision decision = paymentGateway.charge(data.totalCents());
        PaymentStatus status = decision.approved() ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

        Payment payment = paymentRepository.save(
                new Payment(data.orderId(), data.totalCents(), status, decision.gatewayReference()));

        if (decision.approved()) {
            eventPublisher.publish(
                    EVENT_PAYMENT_COMPLETED,
                    correlationId,
                    new PaymentCompletedData(payment.getOrderId(), payment.getId().toString(), payment.getAmountCents()));
        } else {
            eventPublisher.publish(
                    EVENT_PAYMENT_FAILED,
                    correlationId,
                    new PaymentFailedData(payment.getOrderId(), payment.getId().toString(), DECLINE_REASON));
        }

        logger.info(
                "Processed order.created event, correlationId={}, orderId={}, status={}",
                correlationId,
                data.orderId(),
                status);
    }

    /** Payload published as {@code payment.completed}. */
    public record PaymentCompletedData(String orderId, String paymentId, int amountCents) {
    }

    /** Payload published as {@code payment.failed}. */
    public record PaymentFailedData(String orderId, String paymentId, String reason) {
    }
}

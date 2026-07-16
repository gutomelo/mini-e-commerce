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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
 * <p>The duplicate-{@code orderId} check ({@link PaymentRepository#findByOrderId}) is a fast,
 * friendly pre-check for the common case, but the real guarantee is the database's unique
 * constraint on {@code order_id}: {@link #save(Payment)} flushes immediately and converts a
 * constraint violation into {@link DuplicatePaymentException}, so two different correlation ids
 * racing for the same order can never both succeed — the loser gets the same well-typed conflict
 * the pre-check would have given it if it had lost the race by a wider margin.
 *
 * <p>The outcome event is published only after this method's transaction commits (via a
 * {@link TransactionSynchronization}, when one is active), not inside the transactional boundary
 * itself: publishing inside the transaction would mean a failed commit could still have already
 * emitted an event for a payment that was never actually persisted, and a failed publish would roll
 * back — and thus un-claim and re-decide — a charge that had already been correctly decided. Unit
 * tests (no real Spring transaction) publish immediately, preserving their existing assertions.
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

        Payment payment = save(
                new Payment(data.orderId(), data.totalCents(), status, decision.gatewayReference()),
                data.orderId());

        schedulePublish(correlationId, payment, decision.approved());

        logger.info(
                "Processed order.created event, correlationId={}, orderId={}, status={}",
                correlationId,
                data.orderId(),
                status);
    }

    /**
     * Persists payment, flushing immediately so a concurrent duplicate insert's unique-constraint
     * violation surfaces here — as a well-typed {@link DuplicatePaymentException} — rather than at
     * this method's transaction commit, after the caller has already moved on.
     */
    private Payment save(Payment payment, String orderId) {
        try {
            return paymentRepository.saveAndFlush(payment);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicatePaymentException(orderId);
        }
    }

    /**
     * Publishes the outcome event after this method's transaction commits, if one is active
     * (real Spring-managed execution); otherwise (plain unit tests with fakes, no transaction)
     * publishes immediately.
     */
    private void schedulePublish(String correlationId, Payment payment, boolean approved) {
        Runnable publishTask = () -> publish(correlationId, payment, approved);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            publishTask.run();
                        }
                    });
        } else {
            publishTask.run();
        }
    }

    private void publish(String correlationId, Payment payment, boolean approved) {
        if (approved) {
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
    }

    /** Payload published as {@code payment.completed}. */
    public record PaymentCompletedData(String orderId, String paymentId, int amountCents) {
    }

    /** Payload published as {@code payment.failed}. */
    public record PaymentFailedData(String orderId, String paymentId, String reason) {
    }
}

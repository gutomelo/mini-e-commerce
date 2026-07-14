package com.miniecommerce.payment.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.application.port.ProcessedEventRepository;
import com.miniecommerce.payment.payment.domain.Payment;
import com.miniecommerce.payment.payment.domain.PaymentStatus;
import com.miniecommerce.payment.payment.domain.event.OrderCreatedData;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link ProcessOrderCreatedUseCase}, exercised entirely with fakes — no Spring
 * context, no real Postgres. {@link PaymentRepository} and {@link ProcessedEventRepository} are
 * Spring Data JPA interfaces with a large surface, so rather than hand-implementing every
 * JpaRepository method, a Mockito mock backed by a plain in-memory map/set stands in for the small
 * slice of behavior these tests actually need: {@code save}/{@code findByOrderId} and the atomic
 * {@code tryClaim}.
 */
class ProcessOrderCreatedUseCaseTest {

    private ProcessedEventRepository processedEventRepository;
    private PaymentRepository paymentRepository;
    private InMemoryEventPublisher eventPublisher;
    private Map<UUID, Payment> payments;

    @BeforeEach
    void setUp() {
        Set<String> claimedCorrelationIds = new HashSet<>();
        payments = new LinkedHashMap<>();

        processedEventRepository = mock(ProcessedEventRepository.class);
        when(processedEventRepository.tryClaim(anyString()))
                .thenAnswer(invocation -> claimedCorrelationIds.add(invocation.getArgument(0)));

        paymentRepository = mock(PaymentRepository.class);
        when(paymentRepository.findByOrderId(anyString())).thenAnswer(invocation -> {
            String orderId = invocation.getArgument(0);
            return payments.values().stream().filter(p -> p.getOrderId().equals(orderId)).findFirst();
        });
        when(paymentRepository.save(any())).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            UUID id = payment.getId() != null ? payment.getId() : assignFakeId(payment);
            payments.put(id, payment);
            return payment;
        });

        eventPublisher = new InMemoryEventPublisher();
    }

    private static UUID assignFakeId(Payment payment) {
        try {
            Field idField = Payment.class.getDeclaredField("id");
            idField.setAccessible(true);
            UUID id = UUID.randomUUID();
            idField.set(payment, id);
            return id;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Unable to assign a fake id to Payment", e);
        }
    }

    private ProcessOrderCreatedUseCase useCaseWithGateway(boolean approve) {
        return new ProcessOrderCreatedUseCase(
                processedEventRepository, paymentRepository, new FakePaymentGateway(approve, "gw-ref"), eventPublisher);
    }

    private List<Payment> allPayments() {
        return new ArrayList<>(payments.values());
    }

    @Test
    void successfulChargePersistsCompletedPaymentAndPublishesPaymentCompleted() {
        ProcessOrderCreatedUseCase useCase = useCaseWithGateway(true);
        OrderCreatedData data = new OrderCreatedData("order-1", 4999);

        useCase.execute("corr-1", data);

        assertThat(allPayments()).hasSize(1);
        Payment payment = allPayments().get(0);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(payment.getOrderId()).isEqualTo("order-1");
        assertThat(payment.getAmountCents()).isEqualTo(4999);

        assertThat(eventPublisher.published()).hasSize(1);
        InMemoryEventPublisher.PublishedEvent published = eventPublisher.published().get(0);
        assertThat(published.event()).isEqualTo("payment.completed");
        assertThat(published.correlationId()).isEqualTo("corr-1");
    }

    @Test
    void failedChargePersistsFailedPaymentAndPublishesPaymentFailed() {
        ProcessOrderCreatedUseCase useCase = useCaseWithGateway(false);
        OrderCreatedData data = new OrderCreatedData("order-2", 66600);

        useCase.execute("corr-2", data);

        assertThat(allPayments()).hasSize(1);
        Payment payment = allPayments().get(0);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.FAILED);

        assertThat(eventPublisher.published()).hasSize(1);
        InMemoryEventPublisher.PublishedEvent published = eventPublisher.published().get(0);
        assertThat(published.event()).isEqualTo("payment.failed");
    }

    @Test
    void redeliveringTheSameCorrelationIdDoesNotDoubleProcess() {
        ProcessOrderCreatedUseCase useCase = useCaseWithGateway(true);
        OrderCreatedData data = new OrderCreatedData("order-3", 1500);

        useCase.execute("corr-3", data);
        useCase.execute("corr-3", data);

        assertThat(allPayments()).hasSize(1);
        assertThat(eventPublisher.published()).hasSize(1);
    }

    @Test
    void duplicateOrderIdUnderADifferentCorrelationIdThrowsRatherThanCorruptingState() {
        ProcessOrderCreatedUseCase useCase = useCaseWithGateway(true);
        OrderCreatedData data = new OrderCreatedData("order-4", 2500);

        useCase.execute("corr-4a", data);
        assertThat(allPayments()).hasSize(1);
        assertThat(eventPublisher.published()).hasSize(1);

        assertThatThrownBy(() -> useCase.execute("corr-4b", data)).isInstanceOf(DuplicatePaymentException.class);

        // State is unchanged: no second payment, no second event.
        assertThat(allPayments()).hasSize(1);
        assertThat(eventPublisher.published()).hasSize(1);
    }
}

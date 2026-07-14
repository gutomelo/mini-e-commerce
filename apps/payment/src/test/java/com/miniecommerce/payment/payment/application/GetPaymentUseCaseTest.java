package com.miniecommerce.payment.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.domain.Payment;
import com.miniecommerce.payment.payment.domain.PaymentStatus;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class GetPaymentUseCaseTest {

    private final PaymentRepository paymentRepository = mock(PaymentRepository.class);
    private final GetPaymentUseCase useCase = new GetPaymentUseCase(paymentRepository);

    @Test
    void returnsThePaymentWhenOneExistsForTheOrder() {
        Payment payment = new Payment("order-1", 4999, PaymentStatus.COMPLETED, "gw-ref-1");
        when(paymentRepository.findByOrderId("order-1")).thenReturn(Optional.of(payment));

        Optional<Payment> result = useCase.execute("order-1");

        assertThat(result).contains(payment);
    }

    @Test
    void returnsEmptyWhenNoPaymentExistsForTheOrder() {
        when(paymentRepository.findByOrderId("order-unknown")).thenReturn(Optional.empty());

        Optional<Payment> result = useCase.execute("order-unknown");

        assertThat(result).isEmpty();
    }
}

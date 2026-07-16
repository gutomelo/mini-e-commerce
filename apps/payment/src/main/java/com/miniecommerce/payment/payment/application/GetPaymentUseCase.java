package com.miniecommerce.payment.payment.application;

import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.domain.Payment;
import java.util.Optional;

/**
 * Looks up the payment record for a given order. Returns an empty {@link Optional} when no payment
 * has been processed yet for that order; the presentation layer maps that to a {@code 404} in a
 * later task.
 *
 * <p>Not yet a Spring bean ({@code @Service}): the presentation layer that will construct it (a
 * later task) is expected to wire it explicitly once the real infrastructure adapters exist,
 * consistent with how {@link ProcessOrderCreatedUseCase} is also left unmanaged for now (see that
 * class's Javadoc for why).
 */
public class GetPaymentUseCase {

    private final PaymentRepository paymentRepository;

    public GetPaymentUseCase(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public Optional<Payment> execute(String orderId) {
        return paymentRepository.findByOrderId(orderId);
    }
}

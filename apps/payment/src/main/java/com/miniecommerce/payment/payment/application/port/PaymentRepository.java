package com.miniecommerce.payment.payment.application.port;

import com.miniecommerce.payment.payment.domain.Payment;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Persistence port for {@link Payment}. A Spring Data JPA repository interface used directly as
 * the port — idiomatic for Spring Boot, unlike the Go inventory service's hand-written repository
 * interface (see the Phase 5 spec's Architecture section).
 */
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByOrderId(String orderId);
}

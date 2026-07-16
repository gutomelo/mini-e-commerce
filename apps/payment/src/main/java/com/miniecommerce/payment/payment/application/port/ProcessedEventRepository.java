package com.miniecommerce.payment.payment.application.port;

import com.miniecommerce.payment.payment.domain.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistence port for the {@code processed_events} idempotency marker. The atomic claim
 * ({@link #tryClaim(String)}) is the load-bearing operation: it must be a single
 * {@code INSERT ... ON CONFLICT DO NOTHING} statement so two overlapping deliveries of the same
 * event can never both observe "not yet processed" before either one records it — the race Phase
 * 4's inventory service had to fix after the fact (check-then-act was not atomic). This service
 * builds the atomic claim in from the start.
 */
public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, String> {

    @Modifying
    @Transactional
    @Query(
            value = "INSERT INTO processed_events (correlation_id) VALUES (:correlationId) ON CONFLICT DO NOTHING",
            nativeQuery = true)
    int insertIfAbsent(String correlationId);

    /**
     * Atomically claims {@code correlationId}. Returns {@code true} only for the caller that wins
     * the claim (i.e., the row did not already exist); a {@code false} result means the event was
     * already processed and the caller must treat this as an idempotent no-op.
     */
    default boolean tryClaim(String correlationId) {
        return insertIfAbsent(correlationId) > 0;
    }
}

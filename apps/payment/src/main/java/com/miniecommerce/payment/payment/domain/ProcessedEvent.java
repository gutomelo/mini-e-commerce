package com.miniecommerce.payment.payment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Idempotency marker for an already-processed event, keyed by the event envelope's
 * {@code correlationId}. A row is claimed via an atomic {@code INSERT ... ON CONFLICT DO NOTHING}
 * before any charge processing begins, so only the caller that wins the claim proceeds.
 */
@Entity
@Table(name = "processed_events")
public class ProcessedEvent {

    @Id
    @Column(name = "correlation_id")
    private String correlationId;

    @CreationTimestamp
    @Column(name = "processed_at", nullable = false, updatable = false)
    private Instant processedAt;

    protected ProcessedEvent() {
        // Required by JPA.
    }

    public ProcessedEvent(String correlationId) {
        this.correlationId = correlationId;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }
}

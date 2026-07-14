package com.miniecommerce.payment.payment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/**
 * A processed payment for exactly one order. One row per {@code orderId}: the unique constraint on
 * {@code order_id} is the database-level guarantee that a single order can never be charged twice.
 */
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "order_id", nullable = false, unique = true)
    private String orderId;

    @Column(name = "amount_cents", nullable = false)
    private int amountCents;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;

    @Column(name = "gateway_reference")
    private String gatewayReference;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Payment() {
        // Required by JPA.
    }

    public Payment(String orderId, int amountCents, PaymentStatus status, String gatewayReference) {
        this.orderId = orderId;
        this.amountCents = amountCents;
        this.status = status;
        this.gatewayReference = gatewayReference;
    }

    public UUID getId() {
        return id;
    }

    public String getOrderId() {
        return orderId;
    }

    public int getAmountCents() {
        return amountCents;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public String getGatewayReference() {
        return gatewayReference;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}

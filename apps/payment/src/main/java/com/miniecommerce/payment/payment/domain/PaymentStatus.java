package com.miniecommerce.payment.payment.domain;

/** Outcome of a processed payment. There is no intermediate state: a charge is either accepted or declined. */
public enum PaymentStatus {
    COMPLETED,
    FAILED
}

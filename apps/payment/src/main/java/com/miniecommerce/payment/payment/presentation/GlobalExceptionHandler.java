package com.miniecommerce.payment.payment.presentation;

import com.miniecommerce.payment.payment.application.DuplicatePaymentException;
import com.miniecommerce.payment.payment.presentation.dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Centralized exception-to-HTTP-response mapping for the payment presentation layer, per the
 * project's "centralized exception handling, never expose internal stack traces" rule. Every
 * handler here returns the shared {@link ErrorResponse} shape and never includes exception details
 * (message text only, no stack trace) in the response body.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(PaymentNotFoundException.class)
    public ResponseEntity<ErrorResponse> handlePaymentNotFound(PaymentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(DuplicatePaymentException.class)
    public ResponseEntity<ErrorResponse> handleDuplicatePayment(DuplicatePaymentException e) {
        logger.warn("Rejecting order.created event: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(InvalidWebhookSignatureException.class)
    public ResponseEntity<ErrorResponse> handleInvalidWebhookSignature(InvalidWebhookSignatureException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse("unauthorized"));
    }

    @ExceptionHandler(InvalidWebhookPayloadException.class)
    public ResponseEntity<ErrorResponse> handleInvalidWebhookPayload(InvalidWebhookPayloadException e) {
        logger.warn("Rejecting malformed QStash webhook payload: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse("invalid event payload"));
    }

    @ExceptionHandler(UnsupportedEventException.class)
    public ResponseEntity<ErrorResponse> handleUnsupportedEvent(UnsupportedEventException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse("unsupported event type"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        logger.error("Unhandled exception in payment presentation layer", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse("internal error"));
    }
}

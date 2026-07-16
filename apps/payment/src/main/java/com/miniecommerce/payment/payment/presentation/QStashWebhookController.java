package com.miniecommerce.payment.payment.presentation;

import com.miniecommerce.payment.payment.application.ProcessOrderCreatedUseCase;
import com.miniecommerce.payment.payment.domain.event.EventEnvelope;
import com.miniecommerce.payment.payment.domain.event.OrderCreatedData;
import com.miniecommerce.payment.payment.infrastructure.qstash.QStashSignatureVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Consumes {@code order.created} events delivered by Upstash QStash.
 *
 * <p>This is the one route in the service that does NOT authenticate via
 * {@link InternalApiKeyFilter} ({@code X-Internal-Api-Key}): QStash cannot be configured to send a
 * custom header, so it authenticates via the {@code Upstash-Signature} header instead, verified
 * against the raw request body. The signature is checked before the body is deserialized or acted
 * on in any way.
 */
@RestController
public class QStashWebhookController {

    private static final Logger logger = LoggerFactory.getLogger(QStashWebhookController.class);

    private static final String UPSTASH_SIGNATURE_HEADER = "Upstash-Signature";
    private static final String ORDER_CREATED_EVENT = "order.created";

    private static final TypeReference<EventEnvelope<OrderCreatedData>> ORDER_CREATED_ENVELOPE_TYPE =
            new TypeReference<>() {
            };

    private final QStashSignatureVerifier signatureVerifier;
    private final ProcessOrderCreatedUseCase processOrderCreatedUseCase;
    private final ObjectMapper objectMapper;
    private final String destinationUrl;

    public QStashWebhookController(
            QStashSignatureVerifier signatureVerifier,
            ProcessOrderCreatedUseCase processOrderCreatedUseCase,
            ObjectMapper objectMapper,
            @Value("${payment.qstash.destination-url}") String destinationUrl) {
        this.signatureVerifier = signatureVerifier;
        this.processOrderCreatedUseCase = processOrderCreatedUseCase;
        this.objectMapper = objectMapper;
        this.destinationUrl = destinationUrl;
    }

    @PostMapping("/internal/v1/events/qstash")
    public ResponseEntity<Void> handle(
            @RequestHeader(value = UPSTASH_SIGNATURE_HEADER, required = false) String signature,
            @RequestBody String rawBody) {
        if (signature == null || !signatureVerifier.verify(signature, destinationUrl, rawBody)) {
            logger.warn("QStash webhook: signature verification failed");
            throw new InvalidWebhookSignatureException("Invalid or missing Upstash-Signature header");
        }

        EventEnvelope<OrderCreatedData> envelope = parseEnvelope(rawBody);

        if (!ORDER_CREATED_EVENT.equals(envelope.event())) {
            logger.warn(
                    "QStash webhook: unexpected event type, ignoring, event={}, correlationId={}",
                    envelope.event(),
                    envelope.correlationId());
            throw new UnsupportedEventException(envelope.event());
        }

        processOrderCreatedUseCase.execute(envelope.correlationId(), envelope.data());

        logger.info("QStash webhook: order.created consumed, correlationId={}", envelope.correlationId());
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    private EventEnvelope<OrderCreatedData> parseEnvelope(String rawBody) {
        try {
            return objectMapper.readValue(rawBody, ORDER_CREATED_ENVELOPE_TYPE);
        } catch (Exception e) {
            throw new InvalidWebhookPayloadException("Malformed order.created event payload", e);
        }
    }
}

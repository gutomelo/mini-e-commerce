package com.miniecommerce.payment.payment.infrastructure.qstash;

import com.miniecommerce.payment.payment.application.port.EventPublisher;
import com.miniecommerce.payment.payment.domain.event.EventEnvelope;
import java.net.URI;
import java.time.Instant;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

/**
 * Real {@link EventPublisher} implementation: publishes an event through Upstash QStash's publish
 * API ({@code POST https://qstash.upstash.io/v2/publish/{destination}}), wrapping the payload in the
 * shared {@link EventEnvelope} shape (event, correlationId, timestamp, data) every consumer in this
 * system expects.
 *
 * <p>The destination URL and token are constructor parameters rather than read from the environment
 * here, keeping this class explicit and easy to unit test with a mock HTTP server; a later task's
 * Spring configuration wires the real values from {@code PAYMENT_QSTASH_DESTINATION_URL} and
 * {@code QSTASH_TOKEN}.
 */
public class QStashEventPublisher implements EventPublisher {

    private static final String QSTASH_PUBLISH_BASE_URL = "https://qstash.upstash.io/v2/publish/";

    private final RestClient restClient;
    private final String destinationUrl;
    private final String token;

    public QStashEventPublisher(RestClient.Builder restClientBuilder, String destinationUrl, String token) {
        this.restClient = restClientBuilder.build();
        this.destinationUrl = destinationUrl;
        this.token = token;
    }

    @Override
    public void publish(String event, String correlationId, Object data) {
        EventEnvelope<Object> envelope = new EventEnvelope<>(event, correlationId, Instant.now(), data);

        // Built as a pre-resolved URI (not a URI template string) so the destination URL's own
        // "://" is preserved as-is rather than being re-normalized by template parsing.
        URI publishUri = URI.create(QSTASH_PUBLISH_BASE_URL + destinationUrl);

        restClient
                .post()
                .uri(publishUri)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(envelope)
                .retrieve()
                .toBodilessEntity();
    }
}

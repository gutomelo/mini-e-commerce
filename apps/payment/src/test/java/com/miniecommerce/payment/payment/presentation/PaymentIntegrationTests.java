package com.miniecommerce.payment.payment.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.miniecommerce.payment.payment.infrastructure.fake.InMemoryEventPublisher;
import com.miniecommerce.payment.payment.infrastructure.fake.InMemoryEventPublisher.PublishedEvent;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Self-contained Spring Boot integration tests proving every acceptance criterion of
 * {@code docs/specs/2026-07-14-payment-service.md}'s "Acceptance Criteria" section against the
 * fully assembled HTTP surface: real servlet filter chain ({@link InternalApiKeyFilter}), real
 * controllers ({@link PaymentController}, {@link QStashWebhookController}), real
 * {@link com.miniecommerce.payment.payment.application.ProcessOrderCreatedUseCase}, real Postgres
 * repositories/Flyway migrations, and the {@link InMemoryEventPublisher} bean wired by
 * {@code PaymentBeanConfiguration}.
 *
 * <p><b>Why {@code @SpringBootTest} + {@code MockMvc} instead of a {@code @WebMvcTest} slice:</b> a
 * {@code @WebMvcTest} slice only loads the web layer and mocked collaborators, which would either
 * bypass {@link InternalApiKeyFilter} or force every controller dependency to be mocked, defeating
 * the point of an end-to-end acceptance test. A full {@code @SpringBootTest} with
 * {@code @AutoConfigureMockMvc} boots the entire context (filters included) and drives it through
 * the real servlet dispatch path, exactly like a live HTTP request would.
 *
 * <p><b>Test-database strategy:</b> gated on {@code PAYMENT_DATABASE_URL}, mirroring the exact
 * convention {@code apps/inventory}'s Go integration tests
 * ({@code internal/presentation/http/integration_test.go}) and {@code apps/api}'s Jest e2e tests
 * already use in this monorepo: skip cleanly (never hard-fail) when no test database is configured,
 * via a static {@code @BeforeAll} {@code Assumptions.assumeTrue} check. Because a JUnit 5
 * {@code @BeforeAll} failure aborts the whole class before JUnit instantiates any test instance,
 * this runs before {@code SpringExtension} ever attempts to build the {@code ApplicationContext} —
 * so an unset env var never triggers a doomed Postgres connection attempt.
 *
 * <p>Every test uses its own randomly generated {@code orderId}/{@code correlationId} (the same
 * technique {@code apps/inventory}'s own Postgres integration tests use), so tests are independent
 * of each other and of any rows left behind by a previous run — no truncate-before-run step is
 * needed for idempotent reruns, since the {@code order_id} unique constraint could otherwise cause
 * spurious failures across reruns of a fixed id.
 *
 * <p><b>Shared {@code InMemoryEventPublisher} bean across test methods:</b> Spring's default test
 * context caching reuses one {@code ApplicationContext} (and therefore one
 * {@code InMemoryEventPublisher} instance) across every test method in this class, so
 * {@code publisher.published()} accumulates events from every test that has already run. Rather
 * than adding a {@code clear()} method to a class that is also used in production (which would
 * invite test-only surface area on a production bean), each test captures a baseline count of
 * matching events before acting and asserts the increase caused by that test's own
 * {@code correlationId} — robust regardless of run order or accumulated history.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            // Re-enable the DataSource/Flyway/Hibernate autoconfiguration that
            // src/test/resources/application.properties excludes for the plain contextLoads()
            // smoke test — this class needs a real, working datasource against a real test
            // database, with Flyway migrations actually applied.
            "spring.autoconfigure.exclude=",
            // src/test/resources/application.properties shadows src/main/resources/application.properties
            // entirely on the test classpath (Spring Boot loads only the first
            // classpath:/application.properties it finds, it does not merge same-named files), so
            // spring.datasource.url must be set explicitly here rather than relying on the main
            // resource file's ${PAYMENT_DATABASE_URL} placeholder.
            "spring.datasource.url=${PAYMENT_DATABASE_URL}",
            "payment.internal-api-key=" + PaymentIntegrationTests.INTERNAL_API_KEY,
            "qstash.current-signing-key=" + PaymentIntegrationTests.CURRENT_SIGNING_KEY,
            "qstash.next-signing-key=" + PaymentIntegrationTests.NEXT_SIGNING_KEY,
            "payment.qstash.destination-url=" + PaymentIntegrationTests.DESTINATION_URL,
        })
@AutoConfigureMockMvc
class PaymentIntegrationTests {

    static final String INTERNAL_API_KEY = "integration-test-internal-api-key";
    static final String CURRENT_SIGNING_KEY = "integration-test-current-signing-key-0123456789ab";
    static final String NEXT_SIGNING_KEY = "integration-test-next-signing-key-0123456789abcdef";
    static final String DESTINATION_URL = "https://payment.example.com/internal/v1/events/qstash";

    private static final String PAYMENTS_PATH = "/internal/v1/payments/";
    private static final String QSTASH_WEBHOOK_PATH = "/internal/v1/events/qstash";
    private static final String API_KEY_HEADER = "X-Internal-Api-Key";
    private static final String SIGNATURE_HEADER = "Upstash-Signature";
    private static final int SENTINEL_DECLINE_AMOUNT_CENTS = 66_600;

    @BeforeAll
    static void requireTestDatabase() {
        String databaseUrl = System.getenv("PAYMENT_DATABASE_URL");
        Assumptions.assumeTrue(
                databaseUrl != null && !databaseUrl.isBlank(),
                "PAYMENT_DATABASE_URL not set, skipping payment integration tests");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InMemoryEventPublisher eventPublisher;

    // ---- Acceptance criterion 1: GET /internal/v1/payments/{orderId} ----

    @Test
    void getPaymentReturnsTheRecordForAProcessedOrder() throws Exception {
        String orderId = newOrderId();
        String correlationId = newCorrelationId();
        submitOrderCreated(correlationId, orderId, 4_999);

        mockMvc.perform(get(PAYMENTS_PATH + orderId).header(API_KEY_HEADER, INTERNAL_API_KEY))
                .andExpect(status().isOk());
    }

    @Test
    void getPaymentReturns404ForAnUnknownOrder() throws Exception {
        String unknownOrderId = newOrderId();

        mockMvc.perform(get(PAYMENTS_PATH + unknownOrderId).header(API_KEY_HEADER, INTERNAL_API_KEY))
                .andExpect(status().isNotFound());
    }

    @Test
    void getPaymentRejectsARequestMissingTheApiKey() throws Exception {
        String orderId = newOrderId();

        mockMvc.perform(get(PAYMENTS_PATH + orderId)).andExpect(status().isUnauthorized());
    }

    // ---- Acceptance criterion 2: ordinary order.created payload ----

    @Test
    void ordinaryOrderCreatedPayloadIsProcessedAndPublishesExactlyOneEvent() throws Exception {
        String orderId = newOrderId();
        String correlationId = newCorrelationId();

        submitOrderCreated(correlationId, orderId, 4_999);

        String status = fetchPaymentStatus(orderId);
        assertThat(status).isIn("COMPLETED", "FAILED");

        List<PublishedEvent> matching = eventsForCorrelationId(correlationId);
        assertThat(matching).hasSize(1);
        assertThat(matching.get(0).event()).isIn("payment.completed", "payment.failed");
    }

    // ---- Acceptance criterion 3: sentinel amount always fails ----

    @Test
    void sentinelAmountAlwaysFailsAndPublishesPaymentFailed() throws Exception {
        String orderId = newOrderId();
        String correlationId = newCorrelationId();

        submitOrderCreated(correlationId, orderId, SENTINEL_DECLINE_AMOUNT_CENTS);

        assertThat(fetchPaymentStatus(orderId)).isEqualTo("FAILED");

        List<PublishedEvent> matching = eventsForCorrelationId(correlationId);
        assertThat(matching).hasSize(1);
        assertThat(matching.get(0).event()).isEqualTo("payment.failed");
    }

    // ---- Acceptance criterion 4: idempotent redelivery ----

    @Test
    void redeliveringTheIdenticalPayloadDoesNotDoubleProcess() throws Exception {
        String orderId = newOrderId();
        String correlationId = newCorrelationId();
        String payload = orderCreatedPayload(correlationId, orderId, 4_999);
        String signature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, payload);

        // First delivery: processed normally.
        mockMvc.perform(
                        post(QSTASH_WEBHOOK_PATH)
                                .header(SIGNATURE_HEADER, signature)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                .andExpect(status().isOk());

        String statusAfterFirstDelivery = fetchPaymentStatus(orderId);
        int eventsAfterFirstDelivery = eventsForCorrelationId(correlationId).size();
        assertThat(eventsAfterFirstDelivery).isEqualTo(1);

        // Second, identical delivery (same correlationId): must be a no-op.
        mockMvc.perform(
                        post(QSTASH_WEBHOOK_PATH)
                                .header(SIGNATURE_HEADER, signature)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                .andExpect(status().isOk());

        assertThat(fetchPaymentStatus(orderId)).isEqualTo(statusAfterFirstDelivery);
        assertThat(eventsForCorrelationId(correlationId)).hasSize(eventsAfterFirstDelivery);
    }

    // ---- Acceptance criterion 5: incorrectly signed payload ----

    @Test
    void incorrectlySignedPayloadIsRejectedAndNeverProcessed() throws Exception {
        String orderId = newOrderId();
        String correlationId = newCorrelationId();
        String payload = orderCreatedPayload(correlationId, orderId, 4_999);

        // Signed with a key the server does not recognize.
        String wrongSignature = sign("some-other-unknown-signing-key-0123456789", DESTINATION_URL, payload);

        mockMvc.perform(
                        post(QSTASH_WEBHOOK_PATH)
                                .header(SIGNATURE_HEADER, wrongSignature)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get(PAYMENTS_PATH + orderId).header(API_KEY_HEADER, INTERNAL_API_KEY))
                .andExpect(status().isNotFound());
        assertThat(eventsForCorrelationId(correlationId)).isEmpty();
    }

    @Test
    void tamperedBodyWithAValidSignatureIsRejectedAndNeverProcessed() throws Exception {
        String orderId = newOrderId();
        String correlationId = newCorrelationId();
        String payload = orderCreatedPayload(correlationId, orderId, 4_999);
        String signature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, payload);
        // Any byte-level change invalidates the signature's body hash, regardless of whether the
        // result is still valid JSON — the signature is verified against the raw body before any
        // parsing happens.
        String tamperedPayload = payload + " ";

        mockMvc.perform(
                        post(QSTASH_WEBHOOK_PATH)
                                .header(SIGNATURE_HEADER, signature)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(tamperedPayload))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get(PAYMENTS_PATH + orderId).header(API_KEY_HEADER, INTERNAL_API_KEY))
                .andExpect(status().isNotFound());
        assertThat(eventsForCorrelationId(correlationId)).isEmpty();
    }

    // ---- Acceptance criterion 6: order.created for an orderId that already has a payment ----

    @Test
    void orderCreatedForAnAlreadyPaidOrderIdIsRejectedAsAConflictAndLeavesTheExistingPaymentUnchanged()
            throws Exception {
        String orderId = newOrderId();
        String firstCorrelationId = newCorrelationId();
        submitOrderCreated(firstCorrelationId, orderId, 4_999);

        String beforeConflictStatus = fetchPaymentStatus(orderId);

        String secondCorrelationId = newCorrelationId();
        String secondPayload = orderCreatedPayload(secondCorrelationId, orderId, 4_999);
        String secondSignature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, secondPayload);

        mockMvc.perform(
                        post(QSTASH_WEBHOOK_PATH)
                                .header(SIGNATURE_HEADER, secondSignature)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(secondPayload))
                .andExpect(status().isConflict());

        assertThat(fetchPaymentStatus(orderId)).isEqualTo(beforeConflictStatus);
        assertThat(eventsForCorrelationId(secondCorrelationId)).isEmpty();
    }

    // ---- Helpers ----

    private void submitOrderCreated(String correlationId, String orderId, int totalCents) throws Exception {
        String payload = orderCreatedPayload(correlationId, orderId, totalCents);
        String signature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, payload);

        mockMvc.perform(
                        post(QSTASH_WEBHOOK_PATH)
                                .header(SIGNATURE_HEADER, signature)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                .andExpect(status().isOk());
    }

    private String fetchPaymentStatus(String orderId) throws Exception {
        MvcResult result =
                mockMvc.perform(get(PAYMENTS_PATH + orderId).header(API_KEY_HEADER, INTERNAL_API_KEY))
                        .andExpect(status().isOk())
                        .andReturn();
        String body = result.getResponse().getContentAsString();
        // Minimal extraction to avoid pulling in a JSON-path dependency for one field.
        String marker = "\"status\":\"";
        int start = body.indexOf(marker) + marker.length();
        int end = body.indexOf('"', start);
        return body.substring(start, end);
    }

    private List<PublishedEvent> eventsForCorrelationId(String correlationId) {
        return eventPublisher.published().stream()
                .filter(event -> event.correlationId().equals(correlationId))
                .collect(Collectors.toList());
    }

    private static String newOrderId() {
        return UUID.randomUUID().toString();
    }

    private static String newCorrelationId() {
        return UUID.randomUUID().toString();
    }

    private static String orderCreatedPayload(String correlationId, String orderId, int totalCents) {
        return String.format(
                "{\"event\":\"order.created\",\"correlationId\":\"%s\",\"timestamp\":\"%s\","
                        + "\"data\":{\"orderId\":\"%s\",\"totalCents\":%d}}",
                correlationId, Instant.now(), orderId, totalCents);
    }

    private static String sign(String signingKey, String destinationUrl, String body) {
        SecretKey key = new SecretKeySpec(signingKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return Jwts.builder()
                .issuer("Upstash")
                .subject(destinationUrl)
                .claim("body", hash(body))
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plus(1, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    private static String hash(String body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(body.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}

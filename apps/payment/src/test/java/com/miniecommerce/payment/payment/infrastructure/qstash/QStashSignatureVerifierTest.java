package com.miniecommerce.payment.payment.infrastructure.qstash;

import static org.assertj.core.api.Assertions.assertThat;

import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link QStashSignatureVerifier}. Rather than requiring a live Upstash account (see
 * the Phase 5 spec's Non-Goals: no real QStash round-trip in automated verification), these tests
 * hand-sign JWTs with the same {@code jjwt} library the production code uses, mirroring the
 * technique apps/inventory's Go signature tests use for the same reason.
 */
class QStashSignatureVerifierTest {

    // HS256 requires a key of at least 256 bits (32 bytes); real QSTASH_*_SIGNING_KEY values are
    // long random Upstash-issued strings, so these test keys are padded out to a realistic length.
    private static final String CURRENT_SIGNING_KEY = "current-signing-key-0123456789abcdef";
    private static final String NEXT_SIGNING_KEY = "next-signing-key-0123456789abcdefghi";
    private static final String DESTINATION_URL = "https://payment.example.com/internal/v1/events/qstash";
    private static final String BODY = "{\"event\":\"order.created\",\"correlationId\":\"abc-123\"}";

    private static String sign(String signingKey, String destinationUrl, String body) {
        String bodyHash = hash(body);
        SecretKey key = new SecretKeySpec(signingKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");

        return Jwts.builder()
                .issuer("Upstash")
                .subject(destinationUrl)
                .claim("body", bodyHash)
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

    @Test
    void validSignatureFromTheCurrentKeyVerifies() {
        QStashSignatureVerifier verifier = new QStashSignatureVerifier(CURRENT_SIGNING_KEY, NEXT_SIGNING_KEY);
        String signature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, BODY);

        assertThat(verifier.verify(signature, DESTINATION_URL, BODY)).isTrue();
    }

    @Test
    void validSignatureFromTheNextKeyVerifies() {
        QStashSignatureVerifier verifier = new QStashSignatureVerifier(CURRENT_SIGNING_KEY, NEXT_SIGNING_KEY);
        String signature = sign(NEXT_SIGNING_KEY, DESTINATION_URL, BODY);

        assertThat(verifier.verify(signature, DESTINATION_URL, BODY)).isTrue();
    }

    @Test
    void tamperedBodyFails() {
        QStashSignatureVerifier verifier = new QStashSignatureVerifier(CURRENT_SIGNING_KEY, NEXT_SIGNING_KEY);
        String signature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, BODY);

        String tamperedBody = BODY + "tampered";

        assertThat(verifier.verify(signature, DESTINATION_URL, tamperedBody)).isFalse();
    }

    @Test
    void signatureFromAnUnknownKeyFails() {
        QStashSignatureVerifier verifier = new QStashSignatureVerifier(CURRENT_SIGNING_KEY, NEXT_SIGNING_KEY);
        String signature = sign("some-other-key-0123456789abcdefghi", DESTINATION_URL, BODY);

        assertThat(verifier.verify(signature, DESTINATION_URL, BODY)).isFalse();
    }

    @Test
    void mismatchedDestinationUrlFails() {
        QStashSignatureVerifier verifier = new QStashSignatureVerifier(CURRENT_SIGNING_KEY, NEXT_SIGNING_KEY);
        String signature = sign(CURRENT_SIGNING_KEY, DESTINATION_URL, BODY);

        assertThat(verifier.verify(signature, "https://attacker.example.com/webhook", BODY)).isFalse();
    }

    @Test
    void blankSignatureFails() {
        QStashSignatureVerifier verifier = new QStashSignatureVerifier(CURRENT_SIGNING_KEY, NEXT_SIGNING_KEY);

        assertThat(verifier.verify("", DESTINATION_URL, BODY)).isFalse();
    }
}

package com.miniecommerce.payment.payment.infrastructure.qstash;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/**
 * Verifies the {@code Upstash-Signature} header of inbound QStash webhook requests against the
 * account's signing keys.
 *
 * <p>QStash signs each delivered request with a JWT (issuer {@code "Upstash"}, subject the
 * destination URL, and a {@code body} claim carrying the base64url-encoded SHA-256 hash of the
 * request body), using an HMAC key. There is no official Upstash Java SDK equivalent to the Go
 * {@code qstash-go} module apps/inventory uses for the same purpose, so this hand-rolls verification
 * with {@code io.jsonwebtoken:jjwt} — a mainstream, well-audited JWT library — rather than
 * implementing HMAC/JWT parsing from scratch, since getting cryptographic verification subtly wrong
 * (timing side channels, algorithm confusion, hash-comparison mistakes) is a real security risk.
 */
public class QStashSignatureVerifier {

    private static final String ISSUER = "Upstash";
    private static final String BODY_CLAIM = "body";

    private final SecretKey currentSigningKey;
    private final SecretKey nextSigningKey;

    /**
     * Constructs a verifier from the account's current and next signing keys
     * ({@code QSTASH_CURRENT_SIGNING_KEY} / {@code QSTASH_NEXT_SIGNING_KEY}). Both are accepted,
     * current tried first, because QStash rotates keys and accepts signatures made with either key
     * during the rotation window.
     */
    public QStashSignatureVerifier(String currentSigningKey, String nextSigningKey) {
        this.currentSigningKey = toKey(currentSigningKey);
        this.nextSigningKey = toKey(nextSigningKey);
    }

    private static SecretKey toKey(String signingKey) {
        return new SecretKeySpec(signingKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /**
     * Verifies that {@code signature} (the raw {@code Upstash-Signature} header value) is a valid,
     * unexpired JWT signed by either the current or next signing key, whose claims match
     * {@code destinationUrl} and {@code body}.
     *
     * @return {@code true} if the signature is valid and its claims match; {@code false} otherwise
     *     (never throws for an invalid/tampered signature or mismatched claims).
     */
    public boolean verify(String signature, String destinationUrl, String body) {
        if (signature == null || signature.isBlank()) {
            return false;
        }

        Claims claims = parseClaims(signature, currentSigningKey);
        if (claims == null) {
            claims = parseClaims(signature, nextSigningKey);
        }
        if (claims == null) {
            return false;
        }

        if (!ISSUER.equals(claims.getIssuer())) {
            return false;
        }
        if (!destinationUrl.equals(claims.getSubject())) {
            return false;
        }

        String expectedBodyHash = claims.get(BODY_CLAIM, String.class);
        return expectedBodyHash != null && expectedBodyHash.equals(hashBody(body));
    }

    private static Claims parseClaims(String signature, SecretKey key) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(signature)
                    .getPayload();
        } catch (JwtException e) {
            return null;
        }
    }

    private static String hashBody(String body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(body.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}

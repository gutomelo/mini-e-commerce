package com.miniecommerce.payment.payment.presentation;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Guards every internal route with a shared-secret header, {@code X-Internal-Api-Key}, except
 * {@code GET /health} (unauthenticated by design, per the walking-skeleton health contract) and
 * {@code POST /internal/v1/events/qstash} (authenticated instead via the {@code Upstash-Signature}
 * header, since QStash cannot be configured to send a custom header).
 *
 * <p>Registered as a {@code @Component}: any {@link jakarta.servlet.Filter} bean is auto-registered
 * by Spring Boot for all routes, so the exclusion logic lives in {@link #shouldNotFilter}
 * rather than requiring a separate {@code FilterRegistrationBean} just to express a URL pattern —
 * the simplest idiom for "apply everywhere except these two routes."
 *
 * <p>The comparison uses {@link MessageDigest#isEqual(byte[], byte[])}, not {@link String#equals},
 * because {@code String.equals} short-circuits on the first mismatched byte and so leaks timing
 * information an attacker could use to brute-force the key one byte at a time.
 */
@Component
public class InternalApiKeyFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-Internal-Api-Key";
    private static final String HEALTH_PATH = "/health";
    private static final String QSTASH_WEBHOOK_PATH = "/internal/v1/events/qstash";

    private final byte[] expectedApiKey;

    public InternalApiKeyFilter(@Value("${payment.internal-api-key}") String expectedApiKey) {
        this.expectedApiKey = expectedApiKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        boolean isHealthCheck = HttpMethod.GET.matches(request.getMethod()) && HEALTH_PATH.equals(path);
        boolean isQStashWebhook = HttpMethod.POST.matches(request.getMethod()) && QSTASH_WEBHOOK_PATH.equals(path);
        return isHealthCheck || isQStashWebhook;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String providedApiKey = request.getHeader(API_KEY_HEADER);
        byte[] provided =
                providedApiKey == null ? new byte[0] : providedApiKey.getBytes(StandardCharsets.UTF_8);

        if (!MessageDigest.isEqual(provided, expectedApiKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}

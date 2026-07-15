package com.miniecommerce.payment.payment.presentation;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads (or generates) a correlation id for every plain REST request, making it available to
 * structured logs for the duration of the request and echoing it back on the response.
 *
 * <p>Reuses the same header name, {@code X-Correlation-Id}, that {@code apps/api}'s own
 * correlation-id middleware and {@code apps/inventory}'s equivalent filter establish, so a single
 * id can be traced across services. When the header is absent or blank, a fresh
 * {@link UUID#randomUUID()} value is generated and echoed back — the caller then has an id to
 * quote in follow-up questions/logs even if it never sent one itself.
 *
 * <p>The id is stored in SLF4J's {@link MDC} under {@code correlationId} for the lifetime of the
 * request, so every log line emitted while handling the request automatically includes it (see
 * the {@code logging.pattern.level} property in {@code application.properties}), without having to
 * pass the id explicitly to every logger call. The MDC entry is removed in a {@code finally} block
 * regardless of outcome, since application servers run requests on pooled threads: leaving a stale
 * value behind would leak this request's correlation id into an unrelated later request handled by
 * the same thread.
 *
 * <p>Registered as a {@code @Component}, the same idiom {@link InternalApiKeyFilter} uses, so
 * Spring Boot auto-registers it for every route rather than requiring a separate
 * {@code FilterRegistrationBean} to express a URL pattern. Running it on every route (including
 * {@code /health} and the QStash webhook) is harmless: the QStash webhook path sources its own
 * correlation id from the event envelope rather than from this filter's MDC value or response
 * header, so this filter merely sets an MDC entry that path does not read, and overwrites it with
 * its own value immediately after — no conflict, since the two mechanisms never observe each
 * other's value.
 */
@Component
public class CorrelationIdFilter extends OncePerRequestFilter {

    static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        response.setHeader(CORRELATION_ID_HEADER, correlationId);

        MDC.put(MDC_KEY, correlationId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}

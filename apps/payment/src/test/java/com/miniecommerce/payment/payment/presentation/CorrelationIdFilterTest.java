package com.miniecommerce.payment.payment.presentation;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Unit tests for {@link CorrelationIdFilter}: a provided header is preserved and echoed, a missing
 * one is generated and echoed, the id is visible in {@link MDC} while the filter chain runs, and
 * the MDC entry is cleared afterward so it cannot leak into an unrelated request on the same
 * pooled thread.
 */
class CorrelationIdFilterTest {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    @Test
    void preservesAndEchoesAProvidedCorrelationId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/payments/order-1");
        request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, "provided-correlation-id");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = (req, res) -> { };

        filter.doFilter(request, response, filterChain);

        assertThat(response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER))
                .isEqualTo("provided-correlation-id");
    }

    @Test
    void generatesAndEchoesAFreshCorrelationIdWhenHeaderIsMissing() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/payments/order-1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = (req, res) -> { };

        filter.doFilter(request, response, filterChain);

        String generated = response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        assertThat(generated).isNotBlank();
    }

    @Test
    void generatesAndEchoesAFreshCorrelationIdWhenHeaderIsBlank() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/payments/order-1");
        request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, "   ");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = (req, res) -> { };

        filter.doFilter(request, response, filterChain);

        String generated = response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        assertThat(generated).isNotBlank().isNotEqualTo("   ");
    }

    @Test
    void makesTheCorrelationIdAvailableViaMdcDuringTheFilterChainAndClearsItAfterward() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/payments/order-1");
        request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, "mdc-correlation-id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        String[] mdcValueDuringChain = new String[1];
        FilterChain filterChain = (req, res) -> mdcValueDuringChain[0] = MDC.get(CorrelationIdFilter.MDC_KEY);

        filter.doFilter(request, response, filterChain);

        assertThat(mdcValueDuringChain[0]).isEqualTo("mdc-correlation-id");
        assertThat(MDC.get(CorrelationIdFilter.MDC_KEY)).isNull();
    }

    @Test
    void clearsMdcEntryEvenWhenTheFilterChainThrows() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/payments/order-1");
        request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, "error-correlation-id");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = (req, res) -> {
            throw new RuntimeException("downstream failure");
        };

        try {
            filter.doFilter(request, response, filterChain);
        } catch (Exception expected) {
            // Expected: propagating the downstream failure is correct; the assertion below is
            // the actual point of this test.
        }

        assertThat(MDC.get(CorrelationIdFilter.MDC_KEY)).isNull();
    }
}

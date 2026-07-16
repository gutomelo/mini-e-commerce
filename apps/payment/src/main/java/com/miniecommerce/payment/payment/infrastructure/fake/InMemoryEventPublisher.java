package com.miniecommerce.payment.payment.infrastructure.fake;

import com.miniecommerce.payment.payment.application.port.EventPublisher;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory {@link EventPublisher} that records every published event instead of making a real
 * HTTP call. Used as the default {@code EventPublisher} bean for local development and every
 * automated test in this service (mirroring Phase 4's inventory service precedent), and by unit
 * tests that need to assert exactly what was published.
 *
 * <p>Originally written as a test-scoped fake for {@code ProcessOrderCreatedUseCaseTest}; promoted
 * here (production-visible) so a later task's Spring configuration can wire it as the default
 * {@link EventPublisher} bean.
 */
public class InMemoryEventPublisher implements EventPublisher {

    /** One recorded call to {@link #publish(String, String, Object)}. */
    public record PublishedEvent(String event, String correlationId, Object data) {
    }

    private final List<PublishedEvent> published = Collections.synchronizedList(new ArrayList<>());

    @Override
    public void publish(String event, String correlationId, Object data) {
        published.add(new PublishedEvent(event, correlationId, data));
    }

    /** Returns a snapshot of every event published so far, in publish order. */
    public List<PublishedEvent> published() {
        synchronized (published) {
            return new ArrayList<>(published);
        }
    }
}

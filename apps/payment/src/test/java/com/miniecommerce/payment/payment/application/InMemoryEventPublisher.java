package com.miniecommerce.payment.payment.application;

import com.miniecommerce.payment.payment.application.port.EventPublisher;
import java.util.ArrayList;
import java.util.List;

/**
 * Hand-written in-memory fake {@link EventPublisher} for unit tests: records every published event
 * so a test can assert exactly what (and how many times) was published, without any real HTTP call.
 */
class InMemoryEventPublisher implements EventPublisher {

    record PublishedEvent(String event, String correlationId, Object data) {
    }

    private final List<PublishedEvent> published = new ArrayList<>();

    @Override
    public void publish(String event, String correlationId, Object data) {
        published.add(new PublishedEvent(event, correlationId, data));
    }

    List<PublishedEvent> published() {
        return published;
    }
}

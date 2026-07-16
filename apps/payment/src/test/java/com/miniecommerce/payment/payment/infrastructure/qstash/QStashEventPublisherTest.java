package com.miniecommerce.payment.payment.infrastructure.qstash;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Unit test for {@link QStashEventPublisher}, asserting the outbound request is well-formed against
 * a {@link MockRestServiceServer} rather than a live Upstash account (see the Phase 5 spec's
 * Non-Goals: no real QStash round-trip in automated verification).
 */
class QStashEventPublisherTest {

    private static final String DESTINATION_URL = "https://order-service.example.com/internal/v1/events/qstash";
    private static final String TOKEN = "test-qstash-token";

    private MockRestServiceServer mockServer;
    private QStashEventPublisher publisher;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        publisher = new QStashEventPublisher(builder, DESTINATION_URL, TOKEN);
    }

    @Test
    void publishesAWellFormedRequestToTheQStashPublishEndpoint() {
        record PaymentCompletedData(String orderId, String paymentId, int amountCents) {
        }

        mockServer
                .expect(requestTo("https://qstash.upstash.io/v2/publish/" + DESTINATION_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer " + TOKEN))
                .andExpect(header("Content-Type", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json(
                        """
                        {
                          "event": "payment.completed",
                          "correlationId": "corr-1",
                          "data": { "orderId": "order-1", "paymentId": "payment-1", "amountCents": 4999 }
                        }
                        """))
                .andRespond(withSuccess());

        publisher.publish("payment.completed", "corr-1", new PaymentCompletedData("order-1", "payment-1", 4999));

        mockServer.verify();
    }
}

package com.miniecommerce.payment.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the walking-skeleton health contract at {@code GET /health}.
 * Spring Actuator endpoints remain at their default {@code /actuator/*} paths.
 */
@RestController
public class HealthController {

    private static final HealthResponse RESPONSE = new HealthResponse("ok", "payment");

    @GetMapping("/health")
    public HealthResponse health() {
        return RESPONSE;
    }
}

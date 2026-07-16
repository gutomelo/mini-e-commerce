package com.miniecommerce.payment;

import com.miniecommerce.payment.payment.application.port.PaymentRepository;
import com.miniecommerce.payment.payment.application.port.ProcessedEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Smoke test verifying the full {@code ApplicationContext} wires up. JPA/DataSource/Flyway
 * autoconfiguration is excluded (see {@code src/test/resources/application.properties}) so this
 * does not require a live Postgres instance; a dedicated integration-test database/profile
 * (Testcontainers or equivalent) is a later task's job.
 *
 * <p>{@link PaymentRepository} and {@link ProcessedEventRepository} are Spring Data JPA repository
 * interfaces that only become beans through the (excluded) JPA autoconfiguration, but
 * {@code PaymentBeanConfiguration}'s use-case beans depend on them directly — so this test stands
 * them in with Mockito mocks purely to satisfy wiring, not to exercise any behavior.
 */
@SpringBootTest
class PaymentApplicationTests {

	@MockitoBean
	private PaymentRepository paymentRepository;

	@MockitoBean
	private ProcessedEventRepository processedEventRepository;

	@Test
	void contextLoads() {
	}

}

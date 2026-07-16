import { INestApplication } from '@nestjs/common';
import { EVENT_NAMES } from '@mini-e-commerce/types';
import type { App } from 'supertest/types';
import { EventPublisher } from '../src/application/ports/event-publisher.port';
import type { RecordedEvent } from '../src/infrastructure/events/fake-event-publisher';
import { FakeEventPublisher } from '../src/infrastructure/events/fake-event-publisher';
import { registerAndLoginCustomer } from './support/fixtures';
import { signQStashRequest } from './support/qstash-signing';
import type { OrderResponse, ProductListResponse } from './support/response-types';
import { api, API_V1, bodyOf, createTestApp } from './support/test-app';

interface OrderCreatedEventData {
  orderId: string;
  totalCents: number;
  items: Array<{ productId: string; quantity: number }>;
}

/**
 * Proves the Phase 6 end-to-end event-driven flow: `POST /orders` publishes
 * a single canonical `order.created` event (recorded by the app's active
 * `FakeEventPublisher`), and `POST /events/qstash` — the QStash-driven
 * consumer for `payment.completed`/`payment.failed` — moves the referenced
 * order to `PAID`/`PAYMENT_FAILED` idempotently, rejecting invalid
 * signatures and unsupported event types before ever reaching
 * `HandlePaymentEventUseCase`.
 */
describe('Event-driven integration: order.created publish + payment webhook consumer (e2e)', () => {
  let app: INestApplication<App>;
  let fakeEventPublisher: FakeEventPublisher;
  let productId: string;

  beforeAll(async () => {
    app = await createTestApp();
    fakeEventPublisher = app.get<FakeEventPublisher>(EventPublisher);

    const productsResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ limit: 1 })
      .expect(200);
    const products = bodyOf<ProductListResponse>(productsResponse);
    productId = products.data[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Creates an order for a fresh customer and returns its id + the customer's access token. */
  async function createOrder(): Promise<{ orderId: string; accessToken: string }> {
    const customer = await registerAndLoginCustomer(app);

    const createResponse = await api(app)
      .post(`${API_V1}/orders`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(201);
    const created = bodyOf<OrderResponse>(createResponse);

    return { orderId: created.data.id, accessToken: customer.accessToken };
  }

  async function getOrderStatus(orderId: string, accessToken: string): Promise<string> {
    const response = await api(app)
      .get(`${API_V1}/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = bodyOf<OrderResponse>(response);
    return body.data.status;
  }

  function sendQStashEvent(event: string, correlationId: string, data: Record<string, unknown>) {
    const rawBody = JSON.stringify({
      event,
      correlationId,
      timestamp: new Date().toISOString(),
      data,
    });
    const signature = signQStashRequest(rawBody);

    return api(app)
      .post(`${API_V1}/events/qstash`)
      .set('Content-Type', 'application/json')
      .set('Upstash-Signature', signature)
      .send(rawBody);
  }

  it('publishes exactly one order.created event with correlationId = order id and full data', async () => {
    const { orderId } = await createOrder();

    const eventsForThisOrder = fakeEventPublisher
      .published()
      .filter(
        (recorded): recorded is RecordedEvent<OrderCreatedEventData> =>
          recorded.event === EVENT_NAMES.ORDER_CREATED &&
          (recorded.data as OrderCreatedEventData).orderId === orderId,
      );

    expect(eventsForThisOrder).toHaveLength(1);
    const [recorded] = eventsForThisOrder;
    expect(recorded.correlationId).toBe(orderId);
    expect(recorded.data.orderId).toBe(orderId);
    expect(typeof recorded.data.totalCents).toBe('number');
    expect(recorded.data.items).toEqual([{ productId, quantity: 1 }]);
  });

  it('moves an order to PAID on a correctly signed payment.completed event', async () => {
    const { orderId, accessToken } = await createOrder();

    await sendQStashEvent(EVENT_NAMES.PAYMENT_COMPLETED, orderId, {
      orderId,
      paymentId: 'pay_test_1',
      amountCents: 1999,
    }).expect(201);

    const status = await getOrderStatus(orderId, accessToken);
    expect(status).toBe('PAID');
  });

  it('moves an order to PAYMENT_FAILED on a correctly signed payment.failed event', async () => {
    const { orderId, accessToken } = await createOrder();

    await sendQStashEvent(EVENT_NAMES.PAYMENT_FAILED, orderId, {
      orderId,
      paymentId: 'pay_test_2',
      reason: 'card_declined',
    }).expect(201);

    const status = await getOrderStatus(orderId, accessToken);
    expect(status).toBe('PAYMENT_FAILED');
  });

  it('redelivering the identical signed payload is idempotent (no error, no re-apply)', async () => {
    const { orderId, accessToken } = await createOrder();

    const rawBody = JSON.stringify({
      event: EVENT_NAMES.PAYMENT_COMPLETED,
      correlationId: orderId,
      timestamp: new Date().toISOString(),
      data: { orderId, paymentId: 'pay_test_3', amountCents: 2999 },
    });
    const signature = signQStashRequest(rawBody);

    await api(app)
      .post(`${API_V1}/events/qstash`)
      .set('Content-Type', 'application/json')
      .set('Upstash-Signature', signature)
      .send(rawBody)
      .expect(201);

    const statusAfterFirst = await getOrderStatus(orderId, accessToken);
    expect(statusAfterFirst).toBe('PAID');

    // Redeliver the exact same bytes/signature a second time.
    await api(app)
      .post(`${API_V1}/events/qstash`)
      .set('Content-Type', 'application/json')
      .set('Upstash-Signature', signature)
      .send(rawBody)
      .expect(201);

    const statusAfterSecond = await getOrderStatus(orderId, accessToken);
    expect(statusAfterSecond).toBe('PAID');
  });

  it('rejects a payload with a garbage Upstash-Signature (401) and leaves the order unchanged', async () => {
    const { orderId, accessToken } = await createOrder();

    const rawBody = JSON.stringify({
      event: EVENT_NAMES.PAYMENT_COMPLETED,
      correlationId: orderId,
      timestamp: new Date().toISOString(),
      data: { orderId, paymentId: 'pay_test_4', amountCents: 3999 },
    });

    await api(app)
      .post(`${API_V1}/events/qstash`)
      .set('Content-Type', 'application/json')
      .set('Upstash-Signature', 'not-a-valid-signature')
      .send(rawBody)
      .expect(401);

    const status = await getOrderStatus(orderId, accessToken);
    expect(status).toBe('PLACED');
  });

  it('rejects a payload missing the Upstash-Signature header (401)', async () => {
    const { orderId } = await createOrder();

    const rawBody = JSON.stringify({
      event: EVENT_NAMES.PAYMENT_COMPLETED,
      correlationId: orderId,
      timestamp: new Date().toISOString(),
      data: { orderId, paymentId: 'pay_test_5', amountCents: 4999 },
    });

    await api(app)
      .post(`${API_V1}/events/qstash`)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(401);
  });

  it('rejects an unsupported event type (400)', async () => {
    const { orderId } = await createOrder();

    await sendQStashEvent(EVENT_NAMES.ORDER_CREATED, orderId, {
      orderId,
      totalCents: 1999,
      items: [{ productId, quantity: 1 }],
    }).expect(400);
  });
});

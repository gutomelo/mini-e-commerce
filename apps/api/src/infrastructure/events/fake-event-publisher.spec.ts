import { FakeEventPublisher } from './fake-event-publisher';

describe('FakeEventPublisher', () => {
  it('starts with no recorded events', () => {
    const publisher = new FakeEventPublisher();

    expect(publisher.published()).toEqual([]);
  });

  it('records every published event with its correlationId and data', async () => {
    const publisher = new FakeEventPublisher();

    await publisher.publish('order.created', 'order-1', { orderId: 'order-1', totalCents: 4999 });

    expect(publisher.published()).toEqual([
      {
        event: 'order.created',
        correlationId: 'order-1',
        data: { orderId: 'order-1', totalCents: 4999 },
      },
    ]);
  });

  it('records multiple events in publish order', async () => {
    const publisher = new FakeEventPublisher();

    await publisher.publish('order.created', 'order-1', { orderId: 'order-1' });
    await publisher.publish('payment.completed', 'order-1', { paymentId: 'pay-1' });

    expect(publisher.published().map((entry) => entry.event)).toEqual([
      'order.created',
      'payment.completed',
    ]);
  });

  it('returns a snapshot that is not mutated by later publishes', async () => {
    const publisher = new FakeEventPublisher();

    await publisher.publish('order.created', 'order-1', { orderId: 'order-1' });
    const snapshot = publisher.published();
    await publisher.publish('order.created', 'order-2', { orderId: 'order-2' });

    expect(snapshot).toHaveLength(1);
    expect(publisher.published()).toHaveLength(2);
  });
});

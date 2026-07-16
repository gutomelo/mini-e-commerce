import { QStashEventPublisher } from './qstash-event-publisher';

interface PublishJSONRequest {
  url: string;
  body: {
    event: string;
    correlationId: string;
    timestamp: string;
    data: unknown;
  };
}

const publishJSONMock = jest.fn<Promise<{ messageId: string }>, [PublishJSONRequest]>();

jest.mock('@upstash/qstash', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      publishJSON: publishJSONMock,
    })),
  };
});

describe('QStashEventPublisher', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      QSTASH_TOKEN: 'test-token',
      QSTASH_DESTINATION_URL: 'http://inventory:8081/internal/v1/events/qstash',
      PAYMENT_QSTASH_DESTINATION_URL: 'http://payment:8082/internal/v1/events/qstash',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('publishes the envelope to both the inventory and payment destinations', async () => {
    publishJSONMock.mockResolvedValue({ messageId: 'msg-1' });
    const publisher = new QStashEventPublisher();

    await publisher.publish('order.created', 'order-1', {
      orderId: 'order-1',
      totalCents: 4999,
      items: [{ productId: 'p-1', quantity: 2 }],
    });

    expect(publishJSONMock).toHaveBeenCalledTimes(2);

    const calledUrls = publishJSONMock.mock.calls.map(([request]) => request.url);
    expect(calledUrls).toEqual(
      expect.arrayContaining([
        'http://inventory:8081/internal/v1/events/qstash',
        'http://payment:8082/internal/v1/events/qstash',
      ]),
    );

    for (const [request] of publishJSONMock.mock.calls) {
      expect(request.body).toMatchObject({
        event: 'order.created',
        correlationId: 'order-1',
        data: {
          orderId: 'order-1',
          totalCents: 4999,
          items: [{ productId: 'p-1', quantity: 2 }],
        },
      });
      expect(typeof request.body.timestamp).toBe('string');
    }
  });

  it('still attempts the payment destination when the inventory publish rejects', async () => {
    publishJSONMock.mockImplementation((request: { url: string }) => {
      if (request.url.includes('inventory')) {
        return Promise.reject(new Error('inventory unreachable'));
      }
      return Promise.resolve({ messageId: 'msg-2' });
    });
    const publisher = new QStashEventPublisher();

    await expect(
      publisher.publish('order.created', 'order-1', { orderId: 'order-1' }),
    ).resolves.toBeUndefined();

    expect(publishJSONMock).toHaveBeenCalledTimes(2);
  });

  it('still attempts the inventory destination when the payment publish rejects', async () => {
    publishJSONMock.mockImplementation((request: { url: string }) => {
      if (request.url.includes('payment')) {
        return Promise.reject(new Error('payment unreachable'));
      }
      return Promise.resolve({ messageId: 'msg-3' });
    });
    const publisher = new QStashEventPublisher();

    await expect(
      publisher.publish('order.created', 'order-1', { orderId: 'order-1' }),
    ).resolves.toBeUndefined();

    expect(publishJSONMock).toHaveBeenCalledTimes(2);
  });

  it('never rejects even when both destinations fail', async () => {
    publishJSONMock.mockRejectedValue(new Error('network down'));
    const publisher = new QStashEventPublisher();

    await expect(
      publisher.publish('order.created', 'order-1', { orderId: 'order-1' }),
    ).resolves.toBeUndefined();
  });
});

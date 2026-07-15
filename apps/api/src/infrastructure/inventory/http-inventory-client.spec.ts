import { BadGatewayException } from '@nestjs/common';
import { HttpInventoryClient } from './http-inventory-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpInventoryClient', () => {
  const productId = '11111111-1111-1111-1111-111111111111';
  let fetchMock: jest.Mock;
  let client: HttpInventoryClient;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    client = new HttpInventoryClient();
  });

  describe('getStock', () => {
    it('returns the parsed stock on a 200 response', async () => {
      const stock = { productId, quantity: 12, updatedAt: '2026-01-01T00:00:00.000Z' };
      fetchMock.mockResolvedValue(jsonResponse(200, stock));

      const result = await client.getStock(productId);

      expect(result).toEqual(stock);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`http://localhost:8081/internal/v1/stock/${productId}`);
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>)['X-Internal-Api-Key']).toBe('change-me');
    });

    it('returns null on a 404 response', async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { message: 'not found' }));

      const result = await client.getStock(productId);

      expect(result).toBeNull();
    });

    it('throws BadGatewayException on a non-404 error response', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, { message: 'boom' }));

      await expect(client.getStock(productId)).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('throws BadGatewayException when the network call itself fails', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.getStock(productId)).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('setStock', () => {
    it('sends a PATCH with the quantity and returns the updated stock on 200', async () => {
      const stock = { productId, quantity: 20, updatedAt: '2026-01-01T00:00:00.000Z' };
      fetchMock.mockResolvedValue(jsonResponse(200, stock));

      const result = await client.setStock(productId, 20);

      expect(result).toEqual(stock);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`http://localhost:8081/internal/v1/stock/${productId}`);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ quantity: 20 }));
      expect((init.headers as Record<string, string>)['X-Internal-Api-Key']).toBe('change-me');
    });

    it('throws BadGatewayException on a non-2xx response (e.g. inventory-side validation failure)', async () => {
      fetchMock.mockResolvedValue(jsonResponse(400, { message: 'quantity must be non-negative' }));

      await expect(client.setStock(productId, -1)).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('throws BadGatewayException when the network call itself fails', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.setStock(productId, 20)).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});

import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { InventoryClient, StockInfo } from '../../application/ports/inventory-client.port';
import { resolveInventoryBaseUrl, resolveInventoryInternalApiKey } from './inventory-env';

const INTERNAL_API_KEY_HEADER = 'X-Internal-Api-Key';
const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * `InventoryClient` adapter that calls `apps/inventory`'s existing internal
 * REST contract (`GET`/`PATCH /internal/v1/stock/:productId`) over plain
 * `fetch` (Node 24's global implementation — no need for a dedicated HTTP
 * client dependency for this single, narrow outbound call). Authenticates
 * with the shared `X-Internal-Api-Key` secret `apps/inventory` already
 * validates.
 *
 * A `404` from `apps/inventory` is a legitimate "no stock row yet" answer
 * and is translated to `null`, not an error. Any other non-2xx response, or
 * a network failure reaching `apps/inventory` at all, is a real backend
 * outage and is surfaced as a thrown `BadGatewayException` (502) rather
 * than silently swallowed into a fake success/`null`.
 */
@Injectable()
export class HttpInventoryClient implements InventoryClient {
  private readonly logger = new Logger(HttpInventoryClient.name);

  async getStock(productId: string, correlationId: string): Promise<StockInfo | null> {
    const response = await this.request('GET', productId, correlationId);

    if (response.status === 404) {
      return null;
    }

    return this.parseOrThrow(response, productId);
  }

  async setStock(productId: string, quantity: number, correlationId: string): Promise<StockInfo> {
    const response = await this.request('PATCH', productId, correlationId, { quantity });
    return this.parseOrThrow(response, productId);
  }

  private async request(
    method: 'GET' | 'PATCH',
    productId: string,
    correlationId: string,
    body?: unknown,
  ): Promise<Response> {
    const url = `${resolveInventoryBaseUrl()}/internal/v1/stock/${encodeURIComponent(productId)}`;

    try {
      return await fetch(url, {
        method,
        headers: {
          [INTERNAL_API_KEY_HEADER]: resolveInventoryInternalApiKey(),
          [CORRELATION_ID_HEADER]: correlationId,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.logger.error(
        `Failed to reach apps/inventory at ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Inventory service is unreachable');
    }
  }

  private async parseOrThrow(response: Response, productId: string): Promise<StockInfo> {
    if (!response.ok) {
      this.logger.error(
        `apps/inventory returned ${response.status} for stock ${productId}: ${await this.safeText(response)}`,
      );
      throw new BadGatewayException('Inventory service returned an unexpected response');
    }

    return (await response.json()) as StockInfo;
  }

  private async safeText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '<unreadable body>';
    }
  }
}

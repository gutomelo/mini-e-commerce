import { Injectable } from '@nestjs/common';
import { InventoryClient, StockInfo } from '../../application/ports/inventory-client.port';

/**
 * In-memory {@link InventoryClient} test double (mirrors the
 * `FakeEventPublisher` pattern in `../events/fake-event-publisher.ts`). Never
 * talks to a real `apps/inventory` instance — the Jest e2e process running on
 * the host cannot reach it anyway, since it has no host port published.
 *
 * `seed()` preloads a known stock row before a test runs; `getStock` mirrors
 * the real `HttpInventoryClient`'s 404-as-null contract for any id that was
 * never seeded or set.
 */
@Injectable()
export class FakeInventoryClient implements InventoryClient {
  private readonly stock = new Map<string, StockInfo>();

  /** Preloads a known stock row for `productId` before a test runs. */
  seed(productId: string, quantity: number): StockInfo {
    const stockInfo: StockInfo = { productId, quantity, updatedAt: new Date().toISOString() };
    this.stock.set(productId, stockInfo);
    return stockInfo;
  }

  getStock(productId: string): Promise<StockInfo | null> {
    return Promise.resolve(this.stock.get(productId) ?? null);
  }

  setStock(productId: string, quantity: number): Promise<StockInfo> {
    const stockInfo: StockInfo = { productId, quantity, updatedAt: new Date().toISOString() };
    this.stock.set(productId, stockInfo);
    return Promise.resolve(stockInfo);
  }
}

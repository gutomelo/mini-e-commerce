/** Shape of a stock row as returned by `apps/inventory`'s internal REST contract. */
export interface StockInfo {
  productId: string;
  quantity: number;
  updatedAt: string;
}

/**
 * Port for the stock read/write proxy to `apps/inventory`. `apps/api` is the
 * only caller allowed to reach `apps/inventory` directly (frontends never
 * do), per the project's Service-Oriented Architecture rule.
 */
export abstract class InventoryClient {
  /** Returns `null` when `apps/inventory` reports no stock row for `productId` (its `404`). */
  abstract getStock(productId: string): Promise<StockInfo | null>;

  /** Sets an absolute stock quantity. `quantity` must be a non-negative integer. */
  abstract setStock(productId: string, quantity: number): Promise<StockInfo>;
}

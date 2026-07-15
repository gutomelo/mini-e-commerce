import { Injectable } from '@nestjs/common';
import { InventoryClient, StockInfo } from '../../ports/inventory-client.port';

/**
 * Sets an absolute stock quantity for a product (`PATCH
 * /admin/inventory/:productId`). Mirrors `apps/inventory`'s own contract
 * exactly — no history/audit trail beyond `apps/inventory`'s own
 * `updatedAt`, per this phase's spec.
 */
@Injectable()
export class SetStockUseCase {
  constructor(private readonly inventoryClient: InventoryClient) {}

  async execute(productId: string, quantity: number, correlationId: string): Promise<StockInfo> {
    return this.inventoryClient.setStock(productId, quantity, correlationId);
  }
}

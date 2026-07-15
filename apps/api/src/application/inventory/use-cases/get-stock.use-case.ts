import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../../../domain/errors';
import { InventoryClient, StockInfo } from '../../ports/inventory-client.port';

/**
 * Looks up the current stock quantity for a product (`GET
 * /admin/inventory/:productId`). Not cached — stock is transactional data
 * proxied live from `apps/inventory`, matching the project's cache rule
 * that only read-only catalog data is cacheable.
 */
@Injectable()
export class GetStockUseCase {
  constructor(private readonly inventoryClient: InventoryClient) {}

  async execute(productId: string): Promise<StockInfo> {
    const stock = await this.inventoryClient.getStock(productId);

    if (!stock) {
      throw new EntityNotFoundError('Stock', productId);
    }

    return stock;
  }
}

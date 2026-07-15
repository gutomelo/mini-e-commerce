import { EntityNotFoundError } from '../../../domain/errors';
import { InventoryClient, StockInfo } from '../../ports/inventory-client.port';
import { MockedPort } from '../../../test/mocked-port';
import { GetStockUseCase } from './get-stock.use-case';

describe('GetStockUseCase', () => {
  const stock: StockInfo = {
    productId: '11111111-1111-1111-1111-111111111111',
    quantity: 12,
    updatedAt: new Date().toISOString(),
  };
  const correlationId = 'correlation-id-123';

  let inventoryClient: MockedPort<InventoryClient>;
  let useCase: GetStockUseCase;

  beforeEach(() => {
    inventoryClient = {
      getStock: jest.fn(),
      setStock: jest.fn(),
    };
    useCase = new GetStockUseCase(inventoryClient);
  });

  it('returns the stock info when apps/inventory has a row for the product', async () => {
    inventoryClient.getStock.mockResolvedValue(stock);

    const result = await useCase.execute(stock.productId, correlationId);

    expect(inventoryClient.getStock).toHaveBeenCalledWith(stock.productId, correlationId);
    expect(result).toEqual(stock);
  });

  it('throws EntityNotFoundError when apps/inventory has no row for the product', async () => {
    inventoryClient.getStock.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', correlationId)).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });
});

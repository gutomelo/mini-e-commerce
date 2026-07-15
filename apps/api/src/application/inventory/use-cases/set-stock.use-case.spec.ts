import { InventoryClient, StockInfo } from '../../ports/inventory-client.port';
import { MockedPort } from '../../../test/mocked-port';
import { SetStockUseCase } from './set-stock.use-case';

describe('SetStockUseCase', () => {
  const stock: StockInfo = {
    productId: '11111111-1111-1111-1111-111111111111',
    quantity: 20,
    updatedAt: new Date().toISOString(),
  };

  let inventoryClient: MockedPort<InventoryClient>;
  let useCase: SetStockUseCase;

  beforeEach(() => {
    inventoryClient = {
      getStock: jest.fn(),
      setStock: jest.fn(),
    };
    useCase = new SetStockUseCase(inventoryClient);
  });

  it('delegates to the InventoryClient and returns the updated stock', async () => {
    inventoryClient.setStock.mockResolvedValue(stock);

    const result = await useCase.execute(stock.productId, stock.quantity);

    expect(inventoryClient.setStock).toHaveBeenCalledWith(stock.productId, stock.quantity);
    expect(result).toEqual(stock);
  });
});

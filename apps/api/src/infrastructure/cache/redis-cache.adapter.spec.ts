import { RedisCacheAdapter } from './redis-cache.adapter';

type MockRedisClient = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  scan: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
  on: jest.Mock;
};

let mockClient: MockRedisClient;

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockClient),
  };
});

describe('RedisCacheAdapter', () => {
  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
    };
  });

  function createAdapter(): RedisCacheAdapter {
    return new RedisCacheAdapter();
  }

  describe('happy path', () => {
    it('returns undefined on a cache miss', async () => {
      mockClient.get.mockResolvedValue(null);
      const adapter = createAdapter();

      await expect(adapter.get('products:id:1')).resolves.toBeUndefined();
    });

    it('round-trips a JSON value on a cache hit', async () => {
      mockClient.get.mockResolvedValue(JSON.stringify({ id: '1', name: 'Widget' }));
      const adapter = createAdapter();

      await expect(adapter.get('products:id:1')).resolves.toEqual({ id: '1', name: 'Widget' });
    });

    it('sets a value with the default TTL when none is given', async () => {
      mockClient.set.mockResolvedValue('OK');
      const adapter = createAdapter();

      await adapter.set('categories:list', ['a', 'b']);

      expect(mockClient.set).toHaveBeenCalledWith(
        'categories:list',
        JSON.stringify(['a', 'b']),
        'EX',
        300,
      );
    });

    it('sets a value with an overridden TTL', async () => {
      mockClient.set.mockResolvedValue('OK');
      const adapter = createAdapter();

      await adapter.set('products:id:1', { id: '1' }, 60);

      expect(mockClient.set).toHaveBeenCalledWith(
        'products:id:1',
        JSON.stringify({ id: '1' }),
        'EX',
        60,
      );
    });

    it('deletes a single key', async () => {
      mockClient.del.mockResolvedValue(1);
      const adapter = createAdapter();

      await adapter.delete('products:id:1');

      expect(mockClient.del).toHaveBeenCalledWith('products:id:1');
    });

    it('scans and deletes every key matching a prefix', async () => {
      mockClient.scan
        .mockResolvedValueOnce(['5', ['products:list:a', 'products:list:b']])
        .mockResolvedValueOnce(['0', ['products:list:c']]);
      mockClient.del.mockResolvedValue(3);
      const adapter = createAdapter();

      await adapter.deleteByPrefix('products:list:');

      expect(mockClient.scan).toHaveBeenCalledTimes(2);
      expect(mockClient.del).toHaveBeenCalledWith(
        'products:list:a',
        'products:list:b',
        'products:list:c',
      );
    });

    it('does not call del when the prefix scan finds no keys', async () => {
      mockClient.scan.mockResolvedValueOnce(['0', []]);
      const adapter = createAdapter();

      await adapter.deleteByPrefix('products:list:');

      expect(mockClient.del).not.toHaveBeenCalled();
    });
  });

  describe('graceful degradation', () => {
    it('returns undefined instead of throwing when get fails', async () => {
      mockClient.get.mockRejectedValue(new Error('connection refused'));
      const adapter = createAdapter();

      await expect(adapter.get('products:id:1')).resolves.toBeUndefined();
    });

    it('resolves instead of throwing when set fails', async () => {
      mockClient.set.mockRejectedValue(new Error('connection refused'));
      const adapter = createAdapter();

      await expect(adapter.set('products:id:1', { id: '1' })).resolves.toBeUndefined();
    });

    it('resolves instead of throwing when delete fails', async () => {
      mockClient.del.mockRejectedValue(new Error('connection refused'));
      const adapter = createAdapter();

      await expect(adapter.delete('products:id:1')).resolves.toBeUndefined();
    });

    it('resolves instead of throwing when deleteByPrefix scan fails', async () => {
      mockClient.scan.mockRejectedValue(new Error('connection refused'));
      const adapter = createAdapter();

      await expect(adapter.deleteByPrefix('products:list:')).resolves.toBeUndefined();
    });

    it('resolves instead of throwing when deleteByPrefix del fails', async () => {
      mockClient.scan.mockResolvedValueOnce(['0', ['products:list:a']]);
      mockClient.del.mockRejectedValue(new Error('connection refused'));
      const adapter = createAdapter();

      await expect(adapter.deleteByPrefix('products:list:')).resolves.toBeUndefined();
    });

    it('never propagates an unhandled client error event', () => {
      expect(() => createAdapter()).not.toThrow();
      const calls = mockClient.on.mock.calls as Array<[string, (error: Error) => void]>;
      const errorCall = calls.find((call) => call[0] === 'error');
      const errorHandler = errorCall?.[1];

      expect(errorHandler).toBeDefined();
      expect(() => errorHandler?.(new Error('ECONNREFUSED'))).not.toThrow();
    });
  });
});

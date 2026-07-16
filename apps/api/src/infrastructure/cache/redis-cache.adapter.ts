import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CachePort, DEFAULT_CACHE_TTL_SECONDS } from '../../application/ports/cache.port';
import { resolveRedisUrl } from './redis-url';

/** Number of keys requested per Redis SCAN iteration. */
const SCAN_BATCH_SIZE = 100;

/**
 * ioredis-backed implementation of {@link CachePort}.
 *
 * Cache is a pure optimization here: every operation swallows connection
 * or command errors and logs a warning instead of throwing, so a Redis
 * outage never breaks a request — reads simply fall back to the
 * repository and writes proceed without invalidation feedback.
 */
@Injectable()
export class RedisCacheAdapter extends CachePort implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private readonly client: Redis;

  constructor() {
    super();
    this.client = new Redis(resolveRedisUrl(), {
      // Cap reconnect backoff and let ioredis keep retrying in the
      // background instead of throwing on every command while down.
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
      lazyConnect: false,
    });

    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        return undefined;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logWarning('get', key, error);
      return undefined;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS,
  ): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logWarning('set', key, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logWarning('delete', key, error);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.scanKeys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logWarning('deleteByPrefix', prefix, error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_BATCH_SIZE,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  private logWarning(operation: string, key: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Cache ${operation} failed for key "${key}": ${message}`);
  }
}

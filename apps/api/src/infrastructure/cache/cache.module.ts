import { Global, Module } from '@nestjs/common';
import { CachePort } from '../../application/ports/cache.port';
import { RedisCacheAdapter } from './redis-cache.adapter';

@Global()
@Module({
  providers: [{ provide: CachePort, useClass: RedisCacheAdapter }],
  exports: [CachePort],
})
export class CacheModule {}

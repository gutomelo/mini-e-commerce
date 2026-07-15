import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { correlationIdMiddleware } from '../../src/presentation/middleware/correlation-id.middleware';

/**
 * Bootstraps a full Nest application for e2e tests, mirroring `src/main.ts`
 * exactly (URI versioning, global prefix, `ValidationPipe`, correlation-id
 * middleware, pino logger) so the suite exercises the same request pipeline
 * production traffic goes through.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // `rawBody: true` mirrors `src/main.ts`'s `NestFactory.create` call so
  // `request.rawBody` is populated for every handler, matching production —
  // without it, `QStashWebhookController` always sees `rawBody` as
  // `undefined` and rejects every signed webhook with a 401.
  const app = moduleFixture.createNestApplication({ bufferLogs: true, rawBody: true });

  app.use(correlationIdMiddleware);
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}

/** Shorthand for `supertest(app.getHttpServer())`, matching the app's `/api/v1` prefix. */
export function api(app: INestApplication<App>) {
  return request(app.getHttpServer());
}

export const API_V1 = '/api/v1';

/**
 * Casts a supertest response's `body` (typed `any`) to the expected
 * envelope shape. Centralizing the cast here keeps every other unsafe
 * `.body` access out of the spec files themselves.
 */
export function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

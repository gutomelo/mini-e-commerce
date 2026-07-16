import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { api, API_V1, createTestApp } from './support/test-app';

/**
 * Proves the stricter auth-route throttle bucket (10 req/min, see
 * `AuthController`'s `@Throttle({ auth: { limit: 10, ttl: 60_000 } })`).
 * The in-memory throttler storage is scoped to this spec file's own Nest
 * application instance, so requests made against `/auth/login` by other
 * spec files (each with their own app instance) never count toward this
 * bucket.
 */
describe('Auth throttling (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after exceeding 10 requests/min on /auth/login', async () => {
    const credentials = { email: 'throttle-test@example.com', password: 'does-not-matter' };
    const statuses: number[] = [];

    for (let i = 0; i < 11; i += 1) {
      const response = await api(app).post(`${API_V1}/auth/login`).send(credentials);
      statuses.push(response.status);
    }

    // The first 10 requests are rejected on their own merits (bad
    // credentials -> 401), never rate-limited yet.
    expect(statuses.slice(0, 10)).toEqual(new Array(10).fill(401));
    // The 11th request exceeds the bucket.
    expect(statuses[10]).toBe(429);
  });
});

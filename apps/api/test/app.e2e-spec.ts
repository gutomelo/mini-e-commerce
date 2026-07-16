import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { api, createTestApp } from './support/test-app';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    return api(app).get('/api/health').expect(200).expect({ status: 'ok', service: 'api' });
  });
});

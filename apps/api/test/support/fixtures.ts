import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { TokenPairResponse } from './response-types';
import { api, API_V1, bodyOf } from './test-app';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './test-env';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Short random suffix so emails/slugs stay unique across specs and reruns within a single test run. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export interface RegisteredCustomer extends TokenPair {
  email: string;
  password: string;
  name: string;
}

/** Registers a fresh CUSTOMER account (unique email each call) and logs in, returning its token pair. */
export async function registerAndLoginCustomer(
  app: INestApplication<App>,
): Promise<RegisteredCustomer> {
  const email = `customer-${uniqueSuffix()}@example.com`;
  const password = 'Sup3r-Secret!';
  const name = 'Test Customer';

  await api(app).post(`${API_V1}/auth/register`).send({ email, password, name }).expect(201);

  const loginResponse = await api(app)
    .post(`${API_V1}/auth/login`)
    .send({ email, password })
    .expect(200);
  const { data } = bodyOf<TokenPairResponse>(loginResponse);

  return {
    email,
    password,
    name,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

/** Logs in as the seeded ADMIN user (see `prisma/seed.ts` / `test/global-setup.ts`). */
export async function loginAsAdmin(app: INestApplication<App>): Promise<TokenPair> {
  const loginResponse = await api(app)
    .post(`${API_V1}/auth/login`)
    .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    .expect(200);
  const { data } = bodyOf<TokenPairResponse>(loginResponse);

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

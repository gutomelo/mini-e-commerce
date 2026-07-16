import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { uniqueSuffix } from './support/fixtures';
import type {
  ProfileResponse,
  RegisteredUserResponse,
  TokenPairResponse,
} from './support/response-types';
import { api, API_V1, bodyOf, createTestApp } from './support/test-app';

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('covers register -> login -> protected route -> refresh rotation -> reused token rejected -> logout revokes', async () => {
    const email = `auth-flow-${uniqueSuffix()}@example.com`;
    const password = 'Sup3r-Secret!';
    const name = 'Auth Flow Customer';

    // 1. Register.
    const registerResponse = await api(app)
      .post(`${API_V1}/auth/register`)
      .send({ email, password, name })
      .expect(201);
    const registeredUser = bodyOf<RegisteredUserResponse>(registerResponse).data;
    expect(registeredUser).toMatchObject({ email, name, role: 'CUSTOMER' });
    expect(registeredUser.id).toBeDefined();

    // Duplicate registration is rejected.
    await api(app).post(`${API_V1}/auth/register`).send({ email, password, name }).expect(409);

    // 2. Login.
    const loginResponse = await api(app)
      .post(`${API_V1}/auth/login`)
      .send({ email, password })
      .expect(200);
    const firstTokens = bodyOf<TokenPairResponse>(loginResponse).data;
    expect(firstTokens.accessToken).toEqual(expect.any(String));
    expect(firstTokens.refreshToken).toEqual(expect.any(String));

    // Wrong password is rejected.
    await api(app)
      .post(`${API_V1}/auth/login`)
      .send({ email, password: 'wrong-password' })
      .expect(401);

    // 3. Access a protected route with the access token.
    const profileResponse = await api(app)
      .get(`${API_V1}/users/me`)
      .set('Authorization', `Bearer ${firstTokens.accessToken}`)
      .expect(200);
    expect(bodyOf<ProfileResponse>(profileResponse).data).toMatchObject({ email, name });

    // Protected route rejects missing/garbage tokens.
    await api(app).get(`${API_V1}/users/me`).expect(401);
    await api(app)
      .get(`${API_V1}/users/me`)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);

    // 4. Refresh rotates the token pair.
    const refreshResponse = await api(app)
      .post(`${API_V1}/auth/refresh`)
      .send({ refreshToken: firstTokens.refreshToken })
      .expect(200);
    const rotatedTokens = bodyOf<TokenPairResponse>(refreshResponse).data;
    expect(rotatedTokens.accessToken).toEqual(expect.any(String));
    expect(rotatedTokens.refreshToken).toEqual(expect.any(String));
    expect(rotatedTokens.refreshToken).not.toEqual(firstTokens.refreshToken);

    // The rotated access token still works for the protected route.
    await api(app)
      .get(`${API_V1}/users/me`)
      .set('Authorization', `Bearer ${rotatedTokens.accessToken}`)
      .expect(200);

    // The used (pre-rotation) refresh token is now rejected.
    await api(app)
      .post(`${API_V1}/auth/refresh`)
      .send({ refreshToken: firstTokens.refreshToken })
      .expect(401);

    // 5. Logout revokes the current (rotated) refresh token.
    await api(app)
      .post(`${API_V1}/auth/logout`)
      .set('Authorization', `Bearer ${rotatedTokens.accessToken}`)
      .send({ refreshToken: rotatedTokens.refreshToken })
      .expect(204);

    // A refresh attempt with the now-revoked token also fails.
    await api(app)
      .post(`${API_V1}/auth/refresh`)
      .send({ refreshToken: rotatedTokens.refreshToken })
      .expect(401);
  });
});

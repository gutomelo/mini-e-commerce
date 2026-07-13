import type { SingleResponse } from '@mini-e-commerce/types';
import { authFetch, publicFetch } from './http-client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** `POST /api/v1/auth/register` — public. */
export async function register(input: RegisterInput): Promise<RegisteredUser> {
  const response = await publicFetch<SingleResponse<RegisteredUser>>('/api/v1/auth/register', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

/** `POST /api/v1/auth/login` — public. */
export async function login(input: LoginInput): Promise<AuthTokens> {
  const response = await publicFetch<SingleResponse<AuthTokens>>('/api/v1/auth/login', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

/**
 * `POST /api/v1/auth/refresh` — public (takes the refresh token as the
 * credential in the body, not a Bearer header). Used by `http-client`'s
 * silent-refresh logic and available to auth Server Actions directly.
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const response = await publicFetch<SingleResponse<AuthTokens>>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
  return response.data;
}

/** `POST /api/v1/auth/logout` — requires authentication (revokes the given refresh token). */
export async function logout(refreshToken: string): Promise<void> {
  await authFetch<void>('/api/v1/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `next/headers`' `cookies()` only works inside a real Next.js request
 * scope, so it's mocked with a tiny in-memory store that mirrors the
 * get/set/delete surface `lib/session.ts` relies on.
 */
const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

const { authFetch, ApiError } = await import('./http-client');

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const unauthorizedBody = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Invalid or expired token',
  correlationId: 'test',
  timestamp: new Date().toISOString(),
  path: '/api/v1/orders',
};

describe('authFetch', () => {
  beforeEach(() => {
    cookieStore.clear();
    vi.unstubAllGlobals();
  });

  it('retries exactly once after a successful silent refresh', async () => {
    cookieStore.set('access_token', 'expired-access-token');
    cookieStore.set('refresh_token', 'valid-refresh-token');

    const fetchMock = vi
      .fn()
      // 1. original request -> 401
      .mockResolvedValueOnce(jsonResponse(unauthorizedBody, 401))
      // 2. refresh call -> new token pair
      .mockResolvedValueOnce(
        jsonResponse(
          { data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' } },
          200,
        ),
      )
      // 3. retried original request -> succeeds
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }, 200));

    vi.stubGlobal('fetch', fetchMock);

    const result = await authFetch<{ data: { ok: boolean } }>('/api/v1/orders');

    expect(result).toEqual({ data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(cookieStore.get('access_token')).toBe('new-access-token');
    expect(cookieStore.get('refresh_token')).toBe('new-refresh-token');

    // The retried call must carry the freshly refreshed access token.
    const retryCallHeaders = fetchMock.mock.calls[2][1].headers as Headers;
    expect(retryCallHeaders.get('Authorization')).toBe('Bearer new-access-token');
  });

  it('gives up after one failed refresh attempt and clears the session (no retry loop)', async () => {
    cookieStore.set('access_token', 'expired-access-token');
    cookieStore.set('refresh_token', 'stale-refresh-token');

    const fetchMock = vi
      .fn()
      // 1. original request -> 401
      .mockResolvedValueOnce(jsonResponse(unauthorizedBody, 401))
      // 2. refresh call itself fails
      .mockResolvedValueOnce(jsonResponse(unauthorizedBody, 401));

    vi.stubGlobal('fetch', fetchMock);

    await expect(authFetch('/api/v1/orders')).rejects.toBeInstanceOf(ApiError);

    // Exactly two calls: the original + the refresh attempt. No third
    // (retried) call, and no repeated refresh attempts.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cookieStore.has('access_token')).toBe(false);
    expect(cookieStore.has('refresh_token')).toBe(false);
  });

  it('does not attempt a refresh when there is no refresh token cookie', async () => {
    cookieStore.set('access_token', 'expired-access-token');

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(unauthorizedBody, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authFetch('/api/v1/orders')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates a non-401 error without attempting any refresh', async () => {
    cookieStore.set('access_token', 'valid-access-token');
    cookieStore.set('refresh_token', 'valid-refresh-token');

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 409,
          error: 'Conflict',
          message: 'Already exists',
          correlationId: 'x',
          timestamp: '',
          path: '',
        },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authFetch('/api/v1/orders')).rejects.toMatchObject({ statusCode: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

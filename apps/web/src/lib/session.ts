import { cookies } from 'next/headers';

/**
 * Auth session cookie helpers. Only `access_token`/`refresh_token` live
 * here — the `cart` cookie is owned by a later cart task and must not be
 * added to this file.
 */

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

// The NestJS API is the real source of truth for token expiry
// (`JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`); these values only bound how long the
// browser holds onto the cookie so a stale session doesn't linger forever.
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Sets both session cookies as httpOnly, secure (in production),
 * SameSite=Lax, path `/`.
 *
 * Per Next.js, cookies can only be written from a Server Function (Server
 * Action) or a Route Handler, never during Server Component rendering. The
 * write is wrapped in a try/catch so a call from an unsupported context
 * degrades gracefully (the caller still gets the fresh token pair to use
 * for the current request) instead of crashing the render.
 */
export async function setSessionCookies({
  accessToken,
  refreshToken,
}: SessionTokens): Promise<void> {
  try {
    const store = await cookies();
    const secure = process.env.NODE_ENV === 'production';

    store.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });

    store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    });
  } catch {
    // See doc comment above: writing cookies outside a Server Function or
    // Route Handler is a no-op by design, not an error worth surfacing.
  }
}

export async function clearSessionCookies(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(ACCESS_TOKEN_COOKIE);
    store.delete(REFRESH_TOKEN_COOKIE);
  } catch {
    // See doc comment on setSessionCookies.
  }
}

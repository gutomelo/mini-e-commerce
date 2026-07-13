import type { ErrorResponse } from '@mini-e-commerce/types';
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from '@/lib/session';
import { refreshTokens } from './auth';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

interface ApiErrorInput {
  statusCode: number;
  error: string;
  message: string | string[];
}

/**
 * Typed error thrown for every non-2xx API response, lifted from the
 * `ErrorResponse` envelope so calling Server Actions/Components can branch
 * on `statusCode` (e.g. redirect to `/login` on 401, show a form error on
 * 409/400) instead of parsing a raw `Error` message.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly details: string | string[];

  constructor({ statusCode, error, message }: ApiErrorInput) {
    super(Array.isArray(message) ? message.join('; ') : message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = message;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Plain object body, JSON-serialized before the request is sent. */
  body?: unknown;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.length > 0 ? JSON.parse(text) : undefined;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await parseJsonBody(response).catch(() => undefined)) as
    Partial<ErrorResponse> | undefined;
  return new ApiError({
    statusCode: body?.statusCode ?? response.status,
    error: body?.error ?? response.statusText,
    message: body?.message ?? 'Request failed',
  });
}

async function rawFetch(
  path: string,
  { body, headers, ...init }: RequestOptions,
  accessToken?: string,
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Content-Type', 'application/json');
  if (accessToken) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Fetch wrapper for public (unauthenticated) endpoints — product/category
 * reads, register/login/refresh. Never attempts a token refresh, since a
 * 401 from a public endpoint isn't a session problem.
 */
export async function publicFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await rawFetch(path, options);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await parseJsonBody(response)) as T;
}

/**
 * Fetch wrapper for endpoints that require authentication. Attaches the
 * `access_token` cookie as a Bearer header. On a `401`, attempts exactly one
 * silent refresh via the refresh-token cookie and retries the original
 * request once with the new access token. If the refresh itself fails (or
 * there's no refresh token to try), both session cookies are cleared and the
 * original `401` propagates as an `ApiError` — callers (Server
 * Actions/Components) decide what to do about it (e.g. redirect to
 * `/login`); this layer never redirects on its own.
 */
export async function authFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await rawFetch(path, options, accessToken);

  if (response.status !== 401) {
    if (!response.ok) {
      throw await toApiError(response);
    }
    return (await parseJsonBody(response)) as T;
  }

  const refreshedAccessToken = await tryRefreshSession();
  if (!refreshedAccessToken) {
    await clearSessionCookies();
    throw await toApiError(response);
  }

  const retryResponse = await rawFetch(path, options, refreshedAccessToken);
  if (!retryResponse.ok) {
    if (retryResponse.status === 401) {
      // The API rejected even the freshly refreshed token — treat the
      // session as unrecoverable rather than looping on refresh attempts.
      await clearSessionCookies();
    }
    throw await toApiError(retryResponse);
  }
  return (await parseJsonBody(retryResponse)) as T;
}

/** Attempts exactly one silent refresh; returns the new access token, or undefined if it can't proceed. */
async function tryRefreshSession(): Promise<string | undefined> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return undefined;
  }

  try {
    const tokens = await refreshTokens(refreshToken);
    await setSessionCookies(tokens);
    return tokens.accessToken;
  } catch {
    return undefined;
  }
}

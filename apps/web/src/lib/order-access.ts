import { notFound, redirect } from 'next/navigation';

import { ApiError } from '@/data-access/http-client';

/**
 * Shared error-handling policy for every order-scoped page (`/orders`,
 * `/orders/[id]`, `/checkout/confirmation/[id]`): a `404` means the order
 * doesn't exist or belongs to another user (the API never distinguishes the
 * two, so neither does this), rendered via `notFound()`; a `401` means
 * `authFetch`'s silent refresh already tried and failed (e.g. the refresh
 * token itself was rejected, or a cookie write from an earlier
 * Server Component render was a no-op and never persisted) — redirect to
 * `/login` rather than crash on an unhandled exception.
 *
 * Centralized here so all three pages apply the exact same policy instead
 * of each re-implementing an identical try/catch.
 */
export async function withOrderErrorHandling<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        notFound();
      }
      if (error.statusCode === 401) {
        redirect('/login');
      }
    }
    throw error;
  }
}

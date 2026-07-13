import { cookies } from 'next/headers';

import { CART_COOKIE_NAME, parseCart, type Cart } from './cart';

/**
 * Server-side read of the `cart` cookie. Split out from `cart.ts` because
 * this file imports `next/headers`, which Next.js forbids in any module
 * reachable from a Client Component — `cart.ts` stays isomorphic (imported
 * by both Server and Client Components) while this file is imported only
 * by Server Components/Actions/Route Handlers (cart page, site header, and
 * the future checkout Server Action from Task #57).
 *
 * A plain async function, not entangled with this task's page or component
 * structure, so it is directly reusable from a Server Action. Never throws
 * — a missing/malformed cookie yields an empty cart.
 */
export async function getCart(): Promise<Cart> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE_NAME)?.value);
}

/**
 * Clears the `cart` cookie. Server-only (writes cookies), so it lives here
 * rather than in the isomorphic `cart.ts` — called from the checkout Server
 * Action after an order is successfully placed. Never called on a rejected
 * checkout (e.g. a stale/tampered cart item), so the shopper can go fix the
 * offending item in `/cart` and retry.
 */
export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE_NAME);
}

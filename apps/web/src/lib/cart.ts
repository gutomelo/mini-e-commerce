/**
 * Cart cookie helpers, deliberately separate from `session.ts`: per that
 * file's own doc comment, the `cart` cookie is owned by this module and
 * must never be added there.
 *
 * Cookie-mutation strategy: mutations (add/update quantity/remove) happen
 * directly against `document.cookie` from Client Components, with NO
 * Server Action round trip. This is possible (and preferable) specifically
 * because, per the storefront spec, the `cart` cookie is:
 *   - NOT httpOnly (the whole point is that client code reads/writes it), and
 *   - never holds price or other sensitive data (only `{ productId, quantity }`
 *     pairs), so a client-only write path introduces no security exposure.
 * A Server Action round trip would add latency to a quantity bump for no
 * benefit, since there is nothing server-side that needs to validate the
 * write itself (checkout — Task #57 — re-prices and re-validates every item
 * from the API regardless of what the cookie contains).
 *
 * This file is intentionally isomorphic — types, constants, and pure
 * transform functions only, no `next/headers` import — because it is
 * imported by both Server Components (cart page, site header) and Client
 * Components (add-to-cart button, cart line item). Next.js's bundler
 * rejects any module reachable from a Client Component that imports
 * `next/headers`, even if the specific export is unused client-side, so the
 * server-only cookie read lives in the sibling `cart-server.ts` instead.
 */

export const CART_COOKIE_NAME = 'cart';

/** 30 days: long enough that an abandoned cart survives a browsing session. */
export const CART_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

const EMPTY_CART: Cart = { items: [] };

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.productId === 'string' &&
    typeof candidate.quantity === 'number' &&
    Number.isFinite(candidate.quantity) &&
    candidate.quantity > 0
  );
}

/**
 * Parses the raw `cart` cookie value into a `Cart`. Never throws — a
 * missing, malformed, or tampered cookie value degrades to an empty cart
 * rather than crashing the page.
 */
export function parseCart(raw: string | undefined): Cart {
  if (!raw) {
    return EMPTY_CART;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as { items?: unknown }).items)
    ) {
      return EMPTY_CART;
    }
    const items = (parsed as { items: unknown[] }).items.filter(isCartItem);
    return { items };
  } catch {
    return EMPTY_CART;
  }
}

export function serializeCart(cart: Cart): string {
  return JSON.stringify(cart);
}

/** Adds a product to the cart, or bumps its quantity if already present. */
export function addCartItem(cart: Cart, productId: string, quantity = 1): Cart {
  const existing = cart.items.find((item) => item.productId === productId);
  if (existing) {
    return {
      items: cart.items.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
      ),
    };
  }
  return { items: [...cart.items, { productId, quantity }] };
}

/** Sets a specific item's quantity; setting it to 0 (or below) removes the item. */
export function updateCartItemQuantity(cart: Cart, productId: string, quantity: number): Cart {
  if (quantity <= 0) {
    return removeCartItem(cart, productId);
  }
  return {
    items: cart.items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
  };
}

export function removeCartItem(cart: Cart, productId: string): Cart {
  return { items: cart.items.filter((item) => item.productId !== productId) };
}

/** Sum of quantities across all line items, used for the header cart badge. */
export function getCartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Reads the `cart` cookie directly from `document.cookie`. Client-only —
 * only call from Client Components (`document` is unavailable during SSR).
 */
export function readCartCookieClient(): Cart {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CART_COOKIE_NAME}=`));
  const raw = match ? decodeURIComponent(match.slice(CART_COOKIE_NAME.length + 1)) : undefined;
  return parseCart(raw);
}

/**
 * Writes the `cart` cookie directly via `document.cookie`. Client-only —
 * only call from Client Components. Not httpOnly by design (see the
 * strategy note above), `SameSite=Lax`, 30-day `max-age`.
 */
export function writeCartCookieClient(cart: Cart): void {
  document.cookie = `${CART_COOKIE_NAME}=${encodeURIComponent(serializeCart(cart))}; path=/; max-age=${CART_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

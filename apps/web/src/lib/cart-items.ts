import { ApiError } from '@/data-access/http-client';
import { getProduct } from '@/data-access/products';

import type { CartItem } from './cart';

export interface CartRow {
  productId: string;
  quantity: number;
  isAvailable: boolean;
  name: string;
  priceCents: number;
  imageUrl: string | null;
}

/**
 * Re-fetches each cart line item's live product data so price/name/image
 * are always current, never trusted from the cookie (which only ever holds
 * `{ productId, quantity }`). A product that 404s (deleted or deactivated
 * since it was added) is kept as an "unavailable" row rather than dropped
 * silently, so the shopper can see and remove it explicitly.
 *
 * Shared by `/cart` and `/checkout`, both of which need the same
 * fetch-and-handle-404 rendering of the current cart contents. This is
 * purely a display concern — it never gates whether checkout is allowed to
 * proceed; the API re-validates authoritatively when the order is placed.
 */
export async function loadCartRows(cartItems: CartItem[]): Promise<CartRow[]> {
  return Promise.all(
    cartItems.map(async ({ productId, quantity }): Promise<CartRow> => {
      try {
        const product = await getProduct(productId);
        return {
          productId,
          quantity,
          isAvailable: product.isActive,
          name: product.name,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
        };
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          return {
            productId,
            quantity,
            isAvailable: false,
            name: 'Product no longer available',
            priceCents: 0,
            imageUrl: null,
          };
        }
        throw error;
      }
    }),
  );
}

/** Sum of `priceCents * quantity` across available rows only. */
export function getCartSubtotalCents(rows: CartRow[]): number {
  return rows.reduce(
    (sum, row) => (row.isAvailable ? sum + row.priceCents * row.quantity : sum),
    0,
  );
}

import { formatPriceCents } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { ApiError } from '@/data-access/http-client';
import { getProduct } from '@/data-access/products';
import { getCart } from '@/lib/cart-server';

import { CartLineItem } from './_components/cart-line-item';

export const metadata: Metadata = {
  title: 'Your cart',
};

interface CartRow {
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
 */
async function loadCartRows(
  cartItems: { productId: string; quantity: number }[],
): Promise<CartRow[]> {
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

export default async function CartPage(): Promise<ReactElement> {
  const cart = await getCart();

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Your cart is empty</h1>
        <Link href="/products" className="text-sm font-medium underline underline-offset-4">
          Browse products
        </Link>
      </div>
    );
  }

  const rows = await loadCartRows(cart.items);
  const subtotalCents = rows.reduce(
    (sum, row) => (row.isAvailable ? sum + row.priceCents * row.quantity : sum),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>

      <div className="flex flex-col">
        {rows.map((row) => (
          <CartLineItem
            key={row.productId}
            productId={row.productId}
            name={row.name}
            priceCents={row.priceCents}
            imageUrl={row.imageUrl}
            quantity={row.quantity}
            isAvailable={row.isAvailable}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
        <span className="text-lg font-semibold text-foreground">
          {formatPriceCents(subtotalCents)}
        </span>
      </div>

      <Link href="/products" className="text-sm font-medium underline underline-offset-4">
        Continue shopping
      </Link>
    </div>
  );
}

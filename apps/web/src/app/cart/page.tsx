import { Button, formatPriceCents } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { getCartSubtotalCents, loadCartRows } from '@/lib/cart-items';
import { getCart } from '@/lib/cart-server';

import { CartLineItem } from './_components/cart-line-item';

export const metadata: Metadata = {
  title: 'Your cart',
};

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
  const subtotalCents = getCartSubtotalCents(rows);

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

      {rows.every((row) => row.isAvailable) ? (
        <Button asChild size="lg">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
      ) : null}
    </div>
  );
}

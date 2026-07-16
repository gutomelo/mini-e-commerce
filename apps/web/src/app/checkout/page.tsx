import { formatPriceCents } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { getCartSubtotalCents, loadCartRows } from '@/lib/cart-items';
import { getCart } from '@/lib/cart-server';
import { getAccessToken } from '@/lib/session';

import { CheckoutItemRow } from './_components/checkout-item-row';
import { PlaceOrderButton } from './_components/place-order-button';

export const metadata: Metadata = {
  title: 'Checkout',
};

/**
 * Requires authentication at the page level (not just inside the Server
 * Action) so an unauthenticated visit to `/checkout` redirects immediately
 * instead of only failing once the shopper clicks "Place order".
 */
export default async function CheckoutPage(): Promise<ReactElement> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const cart = await getCart();
  if (cart.items.length === 0) {
    redirect('/cart');
  }

  const rows = await loadCartRows(cart.items);
  const subtotalCents = getCartSubtotalCents(rows);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      <div className="flex flex-col">
        {rows.map((row) => (
          <CheckoutItemRow key={row.productId} {...row} />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-lg font-semibold text-foreground">
          {formatPriceCents(subtotalCents)}
        </span>
      </div>

      <PlaceOrderButton />
    </div>
  );
}

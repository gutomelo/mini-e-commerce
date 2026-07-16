'use client';

import { Button } from '@mini-e-commerce/ui';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { addCartItem, readCartCookieClient, writeCartCookieClient } from '@/lib/cart';

export interface AddToCartButtonProps {
  productId: string;
}

/**
 * Adds the current product to the `cart` cookie directly from the browser
 * (see the strategy note in `lib/cart.ts` — no Server Action round trip,
 * since the cookie is not httpOnly and holds no sensitive data). The only
 * Client Component on the product detail page.
 *
 * `router.refresh()` re-runs the Server Components on this page (and the
 * `SiteHeader`) so the cart badge count picks up the change; this is a
 * client-side re-render of server output, not a full page reload.
 */
export function AddToCartButton({ productId }: AddToCartButtonProps): ReactElement {
  const router = useRouter();
  const [justAdded, setJustAdded] = useState(false);

  function handleAddToCart(): void {
    const currentCart = readCartCookieClient();
    const nextCart = addCartItem(currentCart, productId, 1);
    writeCartCookieClient(nextCart);

    setJustAdded(true);
    router.refresh();
  }

  return (
    <Button type="button" onClick={handleAddToCart} className="w-full sm:w-auto">
      {justAdded ? 'Added to cart' : 'Add to cart'}
    </Button>
  );
}

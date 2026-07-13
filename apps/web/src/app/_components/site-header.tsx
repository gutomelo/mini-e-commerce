import { Button, CartBadge } from '@mini-e-commerce/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { logoutAction } from '@/actions/auth';
import { getCartItemCount } from '@/lib/cart';
import { getCart } from '@/lib/cart-server';
import { getAccessToken } from '@/lib/session';

/**
 * Site header: nav + cart badge + auth actions. Stays a Server Component —
 * the cart count is read server-side from the `cart` cookie (via
 * `lib/cart.ts`'s `getCart()`) on every request, and the only interaction,
 * logout, is a `<form action={logoutAction}>` submit that needs no
 * client-side state.
 */
export async function SiteHeader(): Promise<ReactElement> {
  const [accessToken, cart] = await Promise.all([getAccessToken(), getCart()]);
  const cartItemCount = getCartItemCount(cart);

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Mini E-Commerce
        </Link>
        <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
          Products
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/cart" aria-label="View cart">
          <CartBadge count={cartItemCount} />
        </Link>

        {accessToken ? (
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

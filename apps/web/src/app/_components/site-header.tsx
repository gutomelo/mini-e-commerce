import { Button } from '@mini-e-commerce/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { logoutAction } from '@/actions/auth';
import { getAccessToken } from '@/lib/session';

/**
 * Minimal site header, just enough to make `logoutAction` reachable from
 * the UI before the catalog/cart nav (a later task) replaces it. Stays a
 * Server Component: the only interaction is a `<form action={logoutAction}>`
 * submit, which needs no client-side state.
 */
export async function SiteHeader(): Promise<ReactElement> {
  const accessToken = await getAccessToken();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Mini E-Commerce
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
    </header>
  );
}

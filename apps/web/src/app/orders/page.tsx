import { formatPriceCents, Pagination } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { listOrders } from '@/data-access/orders';
import { withOrderErrorHandling } from '@/lib/order-access';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Your orders',
};

interface OrdersPageProps {
  searchParams: Promise<{ page?: string }>;
}

function buildOrdersHref(page: number): string {
  return page > 1 ? `/orders?page=${page}` : '/orders';
}

function formatOrderDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Order history list — auth-gated, same pattern as `/checkout`. `listOrders`
 * is scoped server-side to the authenticated user, so this only ever shows
 * the caller's own orders.
 */
export default async function OrdersPage({ searchParams }: OrdersPageProps): Promise<ReactElement> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const { page: pageParam } = await searchParams;
  const parsedPage = Number(pageParam);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { data: orders, meta } = await withOrderErrorHandling(() => listOrders({ page }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>

      {meta.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t placed any orders yet.{' '}
          <Link href="/products" className="font-medium underline underline-offset-4">
            Browse products
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-col">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${encodeURIComponent(order.id)}`}
                className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-b-0 hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-sm text-foreground">{order.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatOrderDate(order.createdAt)} · {order.itemCount}{' '}
                    {order.itemCount === 1 ? 'item' : 'items'} · {order.status}
                  </span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {formatPriceCents(order.totalCents)}
                </span>
              </Link>
            ))}
          </div>

          <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildOrdersHref} />
        </>
      )}
    </div>
  );
}

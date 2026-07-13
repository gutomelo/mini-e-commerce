import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { OrderLineItems } from '@/app/_components/order-line-items';
import { ApiError } from '@/data-access/http-client';
import { getOrder, type Order } from '@/data-access/orders';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Order details',
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatOrderDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function loadOrder(id: string): Promise<Order> {
  try {
    return await getOrder(id);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.statusCode === 401) {
      // `authFetch` already tried a silent refresh and gave up (e.g. the
      // refresh token itself was rejected — expired, or already rotated
      // away by an earlier refresh this session never got to persist, since
      // cookie writes from a Server Component render are a no-op). Bounce
      // to `/login` instead of letting the page crash on an unhandled 401.
      redirect('/login');
    }
    throw error;
  }
}

/**
 * Single order detail page — auth-gated, same pattern as `/checkout`.
 * `getOrder` is scoped server-side to the authenticated user, so another
 * customer's order id 404s here rather than leaking its existence.
 */
export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps): Promise<ReactElement> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const { id } = await params;
  const order = await loadOrder(id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link href="/orders" className="text-sm font-medium underline underline-offset-4">
          Back to orders
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Order <span className="font-mono">{order.id}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Placed {formatOrderDate(order.createdAt)} · {order.status}
        </p>
      </div>

      <OrderLineItems items={order.items} totalCents={order.totalCents} />
    </div>
  );
}

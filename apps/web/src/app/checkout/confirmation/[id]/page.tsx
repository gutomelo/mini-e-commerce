import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { OrderLineItems } from '@/app/_components/order-line-items';
import { ApiError } from '@/data-access/http-client';
import { getOrder, type Order } from '@/data-access/orders';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Order confirmed',
};

interface ConfirmationPageProps {
  params: Promise<{ id: string }>;
}

async function loadOrder(id: string): Promise<Order> {
  try {
    return await getOrder(id);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.statusCode === 401) {
      // See the identical comment in `app/orders/[id]/page.tsx`: a silent
      // refresh that fails here means the session is genuinely
      // unrecoverable, not just a transient hiccup — redirect rather than
      // crash on an unhandled 401.
      redirect('/login');
    }
    throw error;
  }
}

/**
 * Standalone confirmation page shown right after checkout. Shows everything
 * needed to independently verify a successful checkout (order id, line
 * items, total) and links into full order history (`/orders`).
 *
 * Requires authentication like every other order-scoped page — `getOrder`
 * is scoped server-side to the authenticated user, so this also doubles as
 * protection against viewing another customer's order confirmation.
 */
export default async function CheckoutConfirmationPage({
  params,
}: ConfirmationPageProps): Promise<ReactElement> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const { id } = await params;
  const order = await loadOrder(id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Order placed!</h1>
        <p className="text-sm text-muted-foreground">
          Order <span className="font-mono">{order.id}</span> has been placed successfully.
        </p>
      </div>

      <OrderLineItems items={order.items} totalCents={order.totalCents} />

      <div className="flex items-center gap-4">
        <Link href="/products" className="text-sm font-medium underline underline-offset-4">
          Continue shopping
        </Link>
        <Link href="/orders" className="text-sm font-medium underline underline-offset-4">
          View all orders
        </Link>
      </div>
    </div>
  );
}

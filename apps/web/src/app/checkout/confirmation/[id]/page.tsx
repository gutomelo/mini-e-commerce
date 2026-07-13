import { formatPriceCents } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

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
    throw error;
  }
}

/**
 * Minimal standalone confirmation page — Task #58 (order history, `/orders`
 * and `/orders/[id]`) hasn't landed yet, so this deliberately does not
 * redirect to a not-yet-existing order detail route. It shows everything
 * needed to independently verify a successful checkout (order id, line
 * items, total) and can later gain a link into full order history once
 * that route exists.
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

      <div className="flex flex-col">
        {order.items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{item.productName}</span>
              <span className="text-xs text-muted-foreground">Qty {item.quantity}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {formatPriceCents(item.unitPriceCents * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-lg font-semibold text-foreground">
          {formatPriceCents(order.totalCents)}
        </span>
      </div>

      <Link href="/products" className="text-sm font-medium underline underline-offset-4">
        Continue shopping
      </Link>
    </div>
  );
}

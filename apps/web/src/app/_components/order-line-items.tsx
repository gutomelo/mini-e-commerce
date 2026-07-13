import { formatPriceCents } from '@mini-e-commerce/ui';
import type { ReactElement } from 'react';

import type { OrderItem } from '@/data-access/orders';

interface OrderLineItemsProps {
  items: OrderItem[];
  totalCents: number;
}

/**
 * Shared line-items + total block, used by both the checkout confirmation
 * page (`app/checkout/confirmation/[id]`) and the order detail page
 * (`app/orders/[id]`) — the two pages show the same order shape but frame it
 * differently (confirmation messaging vs. order history chrome), so only
 * this inner presentational slice is factored out.
 */
export function OrderLineItems({ items, totalCents }: OrderLineItemsProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        {items.map((item) => (
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
          {formatPriceCents(totalCents)}
        </span>
      </div>
    </div>
  );
}

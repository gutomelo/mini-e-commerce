import { formatPriceCents } from '@mini-e-commerce/ui';
import type { ReactElement } from 'react';

import type { CartRow } from '@/lib/cart-items';

export type CheckoutItemRowProps = CartRow;

/**
 * Read-only summary row for one cart line item on the checkout page — no
 * quantity stepper or remove control (those live on `/cart`). An
 * unavailable item (deleted/deactivated product) is shown struck through
 * with a warning so the shopper understands why "Place order" might fail,
 * without this page duplicating the API's authoritative rejection.
 */
export function CheckoutItemRow({
  name,
  quantity,
  priceCents,
  isAvailable,
}: CheckoutItemRowProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span
          className={
            isAvailable ? 'text-sm font-medium text-foreground' : 'text-sm font-medium line-through'
          }
        >
          {name}
        </span>
        <span className="text-xs text-muted-foreground">Qty {quantity}</span>
        {!isAvailable ? (
          <span role="alert" className="text-xs text-destructive">
            No longer available
          </span>
        ) : null}
      </div>

      {isAvailable ? (
        <span className="text-sm font-semibold text-foreground">
          {formatPriceCents(priceCents * quantity)}
        </span>
      ) : null}
    </div>
  );
}

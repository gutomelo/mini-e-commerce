import { ShoppingCart } from 'lucide-react';
import type { ReactElement } from 'react';

import { cn } from '../lib/utils.js';

export interface CartBadgeProps {
  /** Current item count. The consuming page/layout owns the cart state. */
  count: number;
  className?: string;
}

/**
 * Purely presentational cart icon with a count pill. Carries no cart logic
 * of its own — the caller reads the `cart` cookie (see the storefront spec)
 * and passes the resulting count in.
 */
export function CartBadge({ count, className }: CartBadgeProps): ReactElement {
  const displayCount = count > 99 ? '99+' : String(count);

  return (
    <span
      data-slot="cart-badge"
      className={cn('relative inline-flex items-center justify-center', className)}
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {displayCount}
        </span>
      )}
    </span>
  );
}

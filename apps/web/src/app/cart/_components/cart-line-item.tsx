'use client';

import { Button, formatPriceCents } from '@mini-e-commerce/ui';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import type { Cart } from '@/lib/cart';
import {
  readCartCookieClient,
  removeCartItem,
  updateCartItemQuantity,
  writeCartCookieClient,
} from '@/lib/cart';

export interface CartLineItemProps {
  productId: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
  /** `false` when `getProduct` 404'd for this line item (deleted/deactivated). */
  isAvailable: boolean;
}

/**
 * One cart row: quantity stepper + remove button, both mutating the `cart`
 * cookie directly in the browser (see `lib/cart.ts` for the strategy note).
 * The only Client Component under `/cart` — the page itself stays a Server
 * Component that composes these rows from server-fetched product data.
 */
export function CartLineItem({
  productId,
  name,
  priceCents,
  imageUrl,
  quantity,
  isAvailable,
}: CartLineItemProps): ReactElement {
  const router = useRouter();

  function mutateCart(mutate: (cart: Cart) => Cart): void {
    const currentCart = readCartCookieClient();
    const nextCart = mutate(currentCart);
    writeCartCookieClient(nextCart);
    router.refresh();
  }

  function handleQuantityChange(nextQuantity: number): void {
    mutateCart((cart) => updateCartItemQuantity(cart, productId, nextQuantity));
  }

  function handleRemove(): void {
    mutateCart((cart) => removeCartItem(cart, productId));
  }

  return (
    <div className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
      <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span
          className={
            isAvailable ? 'text-sm font-medium text-foreground' : 'text-sm font-medium line-through'
          }
        >
          {name}
        </span>

        {isAvailable ? (
          <>
            <span className="text-sm text-muted-foreground">{formatPriceCents(priceCents)}</span>

            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Decrease quantity"
                onClick={() => handleQuantityChange(quantity - 1)}
              >
                -
              </Button>
              <span className="w-8 text-center text-sm" aria-live="polite">
                {quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Increase quantity"
                onClick={() => handleQuantityChange(quantity + 1)}
              >
                +
              </Button>
            </div>
          </>
        ) : (
          <span role="alert" className="text-sm text-destructive">
            No longer available — please remove it from your cart.
          </span>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        {isAvailable && (
          <span className="text-sm font-semibold text-foreground">
            {formatPriceCents(priceCents * quantity)}
          </span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

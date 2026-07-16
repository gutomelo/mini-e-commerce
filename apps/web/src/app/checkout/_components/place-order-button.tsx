'use client';

import { Button } from '@mini-e-commerce/ui';
import type { ReactElement } from 'react';
import { useActionState } from 'react';

import { type CheckoutFormState, checkoutAction } from '@/actions/checkout';

const initialState: CheckoutFormState = {};

/**
 * "Place order" control, kept as the only Client Component on the checkout
 * page — it exists solely to wire `useActionState` to `checkoutAction` and
 * render the "items no longer available" error inline; the surrounding page
 * stays a Server Component.
 */
export function PlaceOrderButton(): ReactElement {
  const [state, formAction, pending] = useActionState(checkoutAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? 'Placing order...' : 'Place order'}
      </Button>
    </form>
  );
}

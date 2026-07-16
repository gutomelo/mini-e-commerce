'use server';

import { redirect } from 'next/navigation';

import { createOrder } from '@/data-access/orders';
import { ApiError } from '@/data-access/http-client';
import { clearCartCookie, getCart } from '@/lib/cart-server';
import { getAccessToken } from '@/lib/session';

/** Shape returned to the client button component via `useActionState`. */
export interface CheckoutFormState {
  error?: string;
}

/**
 * Places an order from the current cart cookie. No form fields — it acts
 * entirely on server-side state (the auth cookie and the cart cookie).
 *
 * The NestJS API is the authoritative re-pricing/availability check: it
 * re-prices every item from the live `Product` record and rejects the
 * *entire* order with a 404 if any item is missing or inactive (see
 * `CreateOrderUseCase`), rather than silently dropping the bad item. This
 * action never trusts the cart cookie's contents beyond `{ productId,
 * quantity }` pairs and never duplicates that validation client-side.
 *
 * On a 404 rejection, the cart cookie is deliberately left untouched so the
 * shopper can go remove the offending item from `/cart` and retry. On
 * success, the cart is cleared and the shopper is redirected to a
 * confirmation page.
 */
export async function checkoutAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
  _prevState: CheckoutFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- no form fields; action reads server state
  _formData: FormData,
): Promise<CheckoutFormState> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const cart = await getCart();
  if (cart.items.length === 0) {
    redirect('/cart');
  }

  let orderId: string;
  try {
    const order = await createOrder({ items: cart.items });
    orderId = order.id;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return {
        error: 'One or more items in your cart are no longer available. Please review your cart.',
      };
    }
    throw error;
  }

  await clearCartCookie();
  redirect(`/checkout/confirmation/${orderId}`);
}

import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';
import { authFetch, toQueryString } from './http-client';

export interface OrderItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  status: string;
  totalCents: number;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderSummary {
  id: string;
  status: string;
  totalCents: number;
  itemCount: number;
  createdAt: string;
}

export interface CreateOrderInput {
  items: Array<{ productId: string; quantity: number }>;
}

export interface ListOrdersQuery {
  page?: number;
  limit?: number;
}

/** `POST /api/v1/orders` — requires authentication. */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const response = await authFetch<SingleResponse<Order>>('/api/v1/orders', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

/** `GET /api/v1/orders` — requires authentication; scoped to the caller. */
export async function listOrders(query: ListOrdersQuery = {}): Promise<ListResponse<OrderSummary>> {
  return authFetch<ListResponse<OrderSummary>>(`/api/v1/orders${toQueryString(query)}`);
}

/** `GET /api/v1/orders/:id` — requires authentication; scoped to the caller. */
export async function getOrder(id: string): Promise<Order> {
  const response = await authFetch<SingleResponse<Order>>(
    `/api/v1/orders/${encodeURIComponent(id)}`,
  );
  return response.data;
}

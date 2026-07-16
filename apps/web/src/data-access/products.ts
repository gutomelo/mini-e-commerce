import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';
import { publicFetch, toQueryString } from './http-client';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

/** `GET /api/v1/products` — public, cached, paginated, filterable. */
export async function listProducts(query: ListProductsQuery = {}): Promise<ListResponse<Product>> {
  return publicFetch<ListResponse<Product>>(`/api/v1/products${toQueryString(query)}`);
}

/** `GET /api/v1/products/:idOrSlug` — public, cached. */
export async function getProduct(idOrSlug: string): Promise<Product> {
  const response = await publicFetch<SingleResponse<Product>>(
    `/api/v1/products/${encodeURIComponent(idOrSlug)}`,
  );
  return response.data;
}

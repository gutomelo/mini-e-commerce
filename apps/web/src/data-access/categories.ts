import type { ListResponse } from '@mini-e-commerce/types';
import { publicFetch } from './http-client';

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/v1/categories` — public, cached. */
export async function listCategories(): Promise<Category[]> {
  const response = await publicFetch<ListResponse<Category>>('/api/v1/categories');
  return response.data;
}

import { Product } from '../../../domain/catalog/product.entity';

/** Shape returned to the presentation layer for a single product. */
export interface ProductOutput {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductOutput(product: Product): ProductOutput {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

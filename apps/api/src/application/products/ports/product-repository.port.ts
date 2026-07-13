import {
  NewProduct,
  Product,
  ProductListFilter,
  ProductListResult,
  ProductUpdate,
} from '../../../domain/catalog/product.entity';

/**
 * Abstracts product persistence. Use cases depend only on this interface;
 * `PrismaProductRepository` (infrastructure layer) is the concrete adapter.
 *
 * `findById`/`findBySlug` only ever return active products — a soft-deleted
 * product (`isActive: false`) behaves as if it does not exist for every
 * read path, since there is no separate "admin get" endpoint in the API
 * contract.
 */
export abstract class ProductRepository {
  abstract list(filter: ProductListFilter): Promise<ProductListResult>;
  abstract findById(id: string): Promise<Product | null>;
  abstract findBySlug(slug: string): Promise<Product | null>;
  abstract existsBySlug(slug: string): Promise<boolean>;
  abstract create(product: NewProduct): Promise<Product>;
  abstract update(id: string, update: ProductUpdate): Promise<Product>;
  /** Soft delete: sets `isActive = false`. */
  abstract softDelete(id: string): Promise<void>;
}

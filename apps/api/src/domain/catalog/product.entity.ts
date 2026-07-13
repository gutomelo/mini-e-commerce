/**
 * Domain representation of a catalog product. Intentionally decoupled from
 * the generated Prisma model so application/domain code has no framework or
 * ORM dependency — infrastructure repositories are responsible for mapping
 * between this shape and persistence.
 *
 * `priceCents` stores price as an integer in the smallest currency unit
 * (cents) to avoid floating-point rounding issues; every price-related
 * query parameter (`minPrice`/`maxPrice`) is expressed in the same unit.
 */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly priceCents: number;
  readonly imageUrl: string | null;
  readonly categoryId: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Fields required to create a new product; id/timestamps/isActive are assigned by persistence. */
export type NewProduct = Pick<
  Product,
  'name' | 'slug' | 'description' | 'priceCents' | 'categoryId'
> & {
  imageUrl?: string | null;
};

/** Partial fields accepted when updating a product. */
export type ProductUpdate = Partial<
  Pick<Product, 'name' | 'slug' | 'description' | 'priceCents' | 'categoryId' | 'imageUrl'>
>;

/** Supported sort fields for product listing. */
export type ProductSortField = 'createdAt' | 'price';

/** Supported sort directions. */
export type ProductSortDirection = 'asc' | 'desc';

/** Normalized, validated filter used by `ProductRepository.list`. */
export interface ProductListFilter {
  page: number;
  limit: number;
  search?: string;
  categorySlug?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sortField: ProductSortField;
  sortDirection: ProductSortDirection;
}

/** Result of a paginated product list query. */
export interface ProductListResult {
  items: Product[];
  total: number;
}

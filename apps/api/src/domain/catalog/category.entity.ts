/**
 * Domain representation of a product category. Intentionally decoupled from
 * the generated Prisma model so application/domain code has no framework or
 * ORM dependency — infrastructure repositories are responsible for mapping
 * between this shape and persistence.
 */
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Fields required to create a new category; id/timestamps are assigned by persistence. */
export type NewCategory = Pick<Category, 'name' | 'slug'>;

/** Partial fields accepted when updating a category. */
export type CategoryUpdate = Partial<Pick<Category, 'name' | 'slug'>>;

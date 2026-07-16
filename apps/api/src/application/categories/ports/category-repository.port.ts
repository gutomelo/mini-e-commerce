import { Category, CategoryUpdate, NewCategory } from '../../../domain/catalog/category.entity';

/**
 * Abstracts category persistence. Use cases depend only on this interface;
 * `PrismaCategoryRepository` (infrastructure layer) is the concrete adapter.
 */
export abstract class CategoryRepository {
  abstract findAll(): Promise<Category[]>;
  abstract findById(id: string): Promise<Category | null>;
  /** Looks up a category matching either `name` or `slug` (used for uniqueness checks). */
  abstract findByNameOrSlug(name: string, slug: string): Promise<Category | null>;
  abstract create(category: NewCategory): Promise<Category>;
  abstract update(id: string, update: CategoryUpdate): Promise<Category>;
  abstract delete(id: string): Promise<void>;
  /** Number of products currently referencing this category (used to guard deletes). */
  abstract countProductsByCategory(id: string): Promise<number>;
}

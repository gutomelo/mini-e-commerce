/**
 * Typed shapes for the response envelopes exercised by the e2e suite.
 * `supertest`'s `response.body` is typed `any`; casting through these
 * interfaces (via `bodyOf<T>` in `test-app.ts`) keeps assertions type-safe
 * and satisfies the `@typescript-eslint/no-unsafe-*` rules without
 * resorting to `any` in the specs themselves.
 */
import type { CategoryOutput } from '../../src/application/categories/use-cases/list-categories.use-case';
import type { ProductOutput } from '../../src/application/products/use-cases/product-output';
import type { ProfileOutput } from '../../src/application/users/use-cases/get-profile.use-case';
import type { UserRole } from '../../src/domain/auth/user-role.enum';
import type { ListResponse, SingleResponse } from '../../src/presentation/contracts';

export interface TokenPairBody {
  accessToken: string;
  refreshToken: string;
}

export interface RegisteredUserBody {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type TokenPairResponse = SingleResponse<TokenPairBody>;
export type RegisteredUserResponse = SingleResponse<RegisteredUserBody>;
export type ProfileResponse = SingleResponse<ProfileOutput>;
export type ProductListResponse = ListResponse<ProductOutput>;
export type ProductResponse = SingleResponse<ProductOutput>;
export type CategoryListResponse = ListResponse<CategoryOutput>;
export type CategoryResponse = SingleResponse<CategoryOutput>;

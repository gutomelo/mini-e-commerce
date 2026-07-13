import { INestApplication } from '@nestjs/common';
import Redis from 'ioredis';
import type { App } from 'supertest/types';
import { loginAsAdmin, uniqueSuffix } from './support/fixtures';
import type {
  CategoryListResponse,
  CategoryResponse,
  ProductListResponse,
} from './support/response-types';
import { TEST_REDIS_URL } from './support/test-env';
import { api, API_V1, bodyOf, createTestApp } from './support/test-app';

/**
 * Proves the cache-aside behavior end to end: a repeated read is served
 * consistently, and a write invalidates it so the next read reflects the
 * change rather than serving stale data.
 *
 * Category reads are additionally verified directly against Redis (the
 * category list cache key is a fixed constant, `categories:list`, so it can
 * be asserted without depending on the product list's query-hash key
 * layout) — the "nice-to-have" stronger assertion from the spec.
 */
describe('Cache hit + invalidation (e2e)', () => {
  let app: INestApplication<App>;
  let redis: Redis;

  beforeAll(async () => {
    app = await createTestApp();
    redis = new Redis(TEST_REDIS_URL);
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  it('serves categories from Redis on a repeated read and invalidates on write', async () => {
    // Warm the cache.
    const firstResponse = await api(app).get(`${API_V1}/categories`).expect(200);
    const first = bodyOf<CategoryListResponse>(firstResponse);
    const cachedRaw = await redis.get('categories:list');
    expect(cachedRaw).not.toBeNull();
    const cachedValue = JSON.parse(cachedRaw as string) as CategoryListResponse['data'];
    expect(cachedValue).toEqual(first.data);

    // Repeated read is consistent with the cached value.
    const secondResponse = await api(app).get(`${API_V1}/categories`).expect(200);
    const second = bodyOf<CategoryListResponse>(secondResponse);
    expect(second.data).toEqual(first.data);

    // A write invalidates the cache key.
    const admin = await loginAsAdmin(app);
    const newCategoryName = `Cache Test Category ${uniqueSuffix()}`;
    const newCategorySlug = `cache-test-category-${uniqueSuffix()}`;
    await api(app)
      .post(`${API_V1}/categories`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: newCategoryName, slug: newCategorySlug })
      .expect(201);

    const afterWriteCachedRaw = await redis.get('categories:list');
    expect(afterWriteCachedRaw).toBeNull();

    // Next read reflects the new category (not stale) and repopulates the cache.
    const thirdResponse = await api(app).get(`${API_V1}/categories`).expect(200);
    const third = bodyOf<CategoryListResponse>(thirdResponse);
    expect(third.data.length).toBe(first.data.length + 1);
    expect(third.data.map((category) => category.slug)).toContain(newCategorySlug);

    const repopulatedRaw = await redis.get('categories:list');
    expect(repopulatedRaw).not.toBeNull();
  });

  it('serves the product list from cache and invalidates it when a product is created', async () => {
    const admin = await loginAsAdmin(app);

    const categorySlug = `product-cache-test-${uniqueSuffix()}`;
    const categoryResponse = await api(app)
      .post(`${API_V1}/categories`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: `Product Cache Test ${uniqueSuffix()}`, slug: categorySlug })
      .expect(201);
    const categoryId = bodyOf<CategoryResponse>(categoryResponse).data.id;

    // Empty list, warmed into cache.
    const emptyListResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: categorySlug })
      .expect(200);
    const emptyList = bodyOf<ProductListResponse>(emptyListResponse);
    expect(emptyList.meta.total).toBe(0);

    // Repeated read is consistent (served from cache, not re-queried).
    const emptyListAgainResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: categorySlug })
      .expect(200);
    expect(bodyOf<ProductListResponse>(emptyListAgainResponse)).toEqual(emptyList);

    // Write invalidates the product list cache.
    const productName = `Cache Invalidation Product ${uniqueSuffix()}`;
    await api(app)
      .post(`${API_V1}/products`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: productName,
        slug: `cache-invalidation-product-${uniqueSuffix()}`,
        description: 'Verifies the product list cache is invalidated on write.',
        priceCents: 1500,
        categoryId,
      })
      .expect(201);

    // The next identical read must reflect the new product, not the stale
    // empty cached result.
    const listAfterWriteResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: categorySlug })
      .expect(200);
    const listAfterWrite = bodyOf<ProductListResponse>(listAfterWriteResponse);
    expect(listAfterWrite.meta.total).toBe(1);
    expect(listAfterWrite.data[0].name).toBe(productName);
  });
});

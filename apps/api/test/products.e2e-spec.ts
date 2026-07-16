import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { ProductListResponse, ProductResponse } from './support/response-types';
import { api, API_V1, bodyOf, createTestApp } from './support/test-app';

/**
 * Exercises pagination, filtering, and sorting against the known seed
 * catalog (`prisma/seed.ts`: 3 categories, 12 products) applied by
 * `test/global-setup.ts`. No other spec in this suite writes into the
 * seeded `electronics`/`apparel`/`home-kitchen` categories (writes use a
 * spec-local dedicated category instead), so exact counts here stay stable
 * regardless of test file execution order.
 */
describe('Products pagination, filtering, sorting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the list envelope shape with data and meta', async () => {
    const response = await api(app).get(`${API_V1}/products`).expect(200);
    const body = bodyOf<ProductListResponse>(response);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.page).toBe(1);
    expect(typeof body.meta.limit).toBe('number');
    expect(typeof body.meta.total).toBe('number');
    expect(typeof body.meta.totalPages).toBe('number');
    expect(body.meta.total).toBeGreaterThanOrEqual(12);
  });

  it('paginates with page/limit', async () => {
    const pageOneResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: 'electronics', page: 1, limit: 2 })
      .expect(200);
    const pageOne = bodyOf<ProductListResponse>(pageOneResponse);
    expect(pageOne.data).toHaveLength(2);
    expect(pageOne.meta).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2 });

    const pageTwoResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: 'electronics', page: 2, limit: 2 })
      .expect(200);
    const pageTwo = bodyOf<ProductListResponse>(pageTwoResponse);
    expect(pageTwo.data).toHaveLength(2);

    const pageOneIds = pageOne.data.map((product) => product.id);
    const pageTwoIds = pageTwo.data.map((product) => product.id);
    expect(pageOneIds).not.toEqual(expect.arrayContaining(pageTwoIds));
  });

  it('filters by category slug', async () => {
    const response = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: 'apparel', limit: 50 })
      .expect(200);
    const body = bodyOf<ProductListResponse>(response);

    expect(body.meta.total).toBe(4);
    for (const product of body.data) {
      expect(product.categoryId).toEqual(body.data[0].categoryId);
    }
  });

  it('filters by name/description search', async () => {
    const response = await api(app)
      .get(`${API_V1}/products`)
      .query({ search: 'coffee', limit: 50 })
      .expect(200);
    const body = bodyOf<ProductListResponse>(response);

    expect(body.meta.total).toBe(2);
    const names = body.data.map((product) => product.name).sort();
    expect(names).toEqual(['Ceramic Pour-Over Coffee Set', 'Stainless Steel French Press']);
  });

  it('filters by price range', async () => {
    const response = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: 'electronics', minPrice: 5000, maxPrice: 20000, limit: 50 })
      .expect(200);
    const body = bodyOf<ProductListResponse>(response);

    expect(body.meta.total).toBe(3);
    for (const product of body.data) {
      expect(product.priceCents).toBeGreaterThanOrEqual(5000);
      expect(product.priceCents).toBeLessThanOrEqual(20000);
    }
  });

  it('sorts by price ascending', async () => {
    const response = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: 'apparel', sort: 'price:asc', limit: 50 })
      .expect(200);
    const body = bodyOf<ProductListResponse>(response);

    const prices = body.data.map((product) => product.priceCents);
    expect(prices).toEqual([1999, 3999, 4999, 5499]);
  });

  it('sorts by price descending', async () => {
    const response = await api(app)
      .get(`${API_V1}/products`)
      .query({ category: 'apparel', sort: 'price:desc', limit: 50 })
      .expect(200);
    const body = bodyOf<ProductListResponse>(response);

    const prices = body.data.map((product) => product.priceCents);
    expect(prices).toEqual([5499, 4999, 3999, 1999]);
  });

  it('gets a product by slug and by id', async () => {
    const bySlugResponse = await api(app)
      .get(`${API_V1}/products/wireless-bluetooth-headphones`)
      .expect(200);
    const bySlug = bodyOf<ProductResponse>(bySlugResponse);
    expect(bySlug.data.name).toBe('Wireless Bluetooth Headphones');

    const byIdResponse = await api(app).get(`${API_V1}/products/${bySlug.data.id}`).expect(200);
    const byId = bodyOf<ProductResponse>(byIdResponse);
    expect(byId.data.slug).toBe('wireless-bluetooth-headphones');
  });

  it('returns 404 for an unknown product', async () => {
    await api(app).get(`${API_V1}/products/00000000-0000-0000-0000-000000000000`).expect(404);
  });
});

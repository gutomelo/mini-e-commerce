import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { loginAsAdmin, registerAndLoginCustomer, uniqueSuffix } from './support/fixtures';
import type { CategoryResponse, ProductResponse } from './support/response-types';
import { api, API_V1, bodyOf, createTestApp } from './support/test-app';

describe('RBAC on catalog writes (e2e)', () => {
  let app: INestApplication<App>;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await loginAsAdmin(app);

    // Dedicated category for this spec's writes, so its products never leak
    // into the pagination/filter assertions that rely on the seeded catalog.
    const categoryResponse = await api(app)
      .post(`${API_V1}/categories`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: `RBAC Test Category ${uniqueSuffix()}`, slug: `rbac-test-${uniqueSuffix()}` })
      .expect(201);
    categoryId = bodyOf<CategoryResponse>(categoryResponse).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a CUSTOMER creating a product with 403', async () => {
    const customer = await registerAndLoginCustomer(app);

    await api(app)
      .post(`${API_V1}/products`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        name: 'Should Be Rejected',
        slug: `should-be-rejected-${uniqueSuffix()}`,
        description: 'A product a customer should never be able to create.',
        priceCents: 1000,
        categoryId,
      })
      .expect(403);
  });

  it('rejects an unauthenticated product create with 401', async () => {
    await api(app)
      .post(`${API_V1}/products`)
      .send({
        name: 'Should Be Rejected',
        slug: `anon-rejected-${uniqueSuffix()}`,
        description: 'A product an anonymous caller should never be able to create.',
        priceCents: 1000,
        categoryId,
      })
      .expect(401);
  });

  it('allows an ADMIN to create a product with 201', async () => {
    const admin = await loginAsAdmin(app);

    const response = await api(app)
      .post(`${API_V1}/products`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: 'RBAC Admin Product',
        slug: `rbac-admin-product-${uniqueSuffix()}`,
        description: 'A product only an admin can create.',
        priceCents: 4200,
        categoryId,
      })
      .expect(201);

    expect(bodyOf<ProductResponse>(response).data).toMatchObject({
      name: 'RBAC Admin Product',
      priceCents: 4200,
    });
  });

  it('rejects a CUSTOMER creating a category with 403 and allows an ADMIN with 201', async () => {
    const customer = await registerAndLoginCustomer(app);
    const admin = await loginAsAdmin(app);

    await api(app)
      .post(`${API_V1}/categories`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ name: 'Customer Category', slug: `customer-category-${uniqueSuffix()}` })
      .expect(403);

    await api(app)
      .post(`${API_V1}/categories`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: `Admin Category ${uniqueSuffix()}`, slug: `admin-category-${uniqueSuffix()}` })
      .expect(201);
  });
});

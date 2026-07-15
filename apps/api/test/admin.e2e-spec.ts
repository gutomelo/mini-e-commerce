import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { FakeInventoryClient } from '../src/infrastructure/inventory/fake-inventory-client';
import { loginAsAdmin, registerAndLoginCustomer, type TokenPair } from './support/fixtures';
import type {
  AdminOrderListResponse,
  AdminOrderResponse,
  OrderResponse,
  ProductListResponse,
  StockResponse,
} from './support/response-types';
import { api, API_V1, bodyOf, createTestApp } from './support/test-app';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Covers the two ADMIN-only surfaces added in Phase 7 for the admin panel:
 * `GET /admin/orders` (+ `:id`), the cross-customer order review, and
 * `GET`/`PATCH /admin/inventory/:productId`, the stock proxy to
 * `apps/inventory`. Both are gated by `JwtAuthGuard` + `RolesGuard` +
 * `@Roles(ADMIN)`, so every endpoint here is exercised unauthenticated,
 * as a CUSTOMER, and as the seeded ADMIN.
 *
 * `apps/inventory` has no host port published (internal-only, reachable
 * only inside the Docker Compose network), so this app is bootstrapped with
 * `InventoryClient` overridden by an in-memory `FakeInventoryClient` — see
 * `test/support/test-app.ts`'s `createTestApp({ fakeInventoryClient })`.
 *
 * Every login/register call counts against `AuthController`'s shared 10
 * req/min throttle bucket (see `test/README.md` and
 * `throttling.e2e-spec.ts`), and this whole file runs against one
 * long-lived app instance. So tokens are minted **once** in `beforeAll`
 * (one admin login, one RBAC customer, two order-owning customers) and
 * reused across every `it`, instead of logging in fresh per test.
 */
describe('Admin panel: orders review + inventory proxy (e2e)', () => {
  let app: INestApplication<App>;
  let fakeInventoryClient: FakeInventoryClient;
  let productId: string;
  let admin: TokenPair;
  let customer: TokenPair;
  let orderA: { orderId: string; userEmail: string; userId: string };
  let orderB: { orderId: string; userEmail: string; userId: string };

  beforeAll(async () => {
    fakeInventoryClient = new FakeInventoryClient();
    app = await createTestApp({ fakeInventoryClient });

    const productsResponse = await api(app)
      .get(`${API_V1}/products`)
      .query({ limit: 1 })
      .expect(200);
    const products = bodyOf<ProductListResponse>(productsResponse);
    productId = products.data[0].id;

    admin = await loginAsAdmin(app);
    customer = await registerAndLoginCustomer(app);

    orderA = await placeOrder();
    orderB = await placeOrder();

    // Cross-check both orders via the admin detail endpoint once, up front,
    // so the `userId` each order belongs to is known for the "more than one
    // customer" assertion below without any extra login calls.
    const detailA = bodyOf<AdminOrderResponse>(
      await api(app)
        .get(`${API_V1}/admin/orders/${orderA.orderId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200),
    );
    orderA.userId = detailA.data.userId;
    const detailB = bodyOf<AdminOrderResponse>(
      await api(app)
        .get(`${API_V1}/admin/orders/${orderB.orderId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200),
    );
    orderB.userId = detailB.data.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Registers a fresh customer and has them place a single-item order, returning both. */
  async function placeOrder(): Promise<{ orderId: string; userEmail: string; userId: string }> {
    const buyer = await registerAndLoginCustomer(app);

    const createResponse = await api(app)
      .post(`${API_V1}/orders`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(201);
    const created = bodyOf<OrderResponse>(createResponse);

    return { orderId: created.data.id, userEmail: buyer.email, userId: '' };
  }

  describe('GET /admin/orders', () => {
    it('rejects an unauthenticated caller with 401', async () => {
      await api(app).get(`${API_V1}/admin/orders`).expect(401);
    });

    it('rejects a CUSTOMER with 403', async () => {
      await api(app)
        .get(`${API_V1}/admin/orders`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);
    });

    it('returns orders belonging to more than one customer for an ADMIN', async () => {
      const response = await api(app)
        .get(`${API_V1}/admin/orders`)
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      const body = bodyOf<AdminOrderListResponse>(response);

      const byId = new Map(body.data.map((order) => [order.id, order]));
      expect(byId.get(orderA.orderId)).toMatchObject({ userEmail: orderA.userEmail });
      expect(byId.get(orderB.orderId)).toMatchObject({ userEmail: orderB.userEmail });
      expect(byId.get(orderA.orderId)?.userId).not.toBe(byId.get(orderB.orderId)?.userId);
    });

    it('filters by a valid status and rejects an invalid one with 400', async () => {
      const filteredResponse = await api(app)
        .get(`${API_V1}/admin/orders`)
        .query({ status: 'PLACED', limit: 100 })
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      const filtered = bodyOf<AdminOrderListResponse>(filteredResponse);

      expect(filtered.data.some((order) => order.id === orderA.orderId)).toBe(true);
      for (const order of filtered.data) {
        expect(order.status).toBe('PLACED');
      }

      await api(app)
        .get(`${API_V1}/admin/orders`)
        .query({ status: 'NOT_A_REAL_STATUS' })
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(400);
    });
  });

  describe('GET /admin/orders/:id', () => {
    it('returns the full order (with userId/userEmail) for a customer order, unscoped', async () => {
      const response = await api(app)
        .get(`${API_V1}/admin/orders/${orderA.orderId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      const body = bodyOf<AdminOrderResponse>(response);

      expect(body.data).toMatchObject({ id: orderA.orderId, userEmail: orderA.userEmail });
      expect(typeof body.data.userId).toBe('string');
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('returns 404 for an unknown order id', async () => {
      await api(app)
        .get(`${API_V1}/admin/orders/${UNKNOWN_ID}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(404);
    });
  });

  describe('GET/PATCH /admin/inventory/:productId', () => {
    beforeAll(() => {
      fakeInventoryClient.seed(productId, 42);
    });

    it('rejects an unauthenticated caller with 401 on both GET and PATCH', async () => {
      await api(app).get(`${API_V1}/admin/inventory/${productId}`).expect(401);
      await api(app)
        .patch(`${API_V1}/admin/inventory/${productId}`)
        .send({ quantity: 5 })
        .expect(401);
    });

    it('rejects a CUSTOMER with 403 on both GET and PATCH', async () => {
      await api(app)
        .get(`${API_V1}/admin/inventory/${productId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);
      await api(app)
        .patch(`${API_V1}/admin/inventory/${productId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ quantity: 5 })
        .expect(403);
    });

    it('returns the seeded quantity for an ADMIN', async () => {
      const response = await api(app)
        .get(`${API_V1}/admin/inventory/${productId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      const body = bodyOf<StockResponse>(response);

      expect(body.data).toMatchObject({ productId, quantity: 42 });
    });

    it('updates the quantity via PATCH, verified by a subsequent GET', async () => {
      const patchResponse = await api(app)
        .patch(`${API_V1}/admin/inventory/${productId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ quantity: 7 })
        .expect(200);
      expect(bodyOf<StockResponse>(patchResponse).data.quantity).toBe(7);

      const getResponse = await api(app)
        .get(`${API_V1}/admin/inventory/${productId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(bodyOf<StockResponse>(getResponse).data.quantity).toBe(7);
    });

    it('rejects a negative quantity with 400 (DTO validation, never reaching the fake)', async () => {
      await api(app)
        .patch(`${API_V1}/admin/inventory/${productId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ quantity: -1 })
        .expect(400);
    });

    it('rejects a malformed (non-UUID) productId with 400', async () => {
      await api(app)
        .get(`${API_V1}/admin/inventory/not-a-uuid`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(400);
      await api(app)
        .patch(`${API_V1}/admin/inventory/not-a-uuid`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ quantity: 5 })
        .expect(400);
    });

    it('returns 404 for a UUID-shaped but unseeded productId', async () => {
      await api(app)
        .get(`${API_V1}/admin/inventory/${UNKNOWN_ID}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(404);
    });
  });
});

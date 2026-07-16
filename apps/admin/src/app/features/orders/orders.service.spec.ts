import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';

import { AdminOrder, AdminOrderSummary, OrdersService } from './orders.service';

const orderSummary: AdminOrderSummary = {
  id: 'o1',
  status: 'PAID',
  totalCents: 4998,
  itemCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'u1',
  userEmail: 'customer@example.com',
};

const order: AdminOrder = {
  id: 'o1',
  status: 'PAID',
  totalCents: 4998,
  items: [
    { productId: 'p1', productName: 'Widget', unitPriceCents: 1999, quantity: 2 },
    { productId: 'p2', productName: 'Gadget', unitPriceCents: 1000, quantity: 1 },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'u1',
  userEmail: 'customer@example.com',
};

describe('OrdersService', () => {
  let service: OrdersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrdersService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrdersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() sends page/limit/status as query params and returns the list envelope', () => {
    let result: ListResponse<AdminOrderSummary> | undefined;
    service.list({ page: 2, limit: 10, status: 'PAID' }).subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/api/v1/admin/orders' &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10' &&
        r.params.get('status') === 'PAID',
    );
    req.flush({
      data: [orderSummary],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    } satisfies ListResponse<AdminOrderSummary>);

    expect(result?.data).toEqual([orderSummary]);
  });

  it('list() omits the status param when no filter is given', () => {
    service.list({ page: 1, limit: 10 }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/v1/admin/orders' && r.params.get('status') === null,
    );
    req.flush({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    } satisfies ListResponse<AdminOrderSummary>);
  });

  it('getById() unwraps the single-response envelope, including line items', () => {
    let result: AdminOrder | undefined;
    service.getById('o1').subscribe((r) => (result = r));

    httpMock
      .expectOne('/api/v1/admin/orders/o1')
      .flush({ data: order } satisfies SingleResponse<AdminOrder>);

    expect(result).toEqual(order);
  });
});

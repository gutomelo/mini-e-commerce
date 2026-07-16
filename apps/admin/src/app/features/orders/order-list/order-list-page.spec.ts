import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import type { ListResponse } from '@mini-e-commerce/types';
import { of } from 'rxjs';

import { AdminOrderSummary, OrdersService } from '../orders.service';
import { OrderListPage } from './order-list-page';

const orderSummary: AdminOrderSummary = {
  id: 'order-123456789',
  status: 'PAID',
  totalCents: 4998,
  itemCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'u1',
  userEmail: 'customer@example.com',
};

function listResponse(orders: AdminOrderSummary[]): ListResponse<AdminOrderSummary> {
  return { data: orders, meta: { page: 1, limit: 10, total: orders.length, totalPages: 1 } };
}

describe('OrderListPage', () => {
  let fixture: ComponentFixture<OrderListPage>;
  let ordersService: { list: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ordersService = { list: vi.fn().mockReturnValue(of(listResponse([orderSummary]))) };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [OrderListPage, NoopAnimationsModule],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: Router, useValue: router },
      ],
    });

    fixture = TestBed.createComponent(OrderListPage);
  });

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders a row per order including the customer email, total, and status chip', () => {
    fixture.detectChanges();

    const text = textContent();
    expect(text).toContain('customer@example.com');
    expect(text).toContain('$49.98');
    expect(text).toContain('PAID');
  });

  it('renders no edit/delete/status-change controls (read-only feature)', () => {
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const actionButtons = Array.from(buttons).filter(
      (button) =>
        /delete|edit|cancel|status/i.test(button.textContent ?? '') ||
        /delete|edit|cancel|status/i.test(button.getAttribute('aria-label') ?? ''),
    );
    expect(actionButtons).toHaveLength(0);
  });

  it('navigates to the order detail route when a row is clicked', () => {
    fixture.detectChanges();

    const row: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector(
      'tr.data-table-row',
    )!;
    row.click();

    expect(router.navigate).toHaveBeenCalledWith(['/orders', 'order-123456789']);
  });

  it('re-fetches with the status query param when the status filter changes', () => {
    fixture.detectChanges();
    ordersService.list.mockClear();

    fixture.componentInstance['statusControl'].setValue('PAID');

    expect(ordersService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAID', page: 1 }),
    );
  });

  it('omits the status filter when "All" is selected', () => {
    fixture.componentInstance['statusControl'].setValue('PAID');
    fixture.detectChanges();
    ordersService.list.mockClear();

    fixture.componentInstance['statusControl'].setValue('ALL');

    expect(ordersService.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });
});

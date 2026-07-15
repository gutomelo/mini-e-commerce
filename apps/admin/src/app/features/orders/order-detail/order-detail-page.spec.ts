import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminOrder, OrdersService } from '../orders.service';
import { OrderDetailPage } from './order-detail-page';

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

function createFixture(ordersService: {
  getById: ReturnType<typeof vi.fn>;
}): ComponentFixture<OrderDetailPage> {
  TestBed.configureTestingModule({
    imports: [OrderDetailPage, NoopAnimationsModule],
    providers: [
      { provide: OrdersService, useValue: ordersService },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'o1' }) } },
      },
    ],
  });

  return TestBed.createComponent(OrderDetailPage);
}

describe('OrderDetailPage', () => {
  function textContent(fixture: ComponentFixture<OrderDetailPage>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders the order summary and line items for a found order', () => {
    const ordersService = { getById: vi.fn().mockReturnValue(of(order)) };
    const fixture = createFixture(ordersService);

    fixture.detectChanges();

    expect(ordersService.getById).toHaveBeenCalledWith('o1');
    const text = textContent(fixture);
    expect(text).toContain('customer@example.com');
    expect(text).toContain('PAID');
    expect(text).toContain('Widget');
    expect(text).toContain('Gadget');
    expect(text).toContain('$39.98'); // Widget subtotal: 2 * $19.99
    expect(text).toContain('$49.98'); // order total
  });

  it('shows a "not found" state for a 404 rather than a blank page', () => {
    const notFoundError = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    const ordersService = { getById: vi.fn().mockReturnValue(throwError(() => notFoundError)) };
    const fixture = createFixture(ordersService);

    fixture.detectChanges();

    const text = textContent(fixture);
    expect(text.toLowerCase()).toContain('not found');
  });

  it('shows a generic error state for a non-404 failure', () => {
    const serverError = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
    const ordersService = { getById: vi.fn().mockReturnValue(throwError(() => serverError)) };
    const fixture = createFixture(ordersService);

    fixture.detectChanges();

    const text = textContent(fixture);
    expect(text).toContain('Failed to load the order');
  });

  it('renders no status-change, edit, or delete controls (read-only feature)', () => {
    const ordersService = { getById: vi.fn().mockReturnValue(of(order)) };
    const fixture = createFixture(ordersService);

    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const actionButtons = Array.from(buttons).filter((button) =>
      /delete|edit|cancel|status/i.test(button.textContent ?? ''),
    );
    expect(actionButtons).toHaveLength(0);
  });
});

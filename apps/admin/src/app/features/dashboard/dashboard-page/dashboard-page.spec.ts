import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { ListResponse } from '@mini-e-commerce/types';
import { Subject, of, throwError } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';
import { DashboardPage } from './dashboard-page';

function listResponse(total: number): ListResponse<unknown> {
  return { data: [], meta: { page: 1, limit: 1, total, totalPages: total } };
}

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let apiClient: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiClient = { get: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DashboardPage, NoopAnimationsModule],
      providers: [{ provide: ApiClient, useValue: apiClient }],
    });

    fixture = TestBed.createComponent(DashboardPage);
  });

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function mockSuccessfulCalls(): void {
    apiClient.get.mockImplementation(
      (path: string, params?: Record<string, string | number | boolean>) => {
        if (path === '/products') {
          return of(listResponse(42));
        }
        if (path === '/categories') {
          return of(listResponse(7));
        }
        if (path === '/admin/orders') {
          switch (params?.['status']) {
            case 'PLACED':
              return of(listResponse(10));
            case 'PAID':
              return of(listResponse(80));
            case 'PAYMENT_FAILED':
              return of(listResponse(5));
            default:
              return of(listResponse(95));
          }
        }
        throw new Error(`unexpected ApiClient.get call: ${path}`);
      },
    );
  }

  it('shows a loading state while the stats calls are in flight', () => {
    apiClient.get.mockReturnValue(new Subject());

    fixture.detectChanges();

    expect(textContent()).toContain('Loading dashboard stats');
  });

  it("renders the counts derived from each call's meta.total once all calls resolve", () => {
    mockSuccessfulCalls();

    fixture.detectChanges();

    const text = textContent();
    expect(text).not.toContain('Loading dashboard stats');
    expect(text).toContain('42');
    expect(text).toContain('7');
    expect(text).toContain('95');
    expect(text).toContain('10');
    expect(text).toContain('80');
    expect(text).toContain('5');
  });

  it('shows a visible error state if any of the parallel calls fails', () => {
    apiClient.get.mockImplementation((path: string) => {
      if (path === '/products') {
        return throwError(() => new Error('network error'));
      }
      return of(listResponse(0));
    });

    fixture.detectChanges();

    const text = textContent();
    expect(text).not.toContain('Loading dashboard stats');
    expect(text).toContain('Failed to load dashboard stats');
  });

  it('retries the stats calls when the retry action is clicked', () => {
    apiClient.get.mockReturnValue(throwError(() => new Error('network error')));
    fixture.detectChanges();
    expect(textContent()).toContain('Failed to load dashboard stats');

    mockSuccessfulCalls();
    const retryButton: HTMLButtonElement = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    )!;
    retryButton.click();
    fixture.detectChanges();

    expect(textContent()).toContain('42');
  });
});

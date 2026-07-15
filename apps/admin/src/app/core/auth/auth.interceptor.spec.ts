import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches the Authorization header when an access token is present', () => {
    (authService as unknown as { accessToken: string | null }).accessToken = 'token-1';

    http.get('/api/v1/products').subscribe();

    const req = httpMock.expectOne('/api/v1/products');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
    req.flush({});
  });

  it('does not attach the Authorization header for the login endpoint', () => {
    (authService as unknown as { accessToken: string | null }).accessToken = 'token-1';

    http.post('/api/v1/auth/login', { email: 'a@b.com', password: 'pw' }).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('retries a 401 once with a refreshed token and succeeds', () => {
    (authService as unknown as { accessToken: string | null }).accessToken = 'expired-token';
    localStorage.setItem('admin_refresh_token', 'refresh-1');

    let result: unknown;
    http.get('/api/v1/products').subscribe((res) => {
      result = res;
    });

    const firstReq = httpMock.expectOne('/api/v1/products');
    firstReq.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    refreshReq.flush({ data: { accessToken: 'new-token', refreshToken: 'new-refresh' } });

    const retriedReq = httpMock.expectOne('/api/v1/products');
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retriedReq.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('propagates the original 401 error when the refresh call also fails', () => {
    (authService as unknown as { accessToken: string | null }).accessToken = 'expired-token';
    localStorage.setItem('admin_refresh_token', 'refresh-1');

    let capturedError: unknown;
    http.get('/api/v1/products').subscribe({
      error: (err: unknown) => {
        capturedError = err;
      },
    });

    const firstReq = httpMock.expectOne('/api/v1/products');
    firstReq.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    refreshReq.flush(
      { message: 'invalid refresh token' },
      { status: 401, statusText: 'Unauthorized' },
    );

    httpMock.expectNone('/api/v1/auth/refresh');

    expect(capturedError).toBeTruthy();
    expect((capturedError as { status: number }).status).toBe(401);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SingleResponse } from '@mini-e-commerce/types';

import { AuthService, TokenPair, User } from './auth.service';

const REFRESH_TOKEN_STORAGE_KEY = 'admin_refresh_token';

const tokens: TokenPair = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const user: User = { id: 'u1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' };

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('login stores tokens and populates the user profile', () => {
    let resolved = false;
    service.login('admin@example.com', 'password').subscribe(() => {
      resolved = true;
    });

    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush({ data: tokens } satisfies SingleResponse<TokenPair>);

    const meReq = httpMock.expectOne('/api/v1/users/me');
    expect(meReq.request.method).toBe('GET');
    meReq.flush({ data: user } satisfies SingleResponse<User>);

    expect(resolved).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(user);
    expect(service.getAccessToken()).toBe(tokens.accessToken);
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe(tokens.refreshToken);
  });

  it('logout clears local state and fires a best-effort revoke call', () => {
    service.login('admin@example.com', 'password').subscribe();
    httpMock
      .expectOne('/api/v1/auth/login')
      .flush({ data: tokens } satisfies SingleResponse<TokenPair>);
    httpMock.expectOne('/api/v1/users/me').flush({ data: user } satisfies SingleResponse<User>);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();

    const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
    expect(logoutReq.request.method).toBe('POST');
    expect(logoutReq.request.headers.get('Authorization')).toBe(`Bearer ${tokens.accessToken}`);
    logoutReq.flush(null);
  });

  it('bootstrap resolves without HTTP calls when no refresh token is stored', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        service.bootstrap().subscribe({ next: () => resolve(), error: reject });
      }),
    ).resolves.toBeUndefined();

    expect(service.isAuthenticated()).toBe(false);
    httpMock.expectNone('/api/v1/auth/refresh');
    httpMock.expectNone('/api/v1/users/me');
  });

  it('bootstrap restores the session when the refresh token is valid', () => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stored-refresh');

    let completed = false;
    service.bootstrap().subscribe(() => {
      completed = true;
    });

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    expect(refreshReq.request.body).toEqual({ refreshToken: 'stored-refresh' });
    refreshReq.flush({ data: tokens } satisfies SingleResponse<TokenPair>);

    httpMock.expectOne('/api/v1/users/me').flush({ data: user } satisfies SingleResponse<User>);

    expect(completed).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(user);
  });

  it('bootstrap resolves to a logged-out state when the refresh call fails', () => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, 'stale-refresh');

    let completed = false;
    let errored = false;
    service.bootstrap().subscribe({
      next: () => {
        completed = true;
      },
      error: () => {
        errored = true;
      },
    });

    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    refreshReq.flush(
      { message: 'invalid refresh token' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(completed).toBe(true);
    expect(errored).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });
});

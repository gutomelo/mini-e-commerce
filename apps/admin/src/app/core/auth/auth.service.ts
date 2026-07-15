import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { SingleResponse } from '@mini-e-commerce/types';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

/** Authenticated user profile, as returned by `GET /api/v1/users/me`. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
}

/** Access/refresh token pair returned by the login and refresh endpoints. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * localStorage key for the persisted refresh token. See the comment on
 * `refreshToken` storage below for the accepted-risk rationale.
 */
const REFRESH_TOKEN_STORAGE_KEY = 'admin_refresh_token';

/**
 * Central authentication state and session lifecycle for the admin SPA.
 *
 * Token storage strategy:
 * - Access token: kept in memory only (`this.accessToken`), never persisted.
 *   It is lost on a full page reload, which is fine because `bootstrap()`
 *   (invoked from an app initializer) re-derives it from the refresh token.
 * - Refresh token: persisted in `localStorage` under `admin_refresh_token`.
 *   This is a deliberate, documented trade-off: this SPA architecture has no
 *   first-party backend that can set an HttpOnly cookie for the admin app
 *   (the NestJS gateway is a separate origin/service consumed purely as a
 *   JSON API), so there is no cookie-based storage option available here.
 *   Storing the refresh token in localStorage carries a theoretical
 *   XSS-exfiltration risk; this is accepted for this internal admin panel
 *   and is not appropriate for a public-facing, higher-risk application.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');

  private accessToken: string | null = null;

  /** Returns the current in-memory access token, or `null` if logged out. */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** Logs in with email/password, stores the resulting tokens, then loads the user profile. */
  login(email: string, password: string): Observable<void> {
    return this.http
      .post<SingleResponse<TokenPair>>('/api/v1/auth/login', { email, password })
      .pipe(
        tap(({ data }) => this.storeTokens(data)),
        switchMap(() => this.loadCurrentUser()),
        map(() => void 0),
      );
  }

  /**
   * Logs out the current session. Best-effort: the server call is fired to
   * revoke the refresh token, but local state is always cleared regardless
   * of whether that call succeeds.
   */
  logout(): void {
    const refreshToken = this.getStoredRefreshToken();
    const accessToken = this.accessToken;

    this.clearSession();

    if (refreshToken && accessToken) {
      this.http
        .post<void>(
          '/api/v1/auth/logout',
          { refreshToken },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        .pipe(catchError(() => of(void 0)))
        .subscribe();
    }
  }

  /**
   * Restores a session on app startup from the persisted refresh token.
   * Never throws: any failure (missing token, network error, 401, malformed
   * response) resolves to a logged-out state so the app initializer can
   * always proceed to render.
   */
  bootstrap(): Observable<void> {
    if (!this.getStoredRefreshToken()) {
      return of(void 0);
    }

    return this.refreshSession().pipe(
      switchMap(() => this.loadCurrentUser()),
      map(() => void 0),
      catchError(() => {
        this.clearSession();
        return of(void 0);
      }),
    );
  }

  /**
   * Exchanges the stored refresh token for a new token pair, rotating both
   * the in-memory access token and the persisted refresh token. Used by
   * `bootstrap()` and by the auth interceptor's retry-once-on-401 logic.
   */
  refreshSession(): Observable<TokenPair> {
    const refreshToken = this.getStoredRefreshToken();
    return this.http.post<SingleResponse<TokenPair>>('/api/v1/auth/refresh', { refreshToken }).pipe(
      map(({ data }) => data),
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  private loadCurrentUser(): Observable<User> {
    return this.http.get<SingleResponse<User>>('/api/v1/users/me').pipe(
      map(({ data }) => data),
      tap((user) => this._user.set(user)),
    );
  }

  private storeTokens(tokens: TokenPair): void {
    this.accessToken = tokens.accessToken;
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
  }

  private getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  }

  private clearSession(): void {
    this.accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    this._user.set(null);
  }
}

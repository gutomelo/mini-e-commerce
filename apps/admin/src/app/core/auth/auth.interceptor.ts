import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/** Endpoints that never need (and must never trigger) token attachment or refresh. */
const AUTH_ENDPOINTS = ['/api/v1/auth/login', '/api/v1/auth/refresh'];

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

/**
 * Attaches the current access token to outgoing requests and transparently
 * retries once on a `401`, using the refresh token to obtain a new access
 * token. Login/refresh requests are skipped entirely to avoid recursion.
 *
 * On a second (post-refresh) `401`, or if the refresh call itself fails, the
 * ORIGINAL 401 error is propagated to the caller — this interceptor never
 * navigates; that decision belongs to guards/consuming code.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  const accessToken = authService.getAccessToken();
  const authorizedReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap((tokens) => {
          const retriedReq = req.clone({
            setHeaders: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          return next(retriedReq);
        }),
        catchError(() => throwError(() => error)),
      );
    }),
  );
};

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Base path prefixed to every request made through `ApiClient`.
 *
 * In production (Docker Compose), the admin app is served same-origin
 * behind the nginx reverse proxy, so relative `/api/v1/...` paths resolve
 * correctly. For local `ng serve` development, requests would need either a
 * `proxy.conf.json` or a `CORS_ORIGINS`-based direct call to `apps/api` —
 * that dev-proxy wiring is out of scope for this task.
 */
const API_BASE_PATH = '/api/v1';

function toHttpParams(params?: Record<string, string | number | boolean>): HttpParams {
  let httpParams = new HttpParams();
  if (!params) {
    return httpParams;
  }
  for (const [key, value] of Object.entries(params)) {
    httpParams = httpParams.set(key, value);
  }
  return httpParams;
}

/**
 * Thin `HttpClient` wrapper shared by feature services.
 *
 * Ergonomic choice: methods return the full response envelope
 * (`SingleResponse<T>` / `ListResponse<T>` from `@mini-e-commerce/types`) as
 * `T` rather than unwrapping `.data` here, since some callers also need
 * `.meta` (pagination) from list responses. Callers are expected to
 * destructure `.data` / `.meta` themselves. Keep this convention consistent
 * across later feature services built on top of `ApiClient`.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http.get<T>(`${API_BASE_PATH}${path}`, { params: toHttpParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_BASE_PATH}${path}`, body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${API_BASE_PATH}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${API_BASE_PATH}${path}`);
  }
}

/**
 * Shared REST API contracts: response envelopes returned by the NestJS gateway
 * and consumed by the storefront and admin frontends.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId: string;
  timestamp: string;
  path: string;
}

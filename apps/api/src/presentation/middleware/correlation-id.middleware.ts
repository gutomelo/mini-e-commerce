import { newCorrelationId } from '@mini-e-commerce/shared';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

declare module 'express' {
  interface Request {
    correlationId: string;
  }
}

/**
 * Reads the inbound `x-correlation-id` header (or generates one via
 * `@mini-e-commerce/shared`) and:
 * - attaches it to `req.correlationId` so downstream code (the logger, the
 *   global exception filter) can access it,
 * - echoes it back on the response so callers can correlate their own logs.
 *
 * This is registered with `app.use()` in `main.ts` rather than through a
 * Nest `NestModule.configure()` middleware. Nest binds module-scoped
 * middleware (including nestjs-pino's request logger) during application
 * init, which runs after any `app.use()` calls made in `main.ts` — so
 * wiring it this way guarantees this middleware executes first and every
 * other component (logger included) observes the same correlation id.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_ID_HEADER);
  const correlationId = incoming && incoming.trim().length > 0 ? incoming : newCorrelationId();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
}

import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { newCorrelationId } from '@mini-e-commerce/shared';
import type { Request } from 'express';
import { CORRELATION_ID_HEADER } from '../../presentation/middleware/correlation-id.middleware';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.accessToken',
  'req.headers.cookie',
];

/**
 * Structured JSON request logging (nestjs-pino). Every log line carries the
 * request correlation id (read from `x-correlation-id` or generated), and
 * sensitive headers/body fields are redacted so secrets never reach logs.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: REDACT_PATHS,
          censor: '[REDACTED]',
        },
        genReqId: (req: Request) => {
          const existing =
            req.correlationId ?? (req.headers[CORRELATION_ID_HEADER] as string | undefined);
          return existing && existing.trim().length > 0 ? existing : newCorrelationId();
        },
        customProps: (req: Request) => ({
          correlationId: req.id,
        }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true },
              },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}

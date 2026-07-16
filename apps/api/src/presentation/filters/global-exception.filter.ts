import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../../domain/errors';
import type { ErrorResponse } from '../contracts';

/**
 * Centralized exception handler. Every uncaught error in the application
 * flows through here and comes out as the standardized `ErrorResponse`
 * envelope. Stack traces are logged server-side only, never returned to the
 * client.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.correlationId ?? 'unknown';

    const { statusCode, error, message } = this.resolve(exception);

    const body: ErrorResponse = {
      statusCode,
      error,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logError(exception, body);

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): {
    statusCode: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.httpStatus,
        error: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const message = this.extractMessage(payload, exception.message);

      return {
        statusCode,
        error: HttpStatus[statusCode] ?? exception.name,
        message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private extractMessage(payload: unknown, fallback: string): string | string[] {
    if (typeof payload === 'string') {
      return payload;
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = payload.message;
      if (typeof message === 'string' || Array.isArray(message)) {
        return message;
      }
    }

    return fallback;
  }

  private logError(exception: unknown, body: ErrorResponse): void {
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (body.statusCode >= 500) {
      this.logger.error(
        `[${body.correlationId}] ${body.statusCode} ${body.path} - ${JSON.stringify(body.message)}`,
        stack,
      );
    } else {
      this.logger.warn(
        `[${body.correlationId}] ${body.statusCode} ${body.path} - ${JSON.stringify(body.message)}`,
      );
    }
  }
}

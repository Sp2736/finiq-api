import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { toSafeMessage } from '../utils/safe-error';

/**
 * Global exception filter for consistent error responses
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred. Please try again.';
    let error: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error;
      } else {
        message = exceptionResponse as string;
      }
    } else {
      // For raw errors (e.g. Postgres drivers, TypeErrors), NEVER expose the raw message/stack to the client
      message = toSafeMessage(exception);
    }

    // Always log the FULL error server-side
    const logMsg = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`[${request.method} ${request.url}] ${logMsg}`, stack);

    response.status(status).json({
      success: false,
      message,
      // error is intentionally omitted to prevent leaking stack traces or internal names
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

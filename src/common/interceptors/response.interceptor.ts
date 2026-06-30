import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ResponseFormatter } from '../utils/response.formatter';

/**
 * Response transformation interceptor - Wraps all responses in consistent format
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - startTime;
        const response = context.switchToHttp().getResponse();

        // Add timing header for monitoring
        if (!response.headersSent) {
          response.header('X-Response-Time', `${duration}ms`);
        }

        // If already formatted, return as is
        if (data?.success !== undefined) {
          return data;
        }

        // Format response
        return ResponseFormatter.success(data, 'Success');
      }),
      catchError((error) => {
        throw error;
      }),
    );
  }
}

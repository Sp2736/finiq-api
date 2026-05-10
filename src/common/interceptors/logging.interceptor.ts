import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logging interceptor - Logs all HTTP requests and responses
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;

    const startTime = Date.now();
    const reqLog = {
      method,
      url,
      body: body && Object.keys(body).length > 0 ? body : undefined,
      query: Object.keys(query).length > 0 ? query : undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(`→ Incoming Request: ${method} ${url}`, reqLog);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        this.logger.debug(`← Response: ${method} ${url} [${duration}ms]`, {
          statusCode: context.switchToHttp().getResponse().statusCode,
          duration: `${duration}ms`,
        });
      }),
    );
  }
}

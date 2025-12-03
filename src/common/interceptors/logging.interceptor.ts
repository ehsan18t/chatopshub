import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
// biome-ignore lint/nursery/noDeprecatedImports: tap operator is not deprecated, this is a false positive
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, body } = request;
    const now = Date.now();

    // Log request
    this.logger.log(`→ ${method} ${url} ${JSON.stringify(body)}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          this.logger.log(`← ${method} ${url} ${response.statusCode} ${duration}ms`);
        },
        error: (error: Error) => {
          const duration = Date.now() - now;
          this.logger.error(`← ${method} ${url} ERROR ${duration}ms - ${error.message}`);
        },
      }),
    );
  }
}

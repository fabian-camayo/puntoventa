import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

/**
 * Captura IP y User-Agent de cada petición y los deja disponibles vía AsyncLocalStorage
 * para que `AuditService.log()` los adjunte automáticamente sin que cada módulo tenga
 * que reenviarlos manualmente. Se registra globalmente en AppModule.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    RequestContext.run(
      {
        ipAddress: this.extractIp(req),
        userAgent: req.headers['user-agent'],
      },
      () => next(),
    );
  }

  private extractIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]!.trim();
    }
    return req.ip;
  }
}

import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from './request-context';

/**
 * Établit le contexte de requête (AsyncLocalStorage) le plus tôt possible
 * dans le pipeline — avant les Guards, donc avant que JwtAuthGuard ne
 * détermine `onBehalfOfId`. Le store est un objet MUTABLE : ce middleware
 * pose juste la valeur par défaut (null), JwtAuthGuard la modifie ensuite en
 * place (jamais un nouvel appel à `.run()`, qui écraserait le contexte pour
 * le reste de la requête) — voir request-context.ts.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = randomUUID();
    res.setHeader('X-Trace-Id', traceId);
    const reauth = req.headers['x-reauth'];
    requestContextStorage.run({ onBehalfOfId: null, traceId, userId: null, reauth: typeof reauth === 'string' && reauth ? reauth : null }, next);
  }
}

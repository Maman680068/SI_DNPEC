import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTraceId, requestContextStorage } from '../request-context/request-context';

/** Préfixe des routes suivant les conventions d'API NIMBA (cahier, Partie 0 §11.4). */
export const PREFIXE_API_V1 = '/api/v1/';

/** Codes métier stables de l'enveloppe d'erreur NIMBA (indépendants du libellé). */
const CODE_PAR_STATUT: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'REQUETE_INVALIDE',
  [HttpStatus.UNAUTHORIZED]: 'AUTH_REQUISE',
  [HttpStatus.FORBIDDEN]: 'DROIT_INSUFFISANT',
  [HttpStatus.NOT_FOUND]: 'INTROUVABLE',
  [HttpStatus.CONFLICT]: 'CONFLIT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'REGLE_METIER',
};

type CorpsErreur = { message?: string | string[]; code?: string; etape?: string; details?: unknown; objetType?: string; objetId?: string };

/**
 * Uniformise les erreurs HTTP de l'API :
 * - routes historiques : forme inchangée `{ statusCode, message, ... }` ;
 * - routes /api/v1 (conventions NIMBA) : enveloppe `{ code, message, details, trace_id }` ;
 * - tout 403, ancien ou nouveau, est journalisé dans `acces_refuses` (§5.5 :
 *   « tout refus est journalisé »), sans jamais retarder ni faire échouer la réponse.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AccesRefuses');

  constructor(private readonly prisma?: PrismaService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const corps: CorpsErreur = typeof body === 'string' ? { message: body } : (body as CorpsErreur);

    // Une réauthentification demandée n'est pas un refus (l'accès suivra la preuve d'identité).
    if (status === HttpStatus.FORBIDDEN && corps.code !== 'REAUTH_REQUISE') this.journaliserRefus(request, corps);

    if (request.originalUrl?.startsWith(PREFIXE_API_V1)) {
      const messages = Array.isArray(corps.message) ? corps.message : corps.message ? [corps.message] : [];
      response.status(status).json({
        code: corps.code ?? CODE_PAR_STATUT[status] ?? (status >= 500 ? 'ERREUR_INTERNE' : 'ERREUR'),
        message: messages.join(', ') || exception.message,
        details: corps.details ?? (messages.length > 1 ? messages : null),
        trace_id: getTraceId(),
      });
      return;
    }

    // Forme historique inchangée (les champs internes du refus ne sortent pas).
    const { etape: _etape, objetType: _t, objetId: _i, ...reste } = corps;
    response
      .status(status)
      .json(typeof body === 'string' ? { statusCode: status, message: body } : { statusCode: status, ...reste });
  }

  private journaliserRefus(request: Request, corps: CorpsErreur): void {
    if (!this.prisma) return;
    const store = requestContextStorage.getStore();
    const message = Array.isArray(corps.message) ? corps.message.join(', ') : corps.message ?? 'Accès refusé';
    this.prisma.accesRefuse
      .create({
        data: {
          userId: store?.userId ?? null,
          interimForId: store?.onBehalfOfId ?? null,
          methode: request.method,
          route: ((request.originalUrl ?? request.url).split('?')[0] ?? '').slice(0, 300),
          objetType: corps.objetType ?? null,
          objetId: corps.objetId ?? null,
          etape: corps.etape ?? 'AUTRE',
          motif: message.slice(0, 500),
          traceId: store?.traceId ?? null,
        },
      })
      .catch((e: unknown) => this.logger.error(`Refus non journalisé : ${e instanceof Error ? e.message : String(e)}`));
  }
}

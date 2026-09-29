import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  /** Titulaire au nom de qui la requête courante agit (suppléance/intérim,
   * §4.10) — null pour l'immense majorité des requêtes. Posé une seule fois,
   * par mutation de l'objet du store (jamais par un nouvel appel à `run`),
   * par JwtAuthGuard une fois l'en-tête X-Interim-For validé. Lu par
   * AuditService.log() pour tamponner AuditLog.onBehalfOfId automatiquement,
   * sans qu'aucun des dizaines de sites d'appel existants n'ait à le savoir. */
  onBehalfOfId: string | null;
  /** Identifiant de la requête (conventions d'API NIMBA, §11.4) : renvoyé dans
   * l'en-tête X-Trace-Id, l'enveloppe d'erreur des routes /api/v1 et le
   * journal des refus d'accès. */
  traceId: string;
  /** Compte connecté (posé par JwtAuthGuard) — lu par le journal des refus. */
  userId: string | null;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function getOnBehalfOfId(): string | null {
  return requestContextStorage.getStore()?.onBehalfOfId ?? null;
}

export function getTraceId(): string | null {
  return requestContextStorage.getStore()?.traceId ?? null;
}

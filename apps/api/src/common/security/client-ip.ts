import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/** Adresse du client et confiance qu'on peut lui accorder pour le verrouillage par IP.
 *
 * Revue de sécurité 2026-10 : la connexion passe par le serveur du web (pour poser le cookie du
 * jeton de renouvellement) ; vue de l'API, toutes ces requêtes viennent alors de la même adresse.
 * Le web transmet l'adresse réelle dans `X-Client-IP`, accompagnée du secret partagé
 * `WEB_PROXY_SECRET` (même valeur sur l'API et le web) :
 *  - secret valide : l'adresse transmise est retenue et fiable ;
 *  - en-tête présent sans secret valide : requête relayée qu'on ne peut pas attribuer — l'adresse
 *    vue (celle du web) est journalisée mais ne sert pas au verrouillage, qui verrouillerait
 *    sinon tout le monde (le verrouillage par compte, lui, s'applique toujours) ;
 *  - appel direct (sans en-tête) : l'adresse vue derrière le proxy de Render, fiable. */
export function adresseClient(req: Request): { ip: string; fiable: boolean } {
  const vue = req.ip ?? 'unknown';
  const transmise = req.headers['x-client-ip'];
  if (transmise === undefined) return { ip: vue, fiable: true };
  const secret = process.env.WEB_PROXY_SECRET ?? '';
  const recu = String(req.headers['x-proxy-secret'] ?? '');
  const ok = secret.length >= 16 && recu.length === secret.length && timingSafeEqual(Buffer.from(recu), Buffer.from(secret));
  const ip = String(Array.isArray(transmise) ? transmise[0] : transmise).trim().slice(0, 64);
  return ok && ip ? { ip, fiable: true } : { ip: vue, fiable: false };
}

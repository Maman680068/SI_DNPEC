import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface AttemptRecord {
  count: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Verrouillage temporaire après échecs de connexion répétés sur
 * POST /auth/login et POST /auth/login/2fa, par compte ET par IP,
 * indépendamment : un attaquant qui change d'IP reste bloqué par compte ;
 * un attaquant qui essaie plusieurs comptes depuis la même IP reste
 * bloqué par IP.
 *
 * Stockage en mémoire (Map, local au process) — choix délibéré plutôt que
 * @nestjs/throttler (dont la dernière version, 6.5.0, ne déclare de
 * compatibilité peer qu'avec NestJS ^11, alors que ce projet est sur
 * NestJS 12) ou une table Prisma dédiée : ce compteur est éphémère par
 * nature (fenêtre de 15 min) et cible le déploiement mono-instance actuel
 * (Render, cf. cahier des charges §7.2/§7.8).
 *
 * ⚠️ LIMITE CONNUE — à revoir en Vague 2 : ce stockage est propre à chaque
 * process. Il est réinitialisé à chaque redémarrage/déploiement, et surtout
 * il ne serait plus correct si l'API tourne un jour sur plusieurs instances
 * (scaling horizontal) — chaque instance aurait ses propres compteurs,
 * multipliant de fait le nombre d'essais autorisés. Passer alors à un store
 * partagé entre instances (Redis typiquement) avant toute réplication.
 */
@Injectable()
export class LoginAttemptService {
  private readonly accountAttempts = new Map<string, AttemptRecord>();
  private readonly ipAttempts = new Map<string, AttemptRecord>();
  // Quotas des autres routes publiques (revue de sécurité 2026-10) : mot de passe oublié,
  // inscription. Clé → nombre d'appels dans la fenêtre en cours.
  private readonly quotas = new Map<string, { count: number; debut: number; fenetre: number }>();
  private dernierNettoyage = Date.now();

  /** Compte un appel ; au-delà de `max` dans la fenêtre, 429 avec le message donné. */
  consommer(cle: string, max: number, fenetreMs: number, message: string): void {
    this.nettoyer();
    const now = Date.now();
    const q = this.quotas.get(cle);
    if (!q || now - q.debut > q.fenetre) {
      this.quotas.set(cle, { count: 1, debut: now, fenetre: fenetreMs });
      return;
    }
    q.count += 1;
    if (q.count > max) throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Purge des entrées expirées (au plus toutes les 10 min) : les tables en mémoire ne grossissent
   * pas sans fin quand on essaie des adresses ou des comptes toujours différents. */
  private nettoyer(): void {
    const now = Date.now();
    if (now - this.dernierNettoyage < 10 * 60_000) return;
    this.dernierNettoyage = now;
    for (const store of [this.accountAttempts, this.ipAttempts]) {
      for (const [k, r] of store) if ((r.lockedUntil ?? 0) < now && now - r.firstFailureAt > WINDOW_MS) store.delete(k);
    }
    for (const [k, q] of this.quotas) if (now - q.debut > q.fenetre) this.quotas.delete(k);
  }

  // `ip` à null : adresse non attribuable (connexion relayée par le web sans secret partagé, voir
  // common/security/client-ip.ts) — seul le verrouillage par compte s'applique.
  assertNotLocked(email: string, ip: string | null): void {
    this.assertKeyNotLocked(this.accountAttempts, email.toLowerCase(), 'compte');
    if (ip) this.assertKeyNotLocked(this.ipAttempts, ip, 'adresse IP');
  }

  recordFailure(email: string, ip: string | null): void {
    this.registerFailure(this.accountAttempts, email.toLowerCase());
    if (ip) this.registerFailure(this.ipAttempts, ip);
  }

  recordSuccess(email: string, ip: string | null): void {
    this.accountAttempts.delete(email.toLowerCase());
    if (ip) this.ipAttempts.delete(ip);
  }

  private assertKeyNotLocked(store: Map<string, AttemptRecord>, key: string, label: string): void {
    const record = store.get(key);
    if (!record?.lockedUntil) return;

    const now = Date.now();
    if (record.lockedUntil > now) {
      const minutesLeft = Math.ceil((record.lockedUntil - now) / 60_000);
      throw new HttpException(
        `Trop de tentatives échouées pour ce ${label}. Réessayez dans ${minutesLeft} min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Verrou expiré : on repart d'un compteur propre.
    store.delete(key);
  }

  private registerFailure(store: Map<string, AttemptRecord>, key: string): void {
    this.nettoyer();
    const now = Date.now();
    const record = store.get(key);

    if (!record || now - record.firstFailureAt > WINDOW_MS) {
      store.set(key, { count: 1, firstFailureAt: now, lockedUntil: null });
      return;
    }

    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCK_DURATION_MS;
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseUniteKey } from './unites';

/** Variables autorisées dans un gabarit de numéro. */
const TOKEN = /\{(seq(?::(\d))?|code|annee|unite)\}/g;
const ANY_TOKEN = /\{[^}]*\}/g;

export interface NumeroAttribue {
  annee: number;
  sequence: number;
  numero: string;
}

/**
 * Numérotation séquentielle des registres de courrier — aucun trou, aucun
 * doublon, même sous accès concurrent :
 *
 * - `attribuer` s'exécute DANS la transaction interactive de l'écriture
 *   métier (enregistrement d'une arrivée, signature d'un acte) : l'upsert
 *   `INSERT ... ON CONFLICT DO UPDATE SET dernier = dernier + 1 RETURNING`
 *   pose un verrou de ligne sur le compteur (registre, unité, année) qui
 *   sérialise les transactions concurrentes jusqu'à leur fin ; un rollback
 *   annule l'incrément avec tout le reste (pas de trou).
 * - La contrainte unique (registre, unité, année, séquence) des tables
 *   d'entrées reste le filet de sécurité.
 * - Le numéro formaté est FIGÉ à l'attribution (colonne `numero`, protégée
 *   par trigger) : changer le gabarit ne réécrit jamais l'historique.
 * - L'année vient de l'horloge du serveur, jamais du client.
 */
@Injectable()
export class NumerotationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Refuse un gabarit sans {seq} ou contenant une variable inconnue. */
  validerGabarit(gabarit: string): void {
    const inconnues = (gabarit.match(ANY_TOKEN) ?? []).filter((t) => !t.match(new RegExp(`^${TOKEN.source}$`)));
    if (inconnues.length > 0) {
      throw new BadRequestException(
        `Variables inconnues dans le gabarit : ${inconnues.join(', ')} (autorisées : {seq}, {seq:n}, {code}, {annee}, {unite}).`,
      );
    }
    if (!/\{seq(?::\d)?\}/.test(gabarit)) {
      throw new BadRequestException('Le gabarit doit contenir la séquence {seq} ou {seq:n}.');
    }
  }

  formater(gabarit: string, v: { sequence: number; code: string; annee: number; unite: string }): string {
    return gabarit.replace(TOKEN, (_all, name: string, pad?: string) => {
      if (name.startsWith('seq')) return String(v.sequence).padStart(pad ? Number(pad) : 1, '0');
      if (name === 'code') return v.code;
      if (name === 'annee') return String(v.annee);
      return v.unite;
    });
  }

  /** Code affiché de l'unité ({unite}) — à résoudre AVANT la transaction. */
  async codeUnite(uniteKey: string): Promise<string> {
    const ref = parseUniteKey(uniteKey);
    if (ref.kind === 'DIRECTION') return 'DNPEC';
    if (ref.kind === 'DIVISION') {
      const d = await this.prisma.division.findUnique({ where: { id: ref.divisionId }, select: { code: true } });
      if (!d) throw new NotFoundException('Division introuvable');
      return d.code;
    }
    const c = await this.prisma.cellule.findUnique({ where: { id: ref.celluleId }, select: { code: true } });
    if (!c) throw new NotFoundException('Cellule introuvable');
    return c.code;
  }

  /**
   * Aperçu du prochain numéro (S7, S9c) : lu dans le compteur, SANS le consommer — le numéro réel n'est
   * attribué qu'à la signature ou à l'enregistrement (`attribuer`).
   */
  async apercu(registre: { id: string; code: string; gabaritNumero: string }, uniteKey: string, uniteCode: string, maintenant = new Date()) {
    const annee = maintenant.getFullYear();
    const c = await this.prisma.compteurRegistre.findUnique({ where: { registreId_uniteKey_annee: { registreId: registre.id, uniteKey, annee } }, select: { dernier: true } });
    const sequence = (c?.dernier ?? 0) + 1;
    return { annee, sequence, numero: this.formater(registre.gabaritNumero, { sequence, code: registre.code, annee, unite: uniteCode }), utilises: c?.dernier ?? 0 };
  }

  /** Attribue le prochain numéro — à appeler UNIQUEMENT dans une transaction. */
  async attribuer(
    tx: Prisma.TransactionClient,
    registre: { id: string; code: string; gabaritNumero: string },
    uniteKey: string,
    uniteCode: string,
  ): Promise<NumeroAttribue> {
    const annee = new Date().getFullYear();
    const rows = await tx.$queryRaw<{ dernier: number }[]>`
      INSERT INTO "compteurs_registre" ("registreId", "uniteKey", "annee", "dernier", "updatedAt")
      VALUES (${registre.id}, ${uniteKey}, ${annee}, 1, now())
      ON CONFLICT ("registreId", "uniteKey", "annee")
      DO UPDATE SET "dernier" = "compteurs_registre"."dernier" + 1, "updatedAt" = now()
      RETURNING "dernier"`;
    const sequence = Number(rows[0]!.dernier);
    return {
      annee,
      sequence,
      numero: this.formater(registre.gabaritNumero, { sequence, code: registre.code, annee, unite: uniteCode }),
    };
  }
}

/** Options des transactions de numérotation : délai explicite (le verrou du
 * compteur peut faire patienter une transaction derrière une autre). */
export const TRANSACTION_NUMEROTATION = { maxWait: 10_000, timeout: 20_000 } as const;

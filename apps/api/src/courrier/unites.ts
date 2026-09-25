import { BadRequestException } from '@nestjs/common';
import { RegistrePortee } from '@prisma/client';

/**
 * Unité d'un registre (voir schema.prisma, module Courrier) : "DNPEC" pour la
 * portée DIRECTION, "DIV:<divisionId>" ou "CEL:<celluleId>" pour la portée
 * UNITE. Clé texte non nulle — elle entre dans la clé primaire des compteurs.
 */
export const UNITE_DIRECTION = 'DNPEC';

export type UniteRef =
  | { kind: 'DIRECTION' }
  | { kind: 'DIVISION'; divisionId: string }
  | { kind: 'CELLULE'; celluleId: string };

export function parseUniteKey(key: string): UniteRef {
  if (key === UNITE_DIRECTION) return { kind: 'DIRECTION' };
  const [prefix, id] = key.split(':');
  if (prefix === 'DIV' && id) return { kind: 'DIVISION', divisionId: id };
  if (prefix === 'CEL' && id) return { kind: 'CELLULE', celluleId: id };
  throw new BadRequestException(`Unité invalide : ${key}`);
}

export function divisionKey(divisionId: string): string {
  return `DIV:${divisionId}`;
}

export function celluleKey(celluleId: string): string {
  return `CEL:${celluleId}`;
}

/** L'unité est-elle compatible avec la portée du registre ? */
export function assertUnitePourPortee(portee: RegistrePortee, key: string): UniteRef {
  if (!key) throw new BadRequestException('Une unité (Division ou Cellule) est obligatoire pour un registre de portée Unité.');
  const ref = parseUniteKey(key);
  if (portee === RegistrePortee.DIRECTION && ref.kind !== 'DIRECTION') {
    throw new BadRequestException('Un registre de portée Direction n’a qu’une unité : DNPEC.');
  }
  if (portee === RegistrePortee.UNITE && ref.kind === 'DIRECTION') {
    throw new BadRequestException('Un registre de portée Unité exige une Division ou une Cellule.');
  }
  return ref;
}

/** Une personne (rattachement réel) appartient-elle à l'unité ? */
export function estMembreUnite(
  user: { divisionId: string | null; celluleId: string | null },
  key: string,
): boolean {
  const ref = parseUniteKey(key);
  if (ref.kind === 'DIRECTION') return true;
  if (ref.kind === 'DIVISION') return user.divisionId === ref.divisionId;
  return user.celluleId === ref.celluleId;
}

/** Unité (portée UNITE) d'une personne selon son rattachement : sa Division
 * (même pour un agent de section) ou sa Cellule ; null si elle n'en a aucune
 * (DN, DNA, Assistant...). */
export function uniteDe(user: { divisionId: string | null; celluleId: string | null }): string | null {
  if (user.divisionId) return divisionKey(user.divisionId);
  if (user.celluleId) return celluleKey(user.celluleId);
  return null;
}

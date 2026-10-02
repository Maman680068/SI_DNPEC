import { Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Rattachement {
  id: string;
  supervisorId?: string | null;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/**
 * Chef(s) le(s) plus proche(s) d'un agent : supérieur désigné (assistant), puis chef de la cellule ou
 * de la section, puis chef de la division, enfin DN ou DNA. Le premier niveau pourvu d'un compte actif
 * (autre que l'agent) répond ; les niveaux au-dessus non. Sert à l'avis sur un congé (N3) et à l'alerte
 * de retard d'une tâche (N5).
 */
export async function chefsLesPlusProches(prisma: PrismaService | Prisma.TransactionClient, cible: Rattachement): Promise<string[]> {
  const niveaux: Prisma.UserWhereInput[] = [];
  if (cible.supervisorId) niveaux.push({ id: cible.supervisorId });
  if (cible.celluleId) niveaux.push({ role: SystemRole.CHEF_CELLULE, celluleId: cible.celluleId });
  if (cible.divisionId && cible.sectionId) niveaux.push({ role: SystemRole.CHEF_SECTION, divisionId: cible.divisionId, sectionId: cible.sectionId });
  if (cible.divisionId) niveaux.push({ role: SystemRole.CHEF_DIVISION, divisionId: cible.divisionId });
  niveaux.push({ role: { in: [SystemRole.DN, SystemRole.DNA] } });
  for (const niveau of niveaux) {
    const ids = (await prisma.user.findMany({ where: { AND: [niveau, { status: UserStatus.ACTIF, id: { not: cible.id } }] }, select: { id: true } })).map((u) => u.id);
    if (ids.length) return ids;
  }
  return [];
}

/** Résultats partagés par les lignes d'une même liste (une requête par niveau, et non par ligne). */
export type MemoChefs = Map<string, Promise<string[]>>;

/**
 * Même règle que `chefsLesPlusProches`, pour une liste (performance 2026-10) : les comptes actifs de
 * chaque niveau sont lus une fois, puis le demandeur est écarté en mémoire. Le résultat est identique.
 */
export async function chefsLesPlusProchesMemo(prisma: PrismaService | Prisma.TransactionClient, cible: Rattachement, memo: MemoChefs): Promise<string[]> {
  const niveaux: [string, Prisma.UserWhereInput][] = [];
  if (cible.supervisorId) niveaux.push([`sup:${cible.supervisorId}`, { id: cible.supervisorId }]);
  if (cible.celluleId) niveaux.push([`cel:${cible.celluleId}`, { role: SystemRole.CHEF_CELLULE, celluleId: cible.celluleId }]);
  if (cible.divisionId && cible.sectionId) niveaux.push([`sec:${cible.divisionId}:${cible.sectionId}`, { role: SystemRole.CHEF_SECTION, divisionId: cible.divisionId, sectionId: cible.sectionId }]);
  if (cible.divisionId) niveaux.push([`div:${cible.divisionId}`, { role: SystemRole.CHEF_DIVISION, divisionId: cible.divisionId }]);
  niveaux.push(['dir', { role: { in: [SystemRole.DN, SystemRole.DNA] } }]);
  for (const [cle, niveau] of niveaux) {
    if (!memo.has(cle)) memo.set(cle, prisma.user.findMany({ where: { AND: [niveau, { status: UserStatus.ACTIF }] }, select: { id: true } }).then((us) => us.map((u) => u.id)));
    const ids = (await memo.get(cle)!).filter((id) => id !== cible.id);
    if (ids.length) return ids;
  }
  return [];
}

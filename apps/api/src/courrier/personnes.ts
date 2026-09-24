import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Champs d'affichage d'une personne citée par un courrier (imputant, imputé,
 * viseur, signataire...) — jamais d'email, de supervisorId ni de champ sensible. */
export const PERSONNE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  jobTitle: true,
} satisfies Prisma.UserSelect;

export type Personne = Prisma.UserGetPayload<{ select: typeof PERSONNE_SELECT }>;

/** Charge en une requête les personnes citées par plusieurs courriers. */
export async function chargerPersonnes(prisma: PrismaService, ids: Iterable<string | null | undefined>): Promise<Map<string, Personne>> {
  const uniques = [...new Set([...ids].filter((id): id is string => !!id))];
  if (uniques.length === 0) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: uniques } }, select: PERSONNE_SELECT });
  return new Map(rows.map((p) => [p.id, p]));
}

/** Sous-ensemble des personnes citées par UN courrier projeté. */
export function personnesCitees(annuaire: Map<string, Personne>, ids: Iterable<string | null | undefined>): Record<string, Personne> {
  const out: Record<string, Personne> = {};
  for (const id of ids) {
    const p = id ? annuaire.get(id) : undefined;
    if (p) out[p.id] = p;
  }
  return out;
}

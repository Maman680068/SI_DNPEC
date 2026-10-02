import { Prisma, PrismaClient, SystemRole, UserStatus } from '@prisma/client';
import { ROLE_LIBELLE } from './roles';

/** Postes de responsabilité qu'un acte de nomination peut porter (droits appliqués par l'administrateur). */
export const POSTES_RESPONSABILITE: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE];

export interface UnitePoste {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/** Titulaire actif d'un poste (autre que `exclureId`), ou null s'il est vacant. */
export async function titulaireDuPoste(db: PrismaClient | Prisma.TransactionClient, role: SystemRole, u: UnitePoste, exclureId: string) {
  const where: Prisma.UserWhereInput = { role, status: UserStatus.ACTIF, id: { not: exclureId } };
  if (role === SystemRole.CHEF_DIVISION) where.divisionId = u.divisionId;
  else if (role === SystemRole.CHEF_SECTION) where.sectionId = u.sectionId;
  else if (role === SystemRole.CHEF_CELLULE) where.celluleId = u.celluleId;
  else if (role !== SystemRole.DN && role !== SystemRole.DNA) return null;
  return db.user.findFirst({ where, select: { id: true, firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true } });
}

/**
 * Rôle proposé à l'actuel titulaire d'un poste de chef : Chargé d'Études dans la même unité.
 * Pour le DN et la DNA, aucune proposition : l'administrateur choisit.
 */
export function propositionPourAncienTitulaire(role: SystemRole, u: UnitePoste): (UnitePoste & { role: SystemRole }) | null {
  if (role === SystemRole.CHEF_DIVISION) return { role: SystemRole.AGENT, divisionId: u.divisionId, sectionId: null, celluleId: null };
  if (role === SystemRole.CHEF_SECTION) return { role: SystemRole.AGENT, divisionId: u.divisionId, sectionId: u.sectionId, celluleId: null };
  if (role === SystemRole.CHEF_CELLULE) return { role: SystemRole.AGENT, divisionId: null, sectionId: null, celluleId: u.celluleId };
  return null;
}

const LIBELLE_POSTE: Partial<Record<SystemRole, string>> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_DIVISION: 'Chef de Division',
  CHEF_SECTION: 'Chef de Section',
  CHEF_CELLULE: 'Chef de Cellule',
};

export interface Poste extends UnitePoste {
  /** Clé stable du poste dans la liste (rôle et unité). */
  cle: string;
  role: SystemRole;
  /** Intitulé de la fonction écrit au dossier par l'acte de nomination. */
  fonction: string;
  titulaire: string | null;
}

/**
 * Postes de responsabilité proposés au DRH pour une nomination : DN, DNA, chef de chaque division
 * active, de chaque section de ces divisions, de chaque cellule active. Le rôle, l'unité et
 * l'intitulé de la fonction découlent du poste choisi.
 */
export async function listePostes(db: PrismaClient | Prisma.TransactionClient): Promise<Poste[]> {
  const [divisions, sections, cellules, chefs] = await Promise.all([
    db.division.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.section.findMany({ where: { division: { isActive: true } }, select: { id: true, name: true, divisionId: true, division: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    db.cellule.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { status: UserStatus.ACTIF, role: { in: POSTES_RESPONSABILITE } }, select: { firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true } }),
  ]);
  const titulaire = (role: SystemRole, u: UnitePoste) => {
    const c = chefs.find((x) => x.role === role && (role === SystemRole.DN || role === SystemRole.DNA || (role === SystemRole.CHEF_DIVISION ? x.divisionId === u.divisionId : role === SystemRole.CHEF_SECTION ? x.sectionId === u.sectionId : x.celluleId === u.celluleId)));
    return c ? `${c.firstName} ${c.lastName}` : null;
  };
  const poste = (role: SystemRole, u: UnitePoste, unite: string | null): Poste => ({
    cle: `${role}:${u.sectionId ?? u.divisionId ?? u.celluleId ?? ''}`,
    role,
    ...u,
    fonction: unite ? `${LIBELLE_POSTE[role]} — ${unite}` : LIBELLE_POSTE[role]!,
    titulaire: titulaire(role, u),
  });
  const vide = { divisionId: null, sectionId: null, celluleId: null };
  return [
    poste(SystemRole.DN, vide, null),
    poste(SystemRole.DNA, vide, null),
    ...divisions.map((d) => poste(SystemRole.CHEF_DIVISION, { ...vide, divisionId: d.id }, d.name)),
    ...sections.map((s) => poste(SystemRole.CHEF_SECTION, { ...vide, divisionId: s.divisionId, sectionId: s.id }, `${s.name} (${s.division.name})`)),
    ...cellules.map((c) => poste(SystemRole.CHEF_CELLULE, { ...vide, celluleId: c.id }, c.name)),
  ];
}

/** Intitulé de fonction d'un poste (null si le poste n'existe pas ou plus). */
export async function fonctionDuPoste(db: PrismaClient | Prisma.TransactionClient, role: SystemRole, u: UnitePoste): Promise<string | null> {
  const p = (await listePostes(db)).find((x) => x.role === role && x.divisionId === u.divisionId && x.sectionId === u.sectionId && x.celluleId === u.celluleId);
  return p?.fonction ?? null;
}

/**
 * Intitulé de fonction pour un rôle et un rattachement : celui du poste pour un poste de
 * responsabilité, sinon « <rôle> — <unité> » (ex. « Chargé d’Études — Section SSR (Division Prévisions) »).
 */
export async function fonctionPourRole(db: PrismaClient | Prisma.TransactionClient, role: SystemRole, u: UnitePoste): Promise<string> {
  if (POSTES_RESPONSABILITE.includes(role)) {
    const f = await fonctionDuPoste(db, role, u);
    if (f) return f;
  }
  let unite: string | null = null;
  if (u.sectionId) {
    const s = await db.section.findUnique({ where: { id: u.sectionId }, select: { name: true, division: { select: { name: true } } } });
    unite = s ? `${s.name} (${s.division.name})` : null;
  } else if (u.divisionId) unite = (await db.division.findUnique({ where: { id: u.divisionId }, select: { name: true } }))?.name ?? null;
  else if (u.celluleId) unite = (await db.cellule.findUnique({ where: { id: u.celluleId }, select: { name: true } }))?.name ?? null;
  return unite ? `${ROLE_LIBELLE[role]} — ${unite}` : ROLE_LIBELLE[role];
}

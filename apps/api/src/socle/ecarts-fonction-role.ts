import { Prisma, PrismaClient, StatutChangementRole, SystemRole, UserStatus } from '@prisma/client';

const CHEFS_ET_DIRECTION: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE];
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ');

/**
 * Rôle qu'une fonction du dossier appelle (« Chef de la division … » → Chef de Division), ou null
 * quand la fonction ne désigne aucun poste de responsabilité. « Chargé d'études » → AGENT.
 * Un adjoint (« Adjoint au chef de division ») n'occupe pas le poste.
 */
export function roleAppelePar(fonction: string | null | undefined): SystemRole | null {
  if (!fonction) return null;
  const f = sansAccents(fonction);
  if (/\badjointe? (au|du|de la|a la) (chef|direct)/.test(f)) return null;
  if (/\bdirect(eur|rice) nationale? adjointe?\b/.test(f) || /^dna\b/.test(f)) return SystemRole.DNA;
  if (/\bdirect(eur|rice) nationale?\b/.test(f) || /^dn\b/.test(f)) return SystemRole.DN;
  if (/\bchef (de |du )?(la )?division\b/.test(f)) return SystemRole.CHEF_DIVISION;
  if (/\bchef (de |du )?(la )?section\b/.test(f)) return SystemRole.CHEF_SECTION;
  if (/\bchef (de |du )?(la )?cellule\b/.test(f)) return SystemRole.CHEF_CELLULE;
  if (/\bchargee? d ?etudes\b/.test(f)) return SystemRole.AGENT;
  return null;
}

export interface EcartFonctionRole {
  userId: string;
  nom: string;
  role: SystemRole;
  fonction: string | null;
  motif: string;
  /** Qui agit : l'administrateur (rôle du compte) ou le DRH (fonction du dossier, par un acte). */
  suite: string;
  changementId: string | null;
}

/**
 * Écarts entre la fonction du dossier et le rôle du compte (nomination, option A) :
 * - changement de rôle issu d'un acte de nomination signé, encore en attente de l'administrateur ;
 * - fonction d'un poste de responsabilité (DN, DNA, chefs) sur un compte qui n'a pas ce rôle ;
 * - compte de chef ou de la Direction dont la fonction du dossier est « Chargé d'études ».
 * Calculé à la lecture (supervision, écran des nominations, tâche quotidienne), jamais stocké.
 */
export async function ecartsFonctionRole(prisma: PrismaClient | Prisma.TransactionClient): Promise<EcartFonctionRole[]> {
  const [comptes, attentes] = await Promise.all([
    prisma.user.findMany({
      where: { status: UserStatus.ACTIF, role: { notIn: [SystemRole.STAGIAIRE] } },
      select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true, agent: { select: { fonction: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.changementRoleNomination.findMany({ where: { statut: StatutChangementRole.EN_ATTENTE }, select: { id: true, userId: true, acteNumero: true } }),
  ]);
  const enAttente = new Map(attentes.map((a) => [a.userId, a]));
  const res: EcartFonctionRole[] = [];
  for (const u of comptes) {
    const fonction = u.agent?.fonction ?? u.jobTitle ?? null;
    const base = { userId: u.id, nom: `${u.firstName} ${u.lastName}`, role: u.role, fonction };
    const a = enAttente.get(u.id);
    if (a) {
      res.push({ ...base, motif: `Acte de nomination n° ${a.acteNumero} signé : changement de rôle en attente`, suite: 'Administrateur : confirmer ou refuser la nomination', changementId: a.id });
      continue;
    }
    const attendu = roleAppelePar(fonction);
    if (attendu && attendu !== SystemRole.AGENT && attendu !== u.role) {
      res.push({ ...base, motif: 'La fonction du dossier désigne un poste de responsabilité que le rôle du compte ne porte pas', suite: 'Administrateur : changer le rôle, ou DRH : corriger la fonction par un acte de nomination', changementId: null });
    } else if (attendu === SystemRole.AGENT && CHEFS_ET_DIRECTION.includes(u.role)) {
      res.push({ ...base, motif: 'Compte de responsable dont la fonction du dossier est « Chargé d’études »', suite: 'DRH : acte de nomination, ou administrateur : changer le rôle', changementId: null });
    }
  }
  return res;
}

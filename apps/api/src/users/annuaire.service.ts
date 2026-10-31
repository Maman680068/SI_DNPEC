import { Injectable, NotFoundException } from '@nestjs/common';
import { ActeStatut, LeaveRequestStatus, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { motsRecherche, scoreRecherche } from '../common/recherche/texte';
import { chefsLesPlusProches } from '../socle/chefs-proches';
import { ROLE_LIBELLE } from '../role-change/roles';
import { CascadeService } from '../org/cascade/cascade.service';

const PERSONNE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  role: true,
  supervisorId: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
  division: { select: { code: true, name: true } },
  section: { select: { code: true, name: true } },
  cellule: { select: { code: true, name: true, chefId: true } },
} satisfies Prisma.UserSelect;
type Personne = Prisma.UserGetPayload<{ select: typeof PERSONNE_SELECT }>;

export type EtatDuJour = 'EN_CONGE' | 'EN_MISSION' | null;

const debutJour = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Annuaire repensé (S4, docs/conception_S4_annuaire.md) : tout le personnel actif, groupé par unité (Direction,
 * divisions avec leurs sections, cellules), le chef ou le DN et la DNA en tête ; état du jour calculé à partir
 * de l'existant, SANS motif ni type de congé : « En congé » (congé approuvé couvrant aujourd'hui, maladie
 * comprise), « En mission » (ordre de mission signé couvrant aujourd'hui), « supplée X » (suppléance active) ;
 * recherche par le moteur de S2. Pas d'email ni de téléphone (inchangé).
 */
@Injectable()
export class AnnuaireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cascade: CascadeService,
  ) {}

  private fonction(p: Pick<Personne, 'jobTitle' | 'role'>): string {
    return p.jobTitle?.trim() || ROLE_LIBELLE[p.role];
  }

  /** États du jour de tout le personnel (congé, mission) et suppléances en cours. */
  private async etats(maintenant: Date) {
    const j0 = debutJour(maintenant);
    const j1 = new Date(j0.getTime() + 864e5);
    const [conges, missions, suppleances] = await Promise.all([
      this.prisma.leaveRequest.findMany({ where: { status: LeaveRequestStatus.APPROUVEE, startDate: { lt: j1 }, endDate: { gte: j0 } }, select: { userId: true } }),
      this.prisma.ordreMission.findMany({ where: { dateDepart: { lte: j0 }, dateRetour: { gte: j0 }, acte: { statut: { in: [ActeStatut.SIGNE, ActeStatut.EXPEDIE] } } }, select: { agentId: true } }),
      this.prisma.suppleance.findMany({
        where: { revokedAt: null, startDate: { lte: maintenant }, endDate: { gt: maintenant } },
        select: { suppleantId: true, titulaireId: true, titulaire: { select: { firstName: true, lastName: true } }, suppleant: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const etat = new Map<string, EtatDuJour>();
    for (const m of missions) etat.set(m.agentId, 'EN_MISSION');
    // Un congé approuvé l'emporte : « En congé », sans motif ni type (maladie comprise).
    for (const c of conges) etat.set(c.userId, 'EN_CONGE');
    const supplee = new Map<string, string>();
    const suppleant = new Map<string, string>();
    for (const s of suppleances) {
      supplee.set(s.suppleantId, `${s.titulaire.firstName} ${s.titulaire.lastName}`);
      suppleant.set(s.titulaireId, `${s.suppleant.firstName} ${s.suppleant.lastName}`);
    }
    return { etat, supplee, suppleant };
  }

  async annuaire(actor: AuthenticatedUser, q: string | undefined, maintenant = new Date()) {
    const [personnes, { etat, supplee }] = await Promise.all([
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIF }, select: PERSONNE_SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.etats(maintenant),
    ]);
    const [divisions, cellules] = await Promise.all([
      this.prisma.division.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, _count: { select: { sections: true } } }, orderBy: { code: 'asc' } }),
      this.prisma.cellule.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, chefId: true }, orderBy: { code: 'asc' } }),
    ]);
    const bloc = (p: Personne) => (p.divisionId ? `division:${p.divisionId}` : p.celluleId ? `cellule:${p.celluleId}` : 'direction');
    const chefDe = (p: Personne): string | null => {
      if (p.role === SystemRole.DN) return 'DN';
      if (p.role === SystemRole.DNA) return 'DNA';
      if (p.role === SystemRole.CHEF_DIVISION && p.divisionId) return 'Chef de division';
      if (p.celluleId && p.cellule?.chefId === p.id) return 'Chef de cellule';
      return null;
    };
    const ordreChef = (p: Personne) => (p.role === SystemRole.DN ? 0 : p.role === SystemRole.DNA ? 1 : chefDe(p) ? 2 : 3);
    const vue = (p: Personne) => ({
      id: p.id,
      prenom: p.firstName,
      nom: p.lastName,
      fonction: this.fonction(p),
      section: p.section?.name ?? null,
      sigle: p.section?.code ?? p.cellule?.code ?? p.division?.code ?? (p.role === SystemRole.DN || p.role === SystemRole.DNA ? 'DN' : null),
      bloc: bloc(p),
      badge: chefDe(p),
      etat: etat.get(p.id) ?? null,
      supplee: supplee.get(p.id) ?? null,
    });
    const tous = personnes.map(vue);
    const membres = (cle: string) =>
      personnes
        .filter((p) => bloc(p) === cle)
        .sort((a, b) => ordreChef(a) - ordreChef(b) || a.lastName.localeCompare(b.lastName, 'fr'))
        .map((p) => p.id);
    const chefNom = (ids: string[]) => {
      const c = personnes.find((p) => ids.includes(p.id) && chefDe(p) && chefDe(p) !== 'DNA');
      return c ? `${c.firstName} ${c.lastName}` : null;
    };
    const unites = [
      { id: 'direction', sigle: 'DN', libelle: 'Direction nationale', type: 'DIRECTION' },
      ...divisions.map((d) => ({ id: `division:${d.id}`, sigle: d.code, libelle: d.name, type: 'DIVISION' })),
      ...cellules.map((c) => ({ id: `cellule:${c.id}`, sigle: c.code, libelle: c.name, type: 'CELLULE' })),
    ].map((u) => {
      const ids = membres(u.id);
      return { ...u, chef: chefNom(ids), nombre: ids.length, membres: ids };
    });
    // Recherche (moteur de S2) : nom, fonction, unité, sigle — sans accents ; débuts de mot en premier.
    const mots = motsRecherche(q ?? '');
    const resultats = mots.length
      ? personnes
          .map((p) => ({ id: p.id, s: scoreRecherche(mots, [p.firstName, p.lastName, this.fonction(p), p.section?.code, p.division?.code, p.cellule?.code, p.section?.name, p.division?.name, p.cellule?.name]) }))
          .filter((x): x is { id: string; s: number } => x.s !== null)
          .sort((a, b) => a.s - b.s)
          .map((x) => x.id)
      : null;
    const absents = tous.filter((p) => p.etat).length;
    return { disponibles: tous.length - absents, total: tous.length, personnes: tous, unites, resultats };
  }

  /** Fiche d'une personne : unité complète, « rend compte à », suppléant en cours, équipe. */
  async fiche(actor: AuthenticatedUser, id: string, maintenant = new Date()) {
    const p = await this.prisma.user.findFirst({ where: { id, status: UserStatus.ACTIF }, select: PERSONNE_SELECT });
    if (!p) throw new NotFoundException('Personne introuvable');
    const [chefs, { etat, supplee, suppleant }] = await Promise.all([chefsLesPlusProches(this.prisma, p), this.etats(maintenant)]);
    const noms = new Map((await this.prisma.user.findMany({ where: { id: { in: chefs } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const equipe = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF, id: { not: p.id }, ...(p.sectionId ? { sectionId: p.sectionId } : p.divisionId ? { divisionId: p.divisionId } : p.celluleId ? { celluleId: p.celluleId } : { divisionId: null, celluleId: null }) },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 40,
    });
    const unite =
      p.role === SystemRole.DN || p.role === SystemRole.DNA
        ? 'Direction nationale'
        : [p.section?.name, p.division?.name ?? p.cellule?.name].filter(Boolean).join(' · ') || 'Direction nationale';
    return {
      id: p.id,
      prenom: p.firstName,
      nom: p.lastName,
      fonction: this.fonction(p),
      unite,
      rendCompteA: chefs.map((c) => noms.get(c)).filter(Boolean),
      suppleant: suppleant.get(p.id) ?? null,
      supplee: supplee.get(p.id) ?? null,
      etat: etat.get(p.id) ?? null,
      equipe: equipe.map((e) => ({ id: e.id, nom: `${e.firstName} ${e.lastName}` })),
      peutEcrire: p.id !== actor.id,
      // Assignation d'une tâche depuis la fiche : seulement avec une autorité hiérarchique (droit de l'API).
      peutAssigner: p.id !== actor.id && this.cascade.hasDirectAuthorityOver(actor, p),
    };
  }
}

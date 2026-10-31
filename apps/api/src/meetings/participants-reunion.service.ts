import { ForbiddenException, Injectable } from '@nestjs/common';
import { SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { RecherchePersonnesService } from '../users/recherche-personnes.service';

/**
 * Sélecteur de participants d'une réunion (S1, demande et création) : personnes actives SANS les
 * stagiaires (ils n'ont pas accès aux réunions : l'API les refuserait) et unités de la DNPEC (organigramme
 * du socle, unités ouvertes) avec leurs membres, sous-unités comprises. L'écran déplie une unité en
 * personnes au moment du choix : la liste est figée à la création.
 */
@Injectable()
export class ParticipantsReunionService {
  constructor(private readonly prisma: PrismaService) {}

  async possibles(actor: AuthenticatedUser) {
    if (actor.role === SystemRole.STAGIAIRE) throw new ForbiddenException('Les réunions ne sont pas ouvertes aux stagiaires.');
    const [personnes, unites] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          role: true,
          divisionId: true,
          sectionId: true,
          celluleId: true,
          division: { select: { code: true, name: true } },
          section: { select: { code: true, name: true } },
          cellule: { select: { code: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.uniteOrganisationnelle.findMany({
        where: { dateFermeture: null },
        select: { id: true, code: true, libelle: true, type: true, parentId: true, divisionId: true, sectionId: true, celluleId: true },
        orderBy: [{ type: 'asc' }, { code: 'asc' }],
      }),
    ]);
    // Unité « feuille » de chaque personne : sa section, sinon sa division ou sa cellule, sinon la Direction.
    const parSection = new Map(unites.filter((u) => u.sectionId).map((u) => [u.sectionId!, u.id]));
    const parDivision = new Map(unites.filter((u) => u.divisionId).map((u) => [u.divisionId!, u.id]));
    const parCellule = new Map(unites.filter((u) => u.celluleId).map((u) => [u.celluleId!, u.id]));
    const racine = unites.find((u) => u.type === 'DIRECTION' && !u.parentId) ?? unites.find((u) => u.type === 'DIRECTION');
    const feuille = (p: (typeof personnes)[number]) =>
      (p.sectionId && parSection.get(p.sectionId)) || (p.divisionId && parDivision.get(p.divisionId)) || (p.celluleId && parCellule.get(p.celluleId)) || racine?.id || null;
    const parent = new Map(unites.map((u) => [u.id, u.parentId]));
    const membres = new Map<string, string[]>(unites.map((u) => [u.id, []]));
    for (const p of personnes) {
      // La personne compte dans son unité et dans toutes celles qui la contiennent.
      for (let u = feuille(p); u; u = parent.get(u) ?? null) membres.get(u)?.push(p.id);
    }
    const profondeur = (id: string): number => {
      let n = 0;
      for (let u = parent.get(id); u; u = parent.get(u)) n++;
      return n;
    };
    return {
      personnes: personnes
        .filter((p) => p.id !== actor.id)
        .map((p) => ({ id: p.id, nom: `${p.firstName} ${p.lastName}`, fonction: p.jobTitle, unite: RecherchePersonnesService.sigle(p) })),
      unites: unites
        .map((u) => ({ id: u.id, code: u.code, libelle: u.libelle, type: u.type, niveau: profondeur(u.id), membres: (membres.get(u.id) ?? []).filter((m) => m !== actor.id) }))
        .filter((u) => u.membres.length > 0),
    };
  }

  /** Participants valides d'une demande ou d'une réunion : comptes actifs, jamais un stagiaire. */
  async verifier(ids: string[]): Promise<string | null> {
    if (!ids.length) return null;
    const l = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { status: true, role: true } });
    if (l.length !== ids.length || l.some((u) => u.status !== UserStatus.ACTIF)) return 'Un ou plusieurs participants n’ont pas de compte actif.';
    if (l.some((u) => u.role === SystemRole.STAGIAIRE)) return 'Un stagiaire n’a pas accès aux réunions : il ne peut pas y être invité.';
    return null;
  }
}

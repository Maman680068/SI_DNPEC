import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, LeaveRequestStatus, RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { attributionActiveWhere, estDrh } from '../socle/roles-fonctionnels';

export const RATTACHEMENTS = ['DN', 'DNA'] as const;
export const NATURES_CELLULE = ['CELLULE', 'SERVICE', 'INSTANCE'] as const;
const LIBELLE_NATURE: Record<string, string> = { CELLULE: 'Cellule', SERVICE: 'Service', INSTANCE: 'Instance' };
/** Rôles tenus par les agents d'une cellule, affichés sur sa carte. */
const ROLES_AFFICHES: Partial<Record<RoleFonctionnel, string>> = {
  [RoleFonctionnel.DRH]: 'Rôle DRH',
  [RoleFonctionnel.GESTIONNAIRE_LOGISTIQUE]: 'Logistique',
  [RoleFonctionnel.AGENT_COURRIER]: 'Courrier',
};
const nom = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
const initiales = (u: { firstName: string; lastName: string }) => `${u.firstName.replace(/^TEST\s*[—–-]\s*/i, '').charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();

/**
 * Organisation (S8, docs/conception_S8_organisation.md) : vue calculée pour les trois onglets — organigramme en
 * schéma (DN, DNA, cellules rattachées sur le côté, divisions et sections), Divisions & Sections, Cellules.
 * Tout le monde consulte ; l'administrateur et le DRH agissent (droits renvoyés par l'API : structure et
 * désignation des chefs = administrateur, comme aujourd'hui ; rattachement et nature d'une cellule =
 * administrateur ou DRH). Les congés du jour ne donnent qu'un nombre, jamais un motif.
 */
@Injectable()
export class OrganisationVueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private droits(actor: AuthenticatedUser) {
    const admin = actor.role === SystemRole.ADMIN_SYSTEME;
    return { structure: admin, designerChef: admin, rattachement: admin || estDrh(actor) };
  }

  async vue(actor: AuthenticatedUser, maintenant = new Date()) {
    const j0 = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
    const [personnes, divisions, sections, cellules, conges, suppleances, roles] = await Promise.all([
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIF }, select: { id: true, firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true } }),
      this.prisma.division.findMany({ select: { id: true, code: true, name: true, isActive: true }, orderBy: { code: 'asc' } }),
      this.prisma.section.findMany({ select: { id: true, code: true, name: true, isActive: true, divisionId: true }, orderBy: { code: 'asc' } }),
      this.prisma.cellule.findMany({ select: { id: true, code: true, name: true, isActive: true, chefId: true, rattachement: true, nature: true }, orderBy: { code: 'asc' } }),
      this.prisma.leaveRequest.findMany({ where: { status: LeaveRequestStatus.APPROUVEE, startDate: { lt: new Date(j0.getTime() + 864e5) }, endDate: { gte: j0 } }, select: { userId: true } }),
      this.prisma.suppleance.findMany({ where: { revokedAt: null, startDate: { lte: maintenant }, endDate: { gt: maintenant } }, select: { titulaireId: true, suppleant: { select: { firstName: true, lastName: true } } } }),
      this.prisma.attributionRole.findMany({ where: attributionActiveWhere(maintenant), select: { userId: true, role: true } }),
    ]);
    const enConge = new Set(conges.map((c) => c.userId));
    const suppleantDe = new Map(suppleances.map((s) => [s.titulaireId, nom(s.suppleant)]));
    const parId = new Map(personnes.map((p) => [p.id, p]));
    const chefVue = (id: string | null | undefined) => {
      const p = id ? parId.get(id) : undefined;
      return p ? { id: p.id, nom: nom(p), suppleant: suppleantDe.get(p.id) ?? null } : null;
    };
    const dn = personnes.find((p) => p.role === SystemRole.DN);
    const dna = personnes.find((p) => p.role === SystemRole.DNA);
    // « Chargés d'études auprès du DN » : agents rattachés directement à la Direction (ni division ni cellule).
    const aupresDn = personnes.filter((p) => !p.divisionId && !p.celluleId && ![SystemRole.DN, SystemRole.DNA, SystemRole.STAGIAIRE].includes(p.role as never) && p.role !== SystemRole.ADMIN_SYSTEME && !p.supervisorId);
    const vueDivisions = divisions.map((d) => {
      const membres = personnes.filter((p) => p.divisionId === d.id);
      const chef = membres.find((p) => p.role === SystemRole.CHEF_DIVISION);
      const secs = sections
        .filter((s) => s.divisionId === d.id)
        .map((s) => {
          const ms = membres.filter((p) => p.sectionId === s.id);
          const cs = ms.find((p) => p.role === SystemRole.CHEF_SECTION);
          const etat = ms.length === 0 ? 'SANS_AGENT' : cs ? 'COMPLETE' : 'CHEF_A_DESIGNER';
          return { id: s.id, code: s.code, nom: s.name, actif: s.isActive, chef: chefVue(cs?.id), agents: ms.length, etat, equipe: ms.map((p) => ({ id: p.id, nom: nom(p), initiales: initiales(p) })) };
        });
      const sansSection = membres.filter((p) => !p.sectionId && p.role !== SystemRole.CHEF_DIVISION);
      const actives = secs.filter((s) => s.actif);
      return {
        id: d.id,
        code: d.code,
        nom: d.name,
        actif: d.isActive,
        chef: chefVue(chef?.id),
        agents: membres.length,
        enConge: membres.filter((p) => enConge.has(p.id)).length,
        sectionsActives: actives.length,
        sectionsSansChef: actives.filter((s) => !s.chef).length,
        agentsSansSection: sansSection.map((p) => ({ id: p.id, nom: nom(p) })),
        chefsDesignes: (chef ? 1 : 0) + actives.filter((s) => s.chef).length,
        postesChef: 1 + actives.length,
        sections: secs,
        equipe: membres.map((p) => ({ id: p.id, nom: nom(p), initiales: initiales(p) })),
      };
    });
    const vueCellules = cellules.map((c) => {
      const membres = personnes.filter((p) => p.celluleId === c.id);
      const ids = new Set(membres.map((p) => p.id));
      const tenus = [...new Set(roles.filter((r) => ids.has(r.userId) && ROLES_AFFICHES[r.role]).map((r) => ROLES_AFFICHES[r.role]!))];
      if (membres.some((p) => p.role === SystemRole.ADMIN_SYSTEME)) tenus.push('Administration du SI');
      return {
        id: c.id,
        code: c.code,
        nom: c.name,
        actif: c.isActive,
        nature: c.nature,
        libelleNature: LIBELLE_NATURE[c.nature] ?? c.nature,
        rattachement: c.rattachement,
        chef: chefVue(c.chefId),
        agents: membres.length,
        enConge: membres.filter((p) => enConge.has(p.id)).length,
        // Le CNC réunit des membres d'autres institutions : pas « 0 agent ».
        membresExternes: c.nature === 'INSTANCE' && membres.length === 0,
        roles: tenus.sort(),
        equipe: membres.map((p) => ({ id: p.id, nom: nom(p), initiales: initiales(p) })),
      };
    });
    return {
      direction: {
        dn: dn ? { id: dn.id, nom: nom(dn), suppleant: suppleantDe.get(dn.id) ?? null } : null,
        dna: dna ? { id: dna.id, nom: nom(dna), suppleant: suppleantDe.get(dna.id) ?? null } : null,
        chargesAupresDn: aupresDn.map((p) => ({ id: p.id, nom: nom(p), initiales: initiales(p) })),
      },
      divisions: vueDivisions,
      cellules: vueCellules,
      chiffres: {
        unites: vueDivisions.length + vueDivisions.reduce((n, d) => n + d.sections.length, 0) + vueCellules.length,
        sansResponsable: vueDivisions.filter((d) => d.actif && !d.chef).length + vueDivisions.reduce((n, d) => n + d.sections.filter((s) => s.actif && !s.chef).length, 0) + vueCellules.filter((c) => c.actif && !c.chef).length,
      },
      droits: this.droits(actor),
    };
  }

  /** Rattachement (DN ou DNA) et nature d'une cellule : administrateur ou DRH, audité. */
  async modifierCellule(actor: AuthenticatedUser, id: string, dto: { rattachement?: string; nature?: string }) {
    if (!this.droits(actor).rattachement) throw new ForbiddenException('Le rattachement des cellules est tenu par l’administrateur et le DRH.');
    if (dto.rattachement && !(RATTACHEMENTS as readonly string[]).includes(dto.rattachement)) throw new BadRequestException('Rattachement : DN ou DNA.');
    if (dto.nature && !(NATURES_CELLULE as readonly string[]).includes(dto.nature)) throw new BadRequestException('Nature : cellule, service ou instance.');
    const avant = await this.prisma.cellule.findUnique({ where: { id }, select: { rattachement: true, nature: true } });
    if (!avant) throw new NotFoundException('Cellule introuvable');
    await this.prisma.cellule.update({ where: { id }, data: { rattachement: dto.rattachement, nature: dto.nature } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Cellule', entityId: id, metadata: { event: 'rattachement', avant, apres: { rattachement: dto.rattachement ?? avant.rattachement, nature: dto.nature ?? avant.nature } } });
    return this.vue(actor);
  }
}

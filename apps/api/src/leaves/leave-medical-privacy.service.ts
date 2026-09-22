import { Injectable } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';

type OrgTarget = {
  id: string;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

type ChiefCandidate = {
  id: string;
  role: SystemRole;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

/** Seul type de congé actuellement soumis à l'exception "besoin d'en connaître" —
 * les types sont en table (extensibles sans migration, voir LeaveTypesService), donc
 * si un jour un autre type doit être protégé, ce sera un champ sur LeaveType plutôt
 * qu'une liste de codes en dur ici. */
export const SENSITIVE_LEAVE_TYPE_CODE = 'CONGE_MALADIE';

export const MASKED_LEAVE_TYPE_LABEL = 'Absence — motif protégé';

/**
 * Exception "besoin d'en connaître" pour les congés maladie : DN/DNA gardent
 * l'AUTORITÉ de validation en cascade sur toute demande (§3.1, inchangé — voir
 * CascadeService.hasDirectAuthorityOver), mais n'ont le DROIT DE VOIR le type/motif
 * réel d'une absence pour maladie que lorsqu'ils sont le validateur RÉEL de cette
 * demande précise, c'est-à-dire qu'aucun chef plus proche (Division/Section/Cellule
 * du demandeur) n'existe pour la traiter. Dans tous les autres cas, DN/DNA restent de
 * simples superviseurs en cascade sur cette demande : ils voient qu'une absence
 * existe (dates, durée, statut) mais jamais sa nature médicale précise ni le motif
 * libre. Portée volontairement limitée à DN/DNA — jamais aux chefs directs, qui
 * voient toujours le type réel des demandes de leur périmètre (décision produit).
 */
@Injectable()
export class LeaveMedicalPrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cascade: CascadeService,
  ) {}

  /** Un seul aller-retour DB pour tous les chefs de division/section/cellule —
   * réutilisable pour plusieurs cibles (évite le N+1 sur une liste de demandes). */
  loadChiefCandidates(): Promise<ChiefCandidate[]> {
    return this.prisma.user.findMany({
      where: { role: { in: [SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE] } },
      select: { id: true, role: true, divisionId: true, sectionId: true, celluleId: true },
    });
  }

  /** Vrai si `actor` ne doit voir que la version masquée du type/motif de `target`
   * pour un congé de code `leaveTypeCode`. */
  async shouldMask(actor: AuthenticatedUser, target: OrgTarget, leaveTypeCode: string): Promise<boolean> {
    if (!this.isPotentiallyMaskable(actor, target, leaveTypeCode)) return false;
    const candidates = await this.loadChiefCandidates();
    return candidates.some((c) => this.cascade.hasCloserAuthorityOver(c, target));
  }

  /** Variante batch de shouldMask, avec les chefs déjà chargés une seule fois. */
  shouldMaskWithCandidates(
    actor: AuthenticatedUser,
    target: OrgTarget,
    leaveTypeCode: string,
    chiefCandidates: ChiefCandidate[],
  ): boolean {
    if (!this.isPotentiallyMaskable(actor, target, leaveTypeCode)) return false;
    return chiefCandidates.some((c) => this.cascade.hasCloserAuthorityOver(c, target));
  }

  /** Vrai s'il existe un chef plus proche que DN/DNA pour `target`, quel que soit le
   * type de congé — utilisé pour les vues agrégées (soldes) où il n'y a pas de type
   * précis à tester au préalable. */
  async hasCloserValidator(target: OrgTarget): Promise<boolean> {
    const candidates = await this.loadChiefCandidates();
    return candidates.some((c) => this.cascade.hasCloserAuthorityOver(c, target));
  }

  maskedLeaveType(): { code: null; name: string } {
    return { code: null, name: MASKED_LEAVE_TYPE_LABEL };
  }

  isSensitiveCode(leaveTypeCode: string): boolean {
    return leaveTypeCode === SENSITIVE_LEAVE_TYPE_CODE;
  }

  private isPotentiallyMaskable(actor: AuthenticatedUser, target: OrgTarget, leaveTypeCode: string): boolean {
    if (leaveTypeCode !== SENSITIVE_LEAVE_TYPE_CODE) return false;
    if (!this.cascade.isLeadershipRole(actor.role)) return false;
    if (actor.id === target.id) return false;
    return true;
  }
}

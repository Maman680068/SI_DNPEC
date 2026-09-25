import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateSuppleanceDto } from './dto/create-suppleance.dto';
import { COMPARABLE_RANK_DESIGNATION_MESSAGE, isComparableRank } from './comparable-rank';

/** Rôles "chef" — seuls éligibles comme titulaire OU suppléant (§2.6,
 * décision de conception validée) : ils exercent déjà une forme d'autorité
 * de cascade ailleurs dans l'application, contrairement à AGENT/
 * ASSISTANT_DIRECTION/ADMIN_SYSTEME/DRH, qui n'ont rien de tel à emprunter. */
const CHEF_TIER_ROLES: SystemRole[] = [
  SystemRole.CHEF_SECTION,
  SystemRole.CHEF_CELLULE,
  SystemRole.CHEF_DIVISION,
  SystemRole.DN,
  SystemRole.DNA,
];

/** Parties d'une suppléance telles qu'exposées au web (affichage, choix). */
const PARTY_SELECT = { id: true, firstName: true, lastName: true, role: true, divisionId: true } as const;

/**
 * Suppléance/intérim (§2.6). La désignation ne fait qu'enregistrer la
 * période et les parties — l'emprunt de rôle réel (autorité + visibilité en
 * cascade) se produit à chaque requête, dans JwtAuthGuard, sur en-tête
 * explicite X-Interim-For (voir schema.prisma, en-tête du modèle Suppleance,
 * pour la vue d'ensemble du mécanisme).
 */
@Injectable()
export class SuppleancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateSuppleanceDto) {
    if (dto.titulaireId === dto.suppleantId) {
      throw new ConflictException('Un responsable ne peut pas être son propre suppléant.');
    }

    const [titulaire, suppleant] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.titulaireId },
        select: { id: true, role: true, divisionId: true, sectionId: true, celluleId: true, firstName: true, lastName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.suppleantId },
        select: { id: true, role: true, status: true, divisionId: true, firstName: true, lastName: true },
      }),
    ]);
    if (!titulaire) throw new NotFoundException('Titulaire introuvable');
    if (!suppleant) throw new NotFoundException('Suppléant introuvable');

    if (!CHEF_TIER_ROLES.includes(titulaire.role)) {
      throw new ForbiddenException(
        'Le titulaire doit exercer un rôle de responsable (Chef de Section/Division/Cellule, DN ou DNA).',
      );
    }
    if (!CHEF_TIER_ROLES.includes(suppleant.role)) {
      throw new ForbiddenException(
        'Le suppléant désigné doit déjà exercer un rôle de responsable (Chef de Section/Division/Cellule, DN ou DNA).',
      );
    }
    if (suppleant.status !== UserStatus.ACTIF) {
      throw new ForbiddenException("Le suppléant désigné n'a pas de compte actif.");
    }
    if (!isComparableRank(titulaire, suppleant)) {
      throw new ForbiddenException(COMPARABLE_RANK_DESIGNATION_MESSAGE);
    }

    // Qui peut désigner : le titulaire lui-même, ou son supérieur direct
    // (hasDirectAuthorityOver couvre déjà DN/DNA via LEADERSHIP_ROLES).
    if (actor.id !== titulaire.id && !this.cascade.hasDirectAuthorityOver(actor, titulaire)) {
      throw new ForbiddenException('Seuls le titulaire ou son supérieur direct peuvent désigner un suppléant.');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new ConflictException('La date de fin ne peut pas être antérieure à la date de début.');
    }

    // Une seule suppléance active/future (non révoquée) à la fois par titulaire —
    // jamais deux personnes habilitées à agir en son nom simultanément.
    const overlapping = await this.prisma.suppleance.findFirst({
      where: {
        titulaireId: titulaire.id,
        revokedAt: null,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new ConflictException('Une suppléance est déjà active ou prévue pour ce titulaire sur cette période.');
    }

    const suppleance = await this.prisma.suppleance.create({
      data: { titulaireId: titulaire.id, suppleantId: suppleant.id, startDate, endDate, createdById: actor.id },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Suppleance',
      entityId: suppleance.id,
      metadata: { titulaireId: titulaire.id, suppleantId: suppleant.id, startDate: dto.startDate, endDate: dto.endDate },
    });

    await this.notifications.notify(
      suppleant.id,
      NotificationType.SUPPLEANCE_DESIGNEE,
      'Vous avez été désigné suppléant',
      `${titulaire.firstName} ${titulaire.lastName}, du ${formatDate(startDate)} au ${formatDate(endDate)}`,
      '/suppleances',
    );
    if (actor.id !== titulaire.id) {
      await this.notifications.notify(
        titulaire.id,
        NotificationType.SUPPLEANCE_DESIGNEE,
        'Un suppléant a été désigné pour vous',
        `${suppleant.firstName} ${suppleant.lastName}, du ${formatDate(startDate)} au ${formatDate(endDate)}`,
        '/suppleances',
      );
    }

    return suppleance;
  }

  /**
   * Suppléances où `actor` est titulaire, suppléant, ou celui qui les a
   * désignées (supérieur direct d'un titulaire — pour pouvoir les suivre et
   * les révoquer). `conforme` : règle du rang comparable réévaluée sur les
   * rôles ACTUELS, comme à l'usage dans JwtAuthGuard — une suppléance non
   * conforme reste listée (avec ce statut) mais n'est plus utilisable.
   */
  async findMine(actor: AuthenticatedUser) {
    const rows = await this.prisma.suppleance.findMany({
      where: { OR: [{ titulaireId: actor.id }, { suppleantId: actor.id }, { createdById: actor.id }] },
      include: { titulaire: { select: PARTY_SELECT }, suppleant: { select: PARTY_SELECT } },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => ({ ...row, conforme: isComparableRank(row.titulaire, row.suppleant) }));
  }

  /** Titulaires pour lesquels `actor` peut désigner un suppléant : lui-même
   * s'il a un rôle de chef, et tout chef ACTIF sur qui il a une autorité
   * hiérarchique directe — exactement la règle de create(). */
  async findManageableTitulaires(actor: AuthenticatedUser) {
    const chefs = await this.prisma.user.findMany({
      where: { role: { in: CHEF_TIER_ROLES }, status: UserStatus.ACTIF },
      select: { ...PARTY_SELECT, sectionId: true, celluleId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return chefs
      .filter((u) => u.id === actor.id || this.cascade.hasDirectAuthorityOver(actor, u))
      .map(({ sectionId: _s, celluleId: _c, ...party }) => party);
  }

  /** Suppléants possibles pour `titulaireId` : comptes ACTIFS de rang
   * comparable (isComparableRank) — le formulaire ne propose ainsi que des
   * choix que create() acceptera. 403 si `actor` ne peut pas gérer ce titulaire. */
  async findCandidates(actor: AuthenticatedUser, titulaireId: string) {
    const titulaire = await this.prisma.user.findUnique({
      where: { id: titulaireId },
      select: { ...PARTY_SELECT, sectionId: true, celluleId: true },
    });
    if (!titulaire) throw new NotFoundException('Titulaire introuvable');
    if (actor.id !== titulaire.id && !this.cascade.hasDirectAuthorityOver(actor, titulaire)) {
      throw new ForbiddenException('Seuls le titulaire ou son supérieur direct peuvent désigner un suppléant.');
    }
    const chefs = await this.prisma.user.findMany({
      where: { role: { in: CHEF_TIER_ROLES }, status: UserStatus.ACTIF, id: { not: titulaire.id } },
      select: PARTY_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return chefs.filter((candidate) => isComparableRank(titulaire, candidate));
  }

  async revoke(actor: AuthenticatedUser, id: string) {
    const suppleance = await this.prisma.suppleance.findUnique({ where: { id } });
    if (!suppleance) throw new NotFoundException('Suppléance introuvable');
    if (suppleance.revokedAt) throw new ConflictException('Cette suppléance est déjà révoquée.');

    const titulaire = await this.prisma.user.findUnique({
      where: { id: suppleance.titulaireId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!titulaire) throw new NotFoundException('Titulaire introuvable');

    if (actor.id !== suppleance.titulaireId && !this.cascade.hasDirectAuthorityOver(actor, titulaire)) {
      throw new ForbiddenException('Seuls le titulaire ou son supérieur direct peuvent révoquer cette suppléance.');
    }

    const updated = await this.prisma.suppleance.update({
      where: { id },
      data: { revokedAt: new Date(), revokedById: actor.id },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Suppleance',
      entityId: id,
      metadata: { event: 'revoked' },
    });

    return updated;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';

const NOM = { select: { id: true, firstName: true, lastName: true, email: true } } as const;

/**
 * Habilitation « gestionnaire logistique » (décision D9-1) : donnée et retirée
 * par l'administrateur système à n'importe quel compte actif — pas un rôle.
 * Elle est PERSONNELLE : jamais empruntée par un suppléant (on juge sur
 * `actor.id`, pas sur le titulaire en intérim).
 */
@Injectable()
export class GestionnairesLogistiqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async estGestionnaire(actor: Pick<AuthenticatedUser, 'id'>): Promise<boolean> {
    const h = await this.prisma.habilitationLogistique.findFirst({
      where: { userId: actor.id, revoqueeAt: null, user: { status: UserStatus.ACTIF } },
      select: { id: true },
    });
    return !!h;
  }

  async assertGestionnaire(actor: Pick<AuthenticatedUser, 'id'>): Promise<void> {
    if (!(await this.estGestionnaire(actor))) {
      throw new ForbiddenException('Action réservée aux gestionnaires logistiques.');
    }
  }

  /** Comptes actifs habilités (destinataires des notifications de gestion). */
  async idsGestionnaires(): Promise<string[]> {
    const hs = await this.prisma.habilitationLogistique.findMany({
      where: { revoqueeAt: null, user: { status: UserStatus.ACTIF } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return hs.map((h) => h.userId);
  }

  lister() {
    return this.prisma.habilitationLogistique.findMany({
      select: {
        id: true,
        createdAt: true,
        revoqueeAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } },
        accordeePar: NOM,
        revoqueePar: NOM,
      },
      orderBy: [{ revoqueeAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
    });
  }

  async accorder(actor: AuthenticatedUser, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.status !== UserStatus.ACTIF) throw new ForbiddenException('Seul un compte actif peut être habilité.');
    if (user.role === SystemRole.STAGIAIRE) {
      throw new ForbiddenException('Un stagiaire n’a pas accès à la logistique : il ne peut pas être habilité.');
    }
    const active = await this.prisma.habilitationLogistique.findFirst({ where: { userId, revoqueeAt: null } });
    if (active) throw new ConflictException('Cette personne est déjà gestionnaire logistique.');
    const created = await this.prisma.habilitationLogistique.create({ data: { userId, accordeeParId: actor.id } });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'HabilitationLogistique',
      entityId: created.id,
      metadata: { userId },
    });
    return created;
  }

  async revoquer(actor: AuthenticatedUser, id: string) {
    const h = await this.prisma.habilitationLogistique.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Habilitation introuvable');
    if (h.revoqueeAt) throw new ConflictException('Cette habilitation est déjà révoquée.');
    const updated = await this.prisma.habilitationLogistique.update({
      where: { id },
      data: { revoqueeAt: new Date(), revoqueeParId: actor.id },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'HabilitationLogistique',
      entityId: id,
      metadata: { event: 'revocation', userId: h.userId },
    });
    return updated;
  }
}

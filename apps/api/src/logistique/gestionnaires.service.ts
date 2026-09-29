import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { RolesFonctionnelsService } from '../socle/roles-fonctionnels.service';

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
    private readonly rolesFonctionnels: RolesFonctionnelsService,
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

  /** Liste de choix de l'administration : comptes que `accorder` accepte. */
  candidats() {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIF,
        role: { not: SystemRole.STAGIAIRE },
        habilitationsLogistique: { none: { revoqueeAt: null } },
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
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
    // Socle NIMBA : reflet en rôle fonctionnel Gestionnaire logistique, même transaction.
    const created = await this.prisma.$transaction(async (tx) => {
      const h = await tx.habilitationLogistique.create({ data: { userId, accordeeParId: actor.id } });
      await this.rolesFonctionnels.refleterHabilitationLogistique(tx, h);
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'HabilitationLogistique', entityId: h.id, metadata: { userId } }, tx);
      return h;
    });
    return created;
  }

  async revoquer(actor: AuthenticatedUser, id: string) {
    const h = await this.prisma.habilitationLogistique.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Habilitation introuvable');
    if (h.revoqueeAt) throw new ConflictException('Cette habilitation est déjà révoquée.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.habilitationLogistique.update({ where: { id }, data: { revoqueeAt: new Date(), revoqueeParId: actor.id } });
      await this.rolesFonctionnels.refleterRevocation(tx, { habilitationLogistiqueId: id }, actor.id);
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'HabilitationLogistique', entityId: id, metadata: { event: 'revocation', userId: h.userId } }, tx);
      return u;
    });
    return updated;
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, Prisma, RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import {
  LIBELLE_ROLE_FONCTIONNEL,
  ROLES_GERES_PAR_MODULE,
  ROLES_SANS_ECRAN,
  attributionActiveWhere,
} from './roles-fonctionnels';
import { AttribuerRoleDto, ListerAttributionsDto, RetirerRoleDto } from './dto/attributions.dto';

const PERSONNE = { select: { id: true, firstName: true, lastName: true } } as const;
const ATTRIBUTION_SELECT = {
  id: true,
  role: true,
  registreId: true,
  uniteKey: true,
  dateDebut: true,
  dateFin: true,
  motif: true,
  retireLe: true,
  motifRetrait: true,
  createdAt: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } },
  attribuePar: PERSONNE,
  retirePar: PERSONNE,
} satisfies Prisma.AttributionRoleSelect;

/**
 * Axe 2 de l'habilitation (§5.2) : attribution et retrait des rôles
 * fonctionnels — datés, cumulables, journalisés, jamais supprimés.
 * Réservé à l'administrateur (annexe 1.4 : « Compte, rôle, suppléance,
 * réglage : CLMV(T) administrateur »). Les rôles Agent du courrier et
 * Gestionnaire logistique restent gérés depuis leur module (granularité
 * propre) ; leur attribution en est le reflet, écrit dans la même transaction.
 */
@Injectable()
export class RolesFonctionnelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private estAdmin(actor: AuthenticatedUser): boolean {
    return actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId;
  }

  /** Liste : l'administrateur et le DRH voient tout, chacun voit les siennes. */
  async lister(actor: AuthenticatedUser, filtres: ListerAttributionsDto) {
    const toutVoir = this.estAdmin(actor) || actor.rolesFonctionnels.includes(RoleFonctionnel.DRH);
    const where: Prisma.AttributionRoleWhereInput = {
      ...(toutVoir ? (filtres.userId ? { userId: filtres.userId } : {}) : { userId: actor.id }),
      ...(filtres.role ? { role: filtres.role } : {}),
      ...(filtres.actives === 'true' ? attributionActiveWhere() : {}),
    };
    const lignes = await this.prisma.attributionRole.findMany({
      where,
      select: ATTRIBUTION_SELECT,
      orderBy: [{ retireLe: { sort: 'desc', nulls: 'first' } }, { dateDebut: 'desc' }],
      take: 500,
    });
    const maintenant = new Date();
    return {
      droits: { peutAttribuer: this.estAdmin(actor) },
      rolesAttribuables: this.estAdmin(actor)
        ? Object.values(RoleFonctionnel)
            .filter((r) => !ROLES_GERES_PAR_MODULE.includes(r) && !ROLES_SANS_ECRAN.includes(r))
            .map((r) => ({ role: r, libelle: LIBELLE_ROLE_FONCTIONNEL[r] }))
        : [],
      attributions: lignes.map((a) => ({
        ...a,
        libelle: LIBELLE_ROLE_FONCTIONNEL[a.role],
        active: !a.retireLe && a.dateDebut <= maintenant && (!a.dateFin || a.dateFin > maintenant),
        gereeParModule: ROLES_GERES_PAR_MODULE.includes(a.role),
        peutRetirer: this.estAdmin(actor) && !a.retireLe && !ROLES_GERES_PAR_MODULE.includes(a.role),
      })),
    };
  }

  /** Comptes proposés à l'attribution : actifs, rattachés à un agent, jamais stagiaires. */
  async candidats(actor: AuthenticatedUser) {
    if (!this.estAdmin(actor)) throw new ForbiddenException({ message: 'Réservé à l’administrateur.', etape: 'ROLE' });
    return this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE }, agentId: { not: null } },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async attribuer(actor: AuthenticatedUser, dto: AttribuerRoleDto) {
    if (!this.estAdmin(actor)) {
      throw new ForbiddenException({ message: 'Seul l’administrateur attribue les rôles fonctionnels.', etape: 'ROLE', objetType: 'AttributionRole' });
    }
    if (ROLES_GERES_PAR_MODULE.includes(dto.role)) {
      throw new BadRequestException(
        dto.role === RoleFonctionnel.AGENT_COURRIER
          ? 'Le rôle Agent du courrier s’attribue par registre et par unité, depuis Courrier → Habilitations.'
          : 'Le rôle Gestionnaire logistique s’attribue depuis Logistique → Gestionnaires logistiques.',
      );
    }
    if (ROLES_SANS_ECRAN.includes(dto.role)) throw new BadRequestException('Ce rôle n’est pas encore utilisé par la plateforme.');
    const debut = dto.dateDebut ? new Date(dto.dateDebut) : new Date();
    const fin = dto.dateFin ? new Date(dto.dateFin) : null;
    if (fin && fin <= debut) throw new BadRequestException('La date de fin doit suivre la date de début.');
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, status: true, role: true, agentId: true } });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (user.status !== UserStatus.ACTIF) throw new ConflictException('Seul un compte actif peut recevoir un rôle.');
    if (!user.agentId) throw new ConflictException('Ce compte n’est rattaché à aucun agent.');
    if (user.role === SystemRole.STAGIAIRE) throw new ConflictException('Un stagiaire ne reçoit aucun rôle fonctionnel.');
    const chevauche = await this.prisma.attributionRole.findFirst({
      where: {
        userId: dto.userId,
        role: dto.role,
        retireLe: null,
        AND: [{ OR: [{ dateFin: null }, { dateFin: { gt: debut } }] }, ...(fin ? [{ dateDebut: { lt: fin } }] : [])],
      },
      select: { id: true },
    });
    if (chevauche) throw new ConflictException('Cette personne détient déjà ce rôle sur cette période.');
    const cree = await this.prisma.attributionRole.create({
      data: { userId: dto.userId, role: dto.role, dateDebut: debut, dateFin: fin, motif: dto.motif, attribueParId: actor.id },
      select: ATTRIBUTION_SELECT,
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'AttributionRole',
      entityId: cree.id,
      metadata: { event: 'attribution', userId: dto.userId, role: dto.role, dateDebut: debut, dateFin: fin, motif: dto.motif ?? null },
    });
    await this.notifications.notify(
      dto.userId,
      NotificationType.ROLE_MODIFIE,
      'Rôle fonctionnel attribué',
      `Vous avez reçu le rôle « ${LIBELLE_ROLE_FONCTIONNEL[dto.role]} »${fin ? ` jusqu’au ${fin.toLocaleDateString('fr-FR')}` : ''}.`,
      '/dashboard',
    );
    return cree;
  }

  async retirer(actor: AuthenticatedUser, id: string, dto: RetirerRoleDto) {
    if (!this.estAdmin(actor)) {
      throw new ForbiddenException({ message: 'Seul l’administrateur retire les rôles fonctionnels.', etape: 'ROLE', objetType: 'AttributionRole', objetId: id });
    }
    const a = await this.prisma.attributionRole.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Attribution introuvable');
    if (ROLES_GERES_PAR_MODULE.includes(a.role)) throw new BadRequestException('Ce rôle se retire depuis l’écran de son module.');
    if (a.retireLe) throw new ConflictException('Ce rôle a déjà été retiré.');
    const maj = await this.prisma.attributionRole.update({
      where: { id },
      data: { retireLe: new Date(), retireParId: actor.id, motifRetrait: dto.motif },
      select: ATTRIBUTION_SELECT,
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'AttributionRole',
      entityId: id,
      metadata: { event: 'retrait', userId: a.userId, role: a.role, motif: dto.motif },
    });
    await this.notifications.notify(
      a.userId,
      NotificationType.ROLE_MODIFIE,
      'Rôle fonctionnel retiré',
      `Le rôle « ${LIBELLE_ROLE_FONCTIONNEL[a.role]} » vous a été retiré. Motif : ${dto.motif}`,
      '/dashboard',
    );
    return maj;
  }

  /**
   * Changement de rôle (position) vers ou depuis DRH / Assistant de direction :
   * le rôle fonctionnel correspondant suit, pour garder le comportement de
   * l'écran « Changer de rôle » (la personne nommée DRH exerce aussitôt).
   */
  async alignerSurPosition(userId: string, avant: SystemRole | null, apres: SystemRole, auteurId: string): Promise<void> {
    const paires: [SystemRole, RoleFonctionnel][] = [
      [SystemRole.DRH, RoleFonctionnel.DRH],
      [SystemRole.ASSISTANT_DIRECTION, RoleFonctionnel.ASSISTANT],
    ];
    for (const [position, role] of paires) {
      if (avant !== position && apres === position) {
        const actif = await this.prisma.attributionRole.findFirst({ where: { userId, role, ...attributionActiveWhere() }, select: { id: true } });
        if (!actif) {
          const a = await this.prisma.attributionRole.create({ data: { userId, role, attribueParId: auteurId, motif: 'Changement de rôle' } });
          await this.audit.log({ actorId: auteurId, action: AuditAction.CREATION, entityType: 'AttributionRole', entityId: a.id, metadata: { event: 'attribution_changement_role', userId, role } });
        }
      }
      if (avant === position && apres !== position) {
        await this.prisma.attributionRole.updateMany({
          where: { userId, role, retireLe: null },
          data: { retireLe: new Date(), retireParId: auteurId, motifRetrait: 'Changement de rôle' },
        });
      }
    }
  }

  // ---------------------------------------------------------------- reflets des habilitations de module

  /** Reflet d'une habilitation courrier créée (même transaction). */
  async refleterHabilitationCourrier(
    tx: Prisma.TransactionClient,
    h: { id: string; userId: string; registreId: string; uniteKey: string; accordeeParId: string },
  ): Promise<void> {
    await tx.attributionRole.create({
      data: {
        userId: h.userId, role: RoleFonctionnel.AGENT_COURRIER, registreId: h.registreId, uniteKey: h.uniteKey,
        attribueParId: h.accordeeParId, motif: 'Habilitation courrier', habilitationCourrierId: h.id,
      },
    });
  }

  /** Reflet d'une habilitation logistique accordée (même transaction). */
  async refleterHabilitationLogistique(tx: Prisma.TransactionClient, h: { id: string; userId: string; accordeeParId: string }): Promise<void> {
    await tx.attributionRole.create({
      data: { userId: h.userId, role: RoleFonctionnel.GESTIONNAIRE_LOGISTIQUE, attribueParId: h.accordeeParId, motif: 'Gestionnaire logistique', habilitationLogistiqueId: h.id },
    });
  }

  /** Reflet d'une révocation (même transaction). */
  async refleterRevocation(
    tx: Prisma.TransactionClient,
    lien: { habilitationCourrierId: string } | { habilitationLogistiqueId: string },
    parId: string,
  ): Promise<void> {
    await tx.attributionRole.updateMany({
      where: { ...lien, retireLe: null },
      data: { retireLe: new Date(), retireParId: parId, motifRetrait: 'Habilitation révoquée' },
    });
  }
}

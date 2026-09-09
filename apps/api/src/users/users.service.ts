import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { PasswordService } from '../common/security/password.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  photoUrl: true,
  jobTitle: true,
  role: true,
  status: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
  supervisorId: true,
  // Rattachement déclaré à l'auto-inscription (purement informatif — voir
  // schema.prisma, User.declaredDivisionId) : affiché sur "Inscriptions en
  // attente" pour pré-remplir l'approbation, voir ApproveRegistrationModal.
  declaredDivisionId: true,
  declaredSectionId: true,
  declaredCelluleId: true,
  declaredSupervisorId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** Champs de profil qu'un utilisateur non-admin peut modifier sur lui-même. */
const SELF_EDITABLE_FIELDS: (keyof UpdateUserDto)[] = ['phone', 'photoUrl', 'jobTitle'];

/**
 * Volontairement distinct de USER_LIST_SELECT : ni email, ni rôle, ni statut de
 * compte — seulement de quoi afficher un nom quelque part où l'auteur d'un
 * commentaire, un co-responsable ou une personne mentionnée est hors du
 * périmètre cascade de l'observateur (ex. un Agent consultant un commentaire
 * de son Chef de Division). Préfigure ce que l'Annuaire (RF-CPL-02) exposera
 * de toute façon publiquement en interne.
 */
const BASIC_INFO_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
} satisfies Prisma.UserSelect;

/**
 * Annuaire du personnel (RF-CPL-02) : plus riche que BASIC_INFO_SELECT (rôle
 * et photo en plus, utiles pour "relié à l'organigramme"), mais toujours
 * sans email ni téléphone — non demandés par le cahier des charges, et un
 * email professionnel visible nécessiterait un champ opt-in dédié, pas
 * encore justifié par un besoin réel. Comme BASIC_INFO_SELECT et
 * searchBasicInfo, volontairement hors périmètre cascade : c'est tout le
 * personnel actif, pas seulement le sous-ensemble visible par l'acteur.
 */
const DIRECTORY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  role: true,
  photoUrl: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
} satisfies Prisma.UserSelect;

const RESOLVE_MAX_IDS = 200;
const SEARCH_MAX_RESULTS = 20;

/** Rôles pouvant être désignés comme superviseur d'un Assistant de direction
 * — un Chef de Division en est délibérément exclu (schema.prisma, décision
 * de conception n°2). Même liste que AuthService.SUPERVISOR_ROLES, pour la
 * déclaration à l'inscription. */
const SUPERVISOR_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.CHEF_CELLULE];

type OrgAttachment = {
  divisionId?: string | null;
  sectionId?: string | null;
  celluleId?: string | null;
  supervisorId?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordService: PasswordService,
    private readonly cascade: CascadeService,
  ) {}

  findAllVisibleTo(actor: AuthenticatedUser) {
    return this.prisma.user.findMany({
      where: this.cascade.getVisibleUserWhere(actor),
      select: USER_LIST_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /**
   * Résolution de noms hors périmètre cascade — pas de contrôle d'autorité
   * volontairement : accessible à tout utilisateur authentifié (voir
   * BASIC_INFO_SELECT ci-dessus pour ce qui reste exclu).
   */
  resolveBasicInfo(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids)).slice(0, RESOLVE_MAX_IDS);
    if (uniqueIds.length === 0) return [];
    return this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: BASIC_INFO_SELECT,
    });
  }

  /**
   * Recherche par nom hors périmètre cascade — mêmes principes que
   * resolveBasicInfo (aucun contrôle d'autorité, champs non sensibles
   * uniquement) mais par requête textuelle plutôt que par ids connus. Sert à
   * trouver un destinataire pour la messagerie directe (RF-COM-01, "point à
   * point entre deux comptes actifs", explicitement sans restriction de
   * cascade) — sans quoi un Agent ne pourrait démarrer une conversation
   * qu'avec lui-même. Comptes actifs uniquement.
   */
  searchBasicInfo(query: string) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIF,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: BASIC_INFO_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: SEARCH_MAX_RESULTS,
    });
  }

  /**
   * Annuaire du personnel (RF-CPL-02) — tout le personnel actif, hors
   * périmètre cascade (voir DIRECTORY_SELECT), accessible à tout utilisateur
   * authentifié. Élargit la VISIBILITÉ, pas les droits d'action : agir
   * ensuite sur une personne trouvée ici (ex. lui assigner une tâche) reste
   * soumis aux mêmes contrôles d'autorité qu'ailleurs (CascadeService),
   * appliqués côté serveur indépendamment de la façon dont l'id a été
   * obtenu.
   */
  listDirectory() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF },
      select: DIRECTORY_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_LIST_SELECT });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (actor.id !== user.id && !this.cascade.canManageUser(actor, user)) {
      throw new ForbiddenException('Utilisateur hors de votre périmètre');
    }
    return user;
  }

  /** Création manuelle par l'Administrateur système (RF-SEC-01, modalité 1). */
  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    await this.assertOrgAttachmentValid(dto);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cet email');

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
        role: dto.role,
        status: UserStatus.ACTIF,
        divisionId: dto.divisionId ?? null,
        sectionId: dto.sectionId ?? null,
        celluleId: dto.celluleId ?? null,
        supervisorId: dto.supervisorId ?? null,
      },
      select: USER_LIST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role, createdManually: true },
    });

    return user;
  }

  async updateProfile(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const target = await this.findOneOrThrow(id);
    const isSelf = actor.id === id;
    const isAdmin = actor.role === SystemRole.ADMIN_SYSTEME;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre profil.');
    }
    if (isSelf && !isAdmin) {
      const disallowed = Object.keys(dto).filter(
        (key) => !SELF_EDITABLE_FIELDS.includes(key as keyof UpdateUserDto),
      );
      if (disallowed.length > 0) {
        throw new ForbiddenException(`Champs non modifiables par vous-même : ${disallowed.join(', ')}`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: dto,
      select: USER_LIST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'User',
      entityId: id,
      metadata: { event: 'profile_update', fields: Object.keys(dto) },
    });

    return updated;
  }

  /** Active/suspend un compte — ADMIN_SYSTEME uniquement (cf. controller). */
  async updateStatus(actor: AuthenticatedUser, id: string, dto: UpdateStatusDto) {
    const target = await this.findOneOrThrow(id);

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { status: dto.status },
      select: USER_LIST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'User',
      entityId: id,
      metadata: { event: 'status_change', previousStatus: target.status, newStatus: dto.status },
    });

    return updated;
  }

  /** Affectation Division/Section/Cellule (RF-SEC-06) — admin ou chef en cascade sur son périmètre. */
  async updateAssignment(actor: AuthenticatedUser, id: string, dto: UpdateAssignmentDto) {
    const target = await this.findOneOrThrow(id);
    const isAdmin = actor.role === SystemRole.ADMIN_SYSTEME;

    if (!isAdmin) {
      this.cascade.assertCanManageUser(actor, target);
      if (
        actor.role === SystemRole.CHEF_DIVISION &&
        dto.divisionId !== undefined &&
        dto.divisionId !== actor.divisionId
      ) {
        throw new ForbiddenException('Vous ne pouvez affecter un agent qu’au sein de votre propre division.');
      }
      if (
        actor.role === SystemRole.CHEF_CELLULE &&
        dto.celluleId !== undefined &&
        dto.celluleId !== actor.celluleId
      ) {
        throw new ForbiddenException('Vous ne pouvez affecter un agent qu’au sein de votre propre cellule.');
      }
      if (actor.role !== SystemRole.CHEF_DIVISION && actor.role !== SystemRole.CHEF_CELLULE) {
        throw new ForbiddenException("Votre rôle ne permet pas de modifier un rattachement.");
      }
    }

    const nextAttachment: Required<OrgAttachment> = {
      divisionId: dto.divisionId !== undefined ? dto.divisionId : target.divisionId,
      sectionId: dto.sectionId !== undefined ? dto.sectionId : target.sectionId,
      celluleId: dto.celluleId !== undefined ? dto.celluleId : target.celluleId,
      // UpdateAssignmentDto ne porte pas supervisorId (hors périmètre de cet
      // endpoint, réservé à la création/l'approbation) — jamais touché ici.
      supervisorId: target.supervisorId,
    };
    await this.assertOrgAttachmentValid(nextAttachment);

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: nextAttachment,
      select: USER_LIST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'User',
      entityId: id,
      metadata: {
        event: 'org_assignment',
        previous: {
          divisionId: target.divisionId,
          sectionId: target.sectionId,
          celluleId: target.celluleId,
        },
        next: nextAttachment,
      },
    });

    return updated;
  }

  /** Auto-inscriptions en attente de validation (RF-SEC-01, modalité 2). */
  findPendingRegistrations() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.EN_ATTENTE },
      select: USER_LIST_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveRegistration(actor: AuthenticatedUser, id: string, dto: ApproveRegistrationDto) {
    const target = await this.findOneOrThrow(id);
    if (target.status !== UserStatus.EN_ATTENTE) {
      throw new ConflictException("Ce compte n'est pas en attente de validation.");
    }

    const attachment: Required<OrgAttachment> = {
      divisionId: dto.divisionId ?? null,
      sectionId: dto.sectionId ?? null,
      celluleId: dto.celluleId ?? null,
      supervisorId: dto.supervisorId ?? null,
    };
    await this.assertOrgAttachmentValid(attachment);

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        status: UserStatus.ACTIF,
        role: dto.role,
        jobTitle: dto.jobTitle,
        ...attachment,
      },
      select: USER_LIST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.VALIDATION,
      entityType: 'User',
      entityId: id,
      metadata: { role: dto.role, ...attachment },
    });

    return updated;
  }

  async rejectRegistration(actor: AuthenticatedUser, id: string): Promise<void> {
    const target = await this.findOneOrThrow(id);
    if (target.status !== UserStatus.EN_ATTENTE) {
      throw new ConflictException("Ce compte n'est pas en attente de validation.");
    }

    await this.prisma.user.delete({ where: { id: target.id } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.REJET,
      entityType: 'User',
      entityId: id,
      metadata: { email: target.email },
    });
  }

  private async findOneOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  /** Fait respecter les invariants documentés dans schema.prisma (divisionId/celluleId exclusifs, section ⊂ division). */
  private async assertOrgAttachmentValid(input: OrgAttachment): Promise<void> {
    if (input.divisionId && input.celluleId) {
      throw new ConflictException(
        'Un utilisateur ne peut pas être rattaché à la fois à une Division et à une Cellule.',
      );
    }

    if (input.sectionId) {
      if (!input.divisionId) {
        throw new ConflictException('Une Section ne peut être renseignée sans Division.');
      }
      const section = await this.prisma.section.findUnique({ where: { id: input.sectionId } });
      if (!section || section.divisionId !== input.divisionId) {
        throw new ConflictException("Cette Section n'appartient pas à la Division indiquée.");
      }
    }

    if (input.divisionId) {
      const division = await this.prisma.division.findUnique({ where: { id: input.divisionId } });
      if (!division) throw new NotFoundException('Division introuvable');
    }

    if (input.celluleId) {
      const cellule = await this.prisma.cellule.findUnique({ where: { id: input.celluleId } });
      if (!cellule) throw new NotFoundException('Cellule introuvable');
    }

    if (input.supervisorId) {
      const supervisor = await this.prisma.user.findUnique({ where: { id: input.supervisorId } });
      if (!supervisor || !SUPERVISOR_ROLES.includes(supervisor.role)) {
        throw new ConflictException('Le superviseur doit être un DN, une DNA ou un Chef de Cellule.');
      }
    }
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccesDelegueType, AuditAction, CourrierConfidentialite, NotificationType, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { isComparableRank } from '../suppleances/comparable-rank';
import { PERSONNE_SELECT } from './personnes';
import { ACTE_ACCES_SELECT, ARRIVEE_ACCES_SELECT, CourrierAccesService } from './courrier-acces.service';

type Cible = { arriveeId: string } | { acteId: string };

/**
 * Accès délégué à un courrier CONFIDENTIEL (arrivée ou acte), courrier par
 * courrier. Ouvert par une personne qui y a accès de son PROPRE droit (jamais
 * par délégation en chaîne, jamais en intérim), au profit de :
 * - SON assistant (User.supervisorId = elle) ;
 * - SON suppléant (suppléance active et conforme où elle est titulaire) —
 *   l'accès expire tout seul à la fin, à la révocation ou à la
 *   non-conformité de la suppléance (réévalué à chaque lecture,
 *   CourrierAccesService.contexte).
 * Jamais pour un pli PERSONNEL (actor.id strict), inutile pour un ORDINAIRE.
 */
@Injectable()
export class AccesDeleguesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly acces: CourrierAccesService,
  ) {}

  async ouvrir(actor: AuthenticatedUser, cible: Cible, beneficiaireId: string) {
    const { numero, lien } = await this.preparer(actor, cible);

    const beneficiaire = await this.prisma.user.findUnique({
      where: { id: beneficiaireId },
      select: { id: true, role: true, status: true, supervisorId: true, divisionId: true },
    });
    if (!beneficiaire) throw new NotFoundException('Bénéficiaire introuvable');
    if (beneficiaire.status !== UserStatus.ACTIF) throw new BadRequestException('Le bénéficiaire n’a pas de compte actif.');
    if (beneficiaire.role === SystemRole.ADMIN_SYSTEME) {
      throw new ForbiddenException('L’administrateur système n’a pas accès au courrier : il ne peut pas recevoir d’accès délégué.');
    }

    const delegation = await this.lienDelegation(actor, beneficiaire);
    if (!delegation) {
      throw new ForbiddenException(
        'L’accès ne peut être ouvert qu’à votre assistant ou à votre suppléant (suppléance en cours et conforme).',
      );
    }
    const { type, suppleanceId } = delegation;

    const where = { ...cible, beneficiaireId: beneficiaire.id, revoqueAt: null };
    if (await this.prisma.accesDelegueCourrier.findFirst({ where })) {
      throw new ConflictException('Un accès est déjà ouvert à cette personne pour ce courrier.');
    }
    const created = await this.prisma.accesDelegueCourrier.create({
      data: { ...cible, beneficiaireId: beneficiaire.id, type, suppleanceId, ouvertParId: actor.id },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'AccesDelegueCourrier',
      entityId: created.id,
      metadata: { event: 'acces_ouvert', ...cible, beneficiaireId: beneficiaire.id, type },
    });
    await this.notifications.notify(
      beneficiaire.id,
      NotificationType.COURRIER_ACCES_OUVERT,
      'Accès ouvert à un courrier confidentiel',
      `Un accès vous a été ouvert au courrier confidentiel ${numero ? `n° ${numero}` : '(acte en préparation)'}.`,
      lien,
    );
    return created;
  }

  async revoquer(actor: AuthenticatedUser, id: string) {
    const acces = await this.prisma.accesDelegueCourrier.findUnique({ where: { id } });
    if (!acces) throw new NotFoundException('Accès délégué introuvable');
    if (acces.ouvertParId !== actor.id) throw new ForbiddenException('Seule la personne qui a ouvert cet accès peut le révoquer.');
    if (acces.revoqueAt) throw new ConflictException('Cet accès est déjà révoqué.');
    const updated = await this.prisma.accesDelegueCourrier.update({
      where: { id },
      data: { revoqueAt: new Date(), revoqueParId: actor.id },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'AccesDelegueCourrier',
      entityId: id,
      metadata: { event: 'acces_revoque' },
    });
    return updated;
  }

  /**
   * Personnes à qui l'acteur pourrait ouvrir l'accès à ce courrier
   * (GET /courrier/delegataires-possibles) : mêmes préconditions et même
   * critère que ouvrir() — la liste ne peut pas diverger de l'action. Les
   * personnes qui ont déjà un accès ouvert sont exclues (ouvrir() → 409).
   * Champs d'affichage seulement (jamais de supervisorId ni d'email).
   */
  async delegatairesPossibles(actor: AuthenticatedUser, cible: { arriveeId?: string; acteId?: string }) {
    let c: Cible;
    if (cible.arriveeId && !cible.acteId) c = { arriveeId: cible.arriveeId };
    else if (cible.acteId && !cible.arriveeId) c = { acteId: cible.acteId };
    else throw new BadRequestException('Précisez arriveeId ou acteId (un seul).');
    await this.preparer(actor, c);

    const now = new Date();
    const candidats = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIF,
        OR: [
          { role: SystemRole.ASSISTANT_DIRECTION, supervisorId: actor.id },
          { suppleancesAsSuppleant: { some: { titulaireId: actor.id, revokedAt: null, startDate: { lte: now }, endDate: { gte: now } } } },
        ],
        NOT: { accesDelegueRecus: { some: { ...c, revoqueAt: null } } },
      },
      select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true, supervisorId: true, divisionId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const possibles = [];
    for (const u of candidats) {
      const lien = await this.lienDelegation(actor, u, now);
      if (lien) possibles.push({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, jobTitle: u.jobTitle, type: lien.type });
    }
    return possibles;
  }

  /** Préconditions communes à ouvrir() et delegatairesPossibles(). */
  private async preparer(actor: AuthenticatedUser, cible: Cible) {
    if (actor.interimForId) {
      throw new ForbiddenException('Un accès délégué s’ouvre en votre nom propre, jamais en intérim.');
    }
    const propre = await this.assertAccesPropre(actor, cible);
    if (propre.confidentialite === CourrierConfidentialite.PERSONNEL) {
      throw new ForbiddenException('Un pli personnel n’est jamais délégable.');
    }
    if (propre.confidentialite !== CourrierConfidentialite.CONFIDENTIEL) {
      throw new ConflictException('Un accès délégué ne concerne que les courriers confidentiels.');
    }
    return propre;
  }

  /** Lien qui autorise la délégation : assistant de l'acteur, ou suppléant
   * d'une suppléance en cours et conforme où l'acteur est titulaire. */
  private async lienDelegation(
    actor: AuthenticatedUser,
    u: { id: string; role: SystemRole; supervisorId: string | null; divisionId: string | null },
    now: Date = new Date(),
  ): Promise<{ type: AccesDelegueType; suppleanceId: string | null } | null> {
    if (u.role === SystemRole.ADMIN_SYSTEME) return null; // jamais délégataire (voir ouvrir)
    if (u.role === SystemRole.ASSISTANT_DIRECTION && u.supervisorId === actor.id) {
      return { type: AccesDelegueType.ASSISTANT, suppleanceId: null };
    }
    const suppleance = await this.prisma.suppleance.findFirst({
      where: { titulaireId: actor.id, suppleantId: u.id, revokedAt: null, startDate: { lte: now }, endDate: { gte: now } },
      select: { id: true, titulaire: { select: { role: true, divisionId: true } } },
    });
    if (!suppleance || !isComparableRank(suppleance.titulaire, u)) return null;
    return { type: AccesDelegueType.SUPPLEANT, suppleanceId: suppleance.id };
  }

  /** Accès que la personne a ouverts sur ce courrier (pour les gérer). */
  async lister(actor: AuthenticatedUser, cible: Cible) {
    await this.assertAccesPropre(actor, cible);
    return this.prisma.accesDelegueCourrier.findMany({
      where: { ...cible, ouvertParId: actor.id },
      include: { beneficiaire: { select: PERSONNE_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** L'acteur a-t-il accès au contenu de SON PROPRE droit (hors délégation) ? */
  private async assertAccesPropre(actor: AuthenticatedUser, cible: Cible) {
    const ctx = await this.acces.contexte(actor);
    if ('arriveeId' in cible) {
      const a = await this.prisma.courrierArrivee.findUnique({
        where: { id: cible.arriveeId },
        select: { ...ARRIVEE_ACCES_SELECT, numero: true },
      });
      if (!a) throw new NotFoundException('Courrier introuvable');
      if (this.acces.niveauArrivee(ctx, a, { sansDelegation: true }) !== 'CONTENU') {
        throw new ForbiddenException('Seule une personne ayant elle-même accès à ce courrier peut en ouvrir l’accès.');
      }
      return { confidentialite: a.confidentialite, numero: a.numero, lien: `/courrier?arrivee=${a.id}` };
    }
    const acte = await this.prisma.acteCourrier.findUnique({
      where: { id: cible.acteId },
      select: { ...ACTE_ACCES_SELECT, numero: true },
    });
    if (!acte) throw new NotFoundException('Acte introuvable');
    if (this.acces.niveauActe(ctx, acte, { sansDelegation: true }) !== 'CONTENU') {
      throw new ForbiddenException('Seule une personne ayant elle-même accès à cet acte peut en ouvrir l’accès.');
    }
    return { confidentialite: acte.confidentialite, numero: acte.numero, lien: `/courrier?acte=${acte.id}` };
  }
}

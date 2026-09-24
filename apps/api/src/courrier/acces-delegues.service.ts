import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccesDelegueType, AuditAction, CourrierConfidentialite, NotificationType, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { isComparableRank } from '../suppleances/comparable-rank';
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
    if (actor.interimForId) {
      throw new ForbiddenException('Un accès délégué s’ouvre en votre nom propre, jamais en intérim.');
    }
    const { confidentialite, numero, lien } = await this.assertAccesPropre(actor, cible);
    if (confidentialite === CourrierConfidentialite.PERSONNEL) {
      throw new ForbiddenException('Un pli personnel n’est jamais délégable.');
    }
    if (confidentialite !== CourrierConfidentialite.CONFIDENTIEL) {
      throw new ConflictException('Un accès délégué ne concerne que les courriers confidentiels.');
    }

    const beneficiaire = await this.prisma.user.findUnique({
      where: { id: beneficiaireId },
      select: { id: true, role: true, supervisorId: true, divisionId: true },
    });
    if (!beneficiaire) throw new NotFoundException('Bénéficiaire introuvable');

    let type: AccesDelegueType;
    let suppleanceId: string | null = null;
    if (beneficiaire.role === SystemRole.ASSISTANT_DIRECTION && beneficiaire.supervisorId === actor.id) {
      type = AccesDelegueType.ASSISTANT;
    } else {
      const now = new Date();
      const suppleance = await this.prisma.suppleance.findFirst({
        where: { titulaireId: actor.id, suppleantId: beneficiaire.id, revokedAt: null, startDate: { lte: now }, endDate: { gte: now } },
        select: { id: true, titulaire: { select: { role: true, divisionId: true } } },
      });
      if (!suppleance || !isComparableRank(suppleance.titulaire, beneficiaire)) {
        throw new ForbiddenException(
          'L’accès ne peut être ouvert qu’à votre assistant ou à votre suppléant (suppléance en cours et conforme).',
        );
      }
      type = AccesDelegueType.SUPPLEANT;
      suppleanceId = suppleance.id;
    }

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

  /** Accès que la personne a ouverts sur ce courrier (pour les gérer). */
  async lister(actor: AuthenticatedUser, cible: Cible) {
    await this.assertAccesPropre(actor, cible);
    return this.prisma.accesDelegueCourrier.findMany({
      where: { ...cible, ouvertParId: actor.id },
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

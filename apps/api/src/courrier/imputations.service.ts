import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CourrierConfidentialite,
  ImputationNature,
  ImputationStatut,
  NotificationType,
  Prisma,
  RegistrePortee,
  TaskConfidentiality,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CourrierAccesService } from './courrier-acces.service';
import { ArriveeChargee, ArriveesService, libelleCourrier } from './arrivees.service';
import { recalculerStatutArrivee } from './statut-arrivee';
import { estMembreUnite } from './unites';
import { ConvertirImputationDto, ImputerDto, TraiterImputationDto } from './dto/arrivee.dto';

type CandidatImpute = { id: string; divisionId: string | null; sectionId: string | null; celluleId: string | null };

const NATURE_LABEL: Record<ImputationNature, string> = {
  ATTRIBUTION: 'pour attribution',
  INFORMATION: 'pour information',
  AVIS: 'pour avis',
};

/**
 * Imputations du courrier arrivée (D7) :
 * - imputation initiale : registre DIRECTION → DN/DNA ; registre UNITE → chef
 *   de cette Division/Cellule ou DN/DNA (et imputé membre de l'unité). La
 *   suppléance « P.I. » s'applique (rôle emprunté) ; le titulaire représenté
 *   est stocké (auNomDeId) et audité. L'habilitation courrier ne donne
 *   AUCUNE autorité d'imputation.
 * - sous-imputation : par un imputé, sur son périmètre (cascade), limitée à
 *   l'unité pour un registre UNITE ;
 * - toute action exige l'accès au CONTENU (matrice) : sur un CONFIDENTIEL, un
 *   suppléant en intérim n'agit que si un accès délégué lui a été ouvert.
 * - conversion en tâche : manuelle, par l'imputant, sur le modèle exact de
 *   D2 ; clôture automatique dans TasksService.validate.
 */
@Injectable()
export class ImputationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly acces: CourrierAccesService,
    private readonly arrivees: ArriveesService,
  ) {}

  async imputer(actor: AuthenticatedUser, arriveeId: string, dto: ImputerDto) {
    const a = await this.preparerImputation(actor, arriveeId);
    const impute = await this.chargerImputeActif(dto.imputeAId);
    const refus = this.refusImpute(a, impute);
    if (refus) throw refus;
    const echeance = this.echeanceFuture(dto.echeance);
    return this.creer(actor, a, { ...dto, echeance, parentId: null }, impute.id);
  }

  async sousImputer(actor: AuthenticatedUser, imputationId: string, dto: ImputerDto) {
    const { parent, a } = await this.preparerSousImputation(actor, imputationId);
    const cible = await this.chargerImputeActif(dto.imputeAId);
    const refus = this.refusSousImpute(actor, a, cible);
    if (refus) throw refus;
    const echeance = this.echeanceFuture(dto.echeance);
    if (parent.echeance && (!echeance || echeance > parent.echeance)) {
      throw new BadRequestException('L’échéance d’une sous-imputation ne peut pas dépasser celle de l’imputation reçue.');
    }
    return this.creer(actor, a, { ...dto, echeance: echeance ?? parent.echeance, parentId: parent.id }, cible.id);
  }

  /**
   * Personnes que le serveur accepterait comme imputé (GET /courrier/imputables) :
   * mêmes préconditions et même critère que imputer()/sousImputer() — une seule
   * implémentation, la liste proposée ne peut pas diverger de l'action. Champs
   * d'affichage seulement (jamais d'email, de supervisorId ni de champ sensible).
   */
  async imputables(actor: AuthenticatedUser, cible: { arriveeId?: string; imputationId?: string }) {
    let accepte: (u: CandidatImpute) => boolean;
    if (cible.arriveeId && cible.imputationId) {
      throw new BadRequestException('Précisez arriveeId (imputation) ou imputationId (sous-imputation), pas les deux.');
    } else if (cible.imputationId) {
      const { a } = await this.preparerSousImputation(actor, cible.imputationId);
      accepte = (u) => this.refusSousImpute(actor, a, u) === null;
    } else if (cible.arriveeId) {
      const a = await this.preparerImputation(actor, cible.arriveeId);
      accepte = (u) => this.refusImpute(a, u) === null;
    } else {
      throw new BadRequestException('Précisez arriveeId (imputation) ou imputationId (sous-imputation).');
    }
    const actifs = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF },
      select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true, divisionId: true, sectionId: true, celluleId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return actifs.filter(accepte).map(({ id, firstName, lastName, role, jobTitle }) => ({ id, firstName, lastName, role, jobTitle }));
  }

  /** Préconditions d'une imputation initiale (courrier, autorité, accès au contenu). */
  private async preparerImputation(actor: AuthenticatedUser, arriveeId: string): Promise<ArriveeChargee> {
    const a = await this.arrivees.charger(arriveeId);
    this.arrivees.assertOuvert(a);
    if (a.confidentialite === CourrierConfidentialite.PERSONNEL) {
      throw new ConflictException('Un pli personnel doit d’abord être requalifié par son destinataire pour être imputé.');
    }
    if (!this.acces.estResponsableAction(actor, a.registre.portee, a.uniteKey)) {
      throw new ForbiddenException(
        a.registre.portee === RegistrePortee.DIRECTION
          ? 'Seuls le DN et la DNA imputent le courrier de ce registre.'
          : 'Seuls le chef de l’unité et la direction imputent le courrier de ce registre.',
      );
    }
    this.acces.assertArrivee(await this.acces.contexte(actor), a, 'CONTENU');
    return a;
  }

  /** Préconditions d'une sous-imputation (imputation reçue, accès au contenu). */
  private async preparerSousImputation(actor: AuthenticatedUser, imputationId: string) {
    const parent = await this.chargerImputation(imputationId);
    const a = await this.arrivees.charger(parent.courrierId);
    this.arrivees.assertOuvert(a);
    if (parent.statut !== ImputationStatut.EN_COURS) throw new ConflictException('Cette imputation est déjà traitée.');
    if (!this.cascade.isActingFor(actor, parent.imputeAId)) {
      throw new ForbiddenException('Seule la personne imputée peut sous-imputer ce courrier.');
    }
    this.acces.assertArrivee(await this.acces.contexte(actor), a, 'CONTENU');
    return { parent, a };
  }

  /** Critère sur la personne imputée (compte actif vérifié à part) — null si acceptée. */
  private refusImpute(a: ArriveeChargee, u: CandidatImpute): Error | null {
    if (a.registre.portee === RegistrePortee.UNITE && !estMembreUnite(u, a.uniteKey)) {
      return new ForbiddenException('Le courrier d’un registre d’unité ne s’impute qu’aux membres de cette unité.');
    }
    if (a.imputations.some((i) => i.imputeAId === u.id && !i.parentId && i.statut === ImputationStatut.EN_COURS)) {
      return new ConflictException('Ce courrier est déjà imputé à cette personne.');
    }
    return null;
  }

  private refusSousImpute(actor: AuthenticatedUser, a: ArriveeChargee, u: CandidatImpute): Error | null {
    if (!this.cascade.hasDirectAuthorityOver(actor, u)) {
      return new ForbiddenException('Vous ne pouvez sous-imputer qu’à une personne de votre périmètre.');
    }
    if (a.registre.portee === RegistrePortee.UNITE && !estMembreUnite(u, a.uniteKey)) {
      return new ForbiddenException('Le courrier d’un registre d’unité ne s’impute qu’aux membres de cette unité.');
    }
    return null;
  }

  private async creer(
    actor: AuthenticatedUser,
    a: ArriveeChargee,
    d: { nature: ImputationNature; instructions?: string; echeance: Date | null; parentId: string | null },
    imputeAId: string,
  ) {
    const imputation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.imputationCourrier.create({
        data: {
          courrierId: a.id,
          parentId: d.parentId,
          imputeParId: actor.id,
          auNomDeId: actor.interimForId,
          imputeAId,
          nature: d.nature,
          instructions: d.instructions,
          echeance: d.echeance,
        },
      });
      await recalculerStatutArrivee(tx, a.id);
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.CREATION,
          entityType: 'ImputationCourrier',
          entityId: created.id,
          metadata: {
            event: d.parentId ? 'sous_imputation' : 'imputation',
            courrier: a.numero,
            imputeAId,
            nature: d.nature,
            auNomDeId: actor.interimForId,
          },
        },
        tx,
      );
      return created;
    });

    if (imputeAId !== actor.id) {
      await this.notifications.notify(
        imputeAId,
        NotificationType.COURRIER_IMPUTE,
        'Courrier imputé',
        `Courrier ${libelleCourrier(a)} — ${NATURE_LABEL[d.nature]}${d.echeance ? `, échéance ${d.echeance.toLocaleDateString('fr-FR')}` : ''}.`,
        `/courrier?arrivee=${a.id}`,
      );
    }
    return imputation;
  }

  async traiter(actor: AuthenticatedUser, imputationId: string, dto: TraiterImputationDto) {
    const imp = await this.chargerImputation(imputationId);
    const a = await this.arrivees.charger(imp.courrierId);
    this.arrivees.assertOuvert(a);
    if (!this.cascade.isActingFor(actor, imp.imputeAId)) {
      throw new ForbiddenException('Seule la personne imputée (ou son suppléant en intérim) traite cette imputation.');
    }
    this.acces.assertArrivee(await this.acces.contexte(actor), a, 'CONTENU');
    if (imp.nature === ImputationNature.AVIS && !dto.compteRendu) {
      throw new BadRequestException('Une imputation pour avis exige l’avis (compte rendu).');
    }
    if (dto.reponseActeId) {
      const reponse = await this.prisma.acteCourrier.findUnique({ where: { id: dto.reponseActeId }, select: { repondAId: true } });
      if (!reponse || reponse.repondAId !== a.id) throw new BadRequestException('Cet acte ne répond pas à ce courrier.');
    }

    await this.prisma.$transaction(async (tx) => {
      const done = await tx.imputationCourrier.updateMany({
        where: { id: imp.id, statut: ImputationStatut.EN_COURS },
        data: {
          statut: ImputationStatut.TRAITEE,
          compteRendu: dto.compteRendu,
          reponseActeId: dto.reponseActeId,
          traiteeAt: new Date(),
          traiteeParId: actor.id,
        },
      });
      if (done.count === 0) throw new ConflictException('Cette imputation est déjà traitée.');
      await recalculerStatutArrivee(tx, a.id);
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'ImputationCourrier', entityId: imp.id, metadata: { event: 'traitement', courrier: a.numero } },
        tx,
      );
    });
    return this.arrivees.findOne(actor, a.id);
  }

  /**
   * « Convertir en tâche » (bouton manuel, modèle D2) — par l'imputant. Un
   * courrier CONFIDENTIEL donne une tâche au titre neutre, SANS instruction
   * recopiée, au palier de confidentialité le plus élevé : la cascade de
   * l'imputé, qui voit ses tâches, ne voit ni l'objet ni les instructions.
   */
  async convertirEnTache(actor: AuthenticatedUser, imputationId: string, dto: ConvertirImputationDto) {
    const imp = await this.chargerImputation(imputationId);
    const a = await this.arrivees.charger(imp.courrierId);
    this.arrivees.assertOuvert(a);
    if (imp.statut !== ImputationStatut.EN_COURS) throw new ConflictException('Cette imputation est déjà traitée.');
    if (!this.cascade.isActingFor(actor, imp.imputeParId)) {
      throw new ForbiddenException('Seul l’auteur de l’imputation peut la convertir en tâche.');
    }
    this.acces.assertArrivee(await this.acces.contexte(actor), a, 'CONTENU');
    const existante = await this.prisma.task.findUnique({ where: { sourceImputationId: imp.id }, select: { id: true } });
    if (existante) throw new ConflictException('Cette imputation a déjà une tâche associée.');
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : imp.echeance;
    if (!dueDate) throw new BadRequestException('Une échéance est obligatoire pour convertir en tâche.');
    const impute = await this.chargerImputeActif(imp.imputeAId);

    const ordinaire = a.confidentialite === CourrierConfidentialite.ORDINAIRE;
    const titre = ordinaire
      ? (dto.titre?.trim() || `Courrier ${a.numero} — ${a.objet ?? ''}`).slice(0, 300)
      : `Traitement du courrier ${a.numero}`;

    let task: { id: string; title: string };
    try {
      task = await this.prisma.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: {
            title: titre,
            description: ordinaire ? imp.instructions : null,
            confidentiality: ordinaire ? TaskConfidentiality.PUBLIC_INTERNE : TaskConfidentiality.TRES_CONFIDENTIEL_DIRIGEANTS,
            dueDate,
            createdById: actor.id,
            sourceImputationId: imp.id,
            divisionId: impute.divisionId,
            sectionId: impute.sectionId,
            celluleId: impute.celluleId,
            assignees: { create: [{ userId: impute.id }] },
          },
          select: { id: true, title: true },
        });
        await this.audit.log(
          { actorId: actor.id, action: AuditAction.CREATION, entityType: 'Task', entityId: created.id, metadata: { sourceImputationId: imp.id, courrier: a.numero } },
          tx,
        );
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cette imputation a déjà une tâche associée.');
      }
      throw error;
    }

    if (impute.id !== actor.id) {
      await this.notifications.notify(impute.id, NotificationType.TACHE_ASSIGNEE, 'Nouvelle tâche assignée', task.title, `/tasks/${task.id}`, task.title);
    }
    return this.arrivees.findOne(actor, a.id);
  }

  // ------------------------------------------------------------------

  private async chargerImputation(id: string) {
    const imp = await this.prisma.imputationCourrier.findUnique({ where: { id } });
    if (!imp) throw new NotFoundException('Imputation introuvable');
    return imp;
  }

  private async chargerImputeActif(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!u) throw new NotFoundException('Personne imputée introuvable');
    if (u.status !== UserStatus.ACTIF) throw new BadRequestException('La personne imputée n’a pas de compte actif.');
    return u;
  }

  private echeanceFuture(iso?: string): Date | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (d.getTime() <= Date.now()) throw new BadRequestException('L’échéance doit être dans le futur.');
    return d;
  }
}


import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  EvaluationFormat,
  EvaluationStageStatut,
  NotificationType,
  PeriodeStageStatut,
  Prisma,
  StageStatut,
  SystemRole,
  UserStatus,
  RoleFonctionnel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { PersonnelHistoryService } from '../personnel/personnel-history.service';
import { UsersService } from '../users/users.service';
import { AttestationService } from './attestation.service';
import { assertReglagesStages, peutReglerStages } from './reglages-stages';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import {
  CapaciteDto,
  CreerStageDto,
  EvaluationDto,
  ModifierPeriodeDto,
  ModifierStageDto,
  PeriodeDto,
} from './dto/stage.dto';
import {
  CRITERES_GRILLE,
  NIVEAUX_GRILLE,
  PERIODE_OCCUPANTE,
  UniteStage,
  chevauche,
  cleUnite,
  clesCapacite,
  jour,
  maximumSimultane,
  periodesDeLaCle,
  uniteDeCle,
} from './unites-stage';
import { estDrh, detenteursWhere } from '../socle/roles-fonctionnels';
import { ReprisesN1Service } from '../socle/reprise-n1.service';

const NOM = { select: { id: true, firstName: true, lastName: true } } as const;

const PERIODE_SELECT = {
  id: true,
  stageId: true,
  ordre: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
  dateDebut: true,
  dateFin: true,
  objectifs: true,
  formatEvaluation: true,
  statut: true,
  tuteurId: true,
  tuteur: NOM,
  motifRefus: true,
  decideeAt: true,
  evaluation: {
    select: {
      id: true,
      redacteurId: true,
      redacteur: NOM,
      criteres: true,
      appreciation: true,
      statut: true,
      motifRenvoi: true,
      soumiseAt: true,
      viseeParId: true,
      viseePar: NOM,
      viseeAt: true,
    },
  },
} satisfies Prisma.PeriodeStageSelect;

const STAGE_SELECT = {
  id: true,
  stagiaireId: true,
  stagiaire: { select: { id: true, firstName: true, lastName: true, status: true, divisionId: true, sectionId: true, celluleId: true } },
  etablissement: true,
  diplomePrepare: true,
  encadrantAcademique: true,
  dateDebut: true,
  dateFin: true,
  statut: true,
  motifInterruption: true,
  clotureAt: true,
  createdAt: true,
  periodes: { select: PERIODE_SELECT, orderBy: { dateDebut: 'asc' } },
} satisfies Prisma.StageSelect;

type StageCharge = Prisma.StageGetPayload<{ select: typeof STAGE_SELECT }>;
type PeriodeChargee = StageCharge['periodes'][number];

/** Niveaux de responsables d'une unité, du plus proche au plus haut. */
interface Niveaux {
  niveaux: string[][];
}

/** Vue de l'acteur sur un stage (null : hors périmètre, 404). */
type Vue = 'STAGIAIRE' | 'DRH' | 'DIRECTION' | 'UNITE';

const STAGE_OUVERT: StageStatut[] = [StageStatut.PREVU, StageStatut.EN_COURS];
const LIEN = (id: string) => `/stages/${id}`;

/**
 * Rotation des stagiaires (D6, §4.12). Toute l'autorisation est ici :
 * - DRH : dossier de stage, plan de rotation, capacités d'accueil, clôture ;
 * - responsable de l'unité d'accueil (chef de la Section, sinon de la
 *   Division ; chef de la Cellule ; DN/DNA si le poste est vacant ; son
 *   suppléant en intérim) : accepte ou refuse la période, désigne le tuteur,
 *   vise l'évaluation ;
 * - tuteur : rédige l'évaluation dans le format de la période ;
 * - stagiaire : son plan, ses évaluations une fois visées ;
 * - DN/DNA : tous les stages, évaluations visées.
 * Le passage d'une unité à l'autre est appliqué par StagesRotationService.
 */
@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly history: PersonnelHistoryService,
    private readonly users: UsersService,
    private readonly attestation: AttestationService,
    private readonly reprise: ReprisesN1Service,
  ) {}

  // --------------------------------------------------------------------
  // Lecture
  // --------------------------------------------------------------------

  async list(actor: AuthenticatedUser) {
    const stages = await this.prisma.stage.findMany({ select: STAGE_SELECT, orderBy: { dateDebut: 'desc' } });
    const niveaux = new Map<string, Niveaux>();
    const out = [];
    for (const s of stages) {
      const vue = await this.vue(actor, s, niveaux);
      if (!vue) continue;
      out.push({
        id: s.id,
        statut: s.statut,
        etablissement: s.etablissement,
        dateDebut: s.dateDebut,
        dateFin: s.dateFin,
        stagiaire: { id: s.stagiaire.id, firstName: s.stagiaire.firstName, lastName: s.stagiaire.lastName },
        periodeEnCours: s.periodes.find((p) => p.statut === PeriodeStageStatut.EN_COURS) ?? null,
        aTraiter: await this.aTraiter(actor, s, niveaux),
      });
    }
    return { peutCreer: estDrh(actor), stages: out.map((s) => ({ ...s, periodeEnCours: s.periodeEnCours && this.resumePeriode(s.periodeEnCours) })) };
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const stage = await this.charger(id);
    const niveaux = new Map<string, Niveaux>();
    const vue = await this.vue(actor, stage, niveaux);
    if (!vue) throw new NotFoundException('Stage introuvable');
    return this.presenter(actor, stage, vue, niveaux);
  }

  /** Comptes que creer() accepte : stagiaires actifs sans stage prévu ou en cours. */
  async stagiairesDisponibles(actor: AuthenticatedUser) {
    this.assertDrh(actor);
    return this.prisma.user.findMany({
      where: { role: SystemRole.STAGIAIRE, status: UserStatus.ACTIF, stagesSuivis: { none: { statut: { in: STAGE_OUVERT } } } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /** Personnes que accepter/changerTuteur accepteraient comme tuteur. */
  async tuteursPossibles(actor: AuthenticatedUser, stageId: string, periodeId: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    await this.assertResponsable(actor, periode, new Map());
    return this.candidatsTuteur(stage, periode);
  }

  /**
   * Capacités d'accueil seules, sans aucun contenu de stage : DRH et
   * administrateur système (qui les modifient), DN/DNA (lecture). `voitPlanning`
   * dit à l'écran s'il peut aussi demander le planning (DRH et Direction).
   */
  async capacites(actor: AuthenticatedUser) {
    const lecture = peutReglerStages(actor) || actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    if (!lecture) throw new ForbiddenException('Réservé au DRH, à la Direction et à l’administrateur système.');
    const capacites = await this.prisma.capaciteAccueil.findMany({ orderBy: { uniteKey: 'asc' } });
    return {
      peutModifier: peutReglerStages(actor),
      voitPlanning: actor.role !== SystemRole.ADMIN_SYSTEME,
      capacites: await Promise.all(capacites.map(async (c) => ({ uniteKey: c.uniteKey, maximum: c.maximum, libelle: await this.libelleCle(c.uniteKey) }))),
    };
  }

  /** Planning (DRH, DN/DNA) : périodes occupantes dans une fenêtre, capacités. */
  async planning(actor: AuthenticatedUser, debut?: string, fin?: string) {
    this.assertDrhOuDirection(actor);
    const d = jour(debut ? new Date(debut) : new Date());
    const f = fin ? jour(new Date(fin)) : new Date(d.getTime() + 90 * 24 * 3600 * 1000);
    const periodes = await this.prisma.periodeStage.findMany({
      where: { statut: { in: PERIODE_OCCUPANTE }, dateDebut: { lte: f }, dateFin: { gte: d } },
      select: { ...PERIODE_SELECT, evaluation: false, stage: { select: { id: true, stagiaire: NOM } } },
      orderBy: { dateDebut: 'asc' },
    });
    const capacites = await this.prisma.capaciteAccueil.findMany({ orderBy: { uniteKey: 'asc' } });
    return {
      debut: d,
      fin: f,
      peutFixerCapacites: peutReglerStages(actor),
      capacites: await Promise.all(capacites.map(async (c) => ({ ...c, libelle: await this.libelleCle(c.uniteKey) }))),
      periodes: await Promise.all(
        periodes.map(async (p) => ({
          ...this.resumePeriode(p),
          uniteKey: cleUnite(p),
          unite: await this.history.describeAttachment(p),
          stageId: p.stage.id,
          stagiaire: p.stage.stagiaire,
          tuteur: p.tuteur,
        })),
      ),
    };
  }

  // --------------------------------------------------------------------
  // DRH : stage, plan, capacités
  // --------------------------------------------------------------------

  async creer(actor: AuthenticatedUser, dto: CreerStageDto) {
    this.assertDrh(actor);
    const [dateDebut, dateFin] = this.intervalle(dto.dateDebut, dto.dateFin);
    const stagiaire = await this.prisma.user.findUnique({ where: { id: dto.stagiaireId }, select: { id: true, role: true, status: true } });
    if (!stagiaire) throw new NotFoundException('Stagiaire introuvable');
    if (stagiaire.role !== SystemRole.STAGIAIRE) throw new ConflictException('Ce compte n’a pas le rôle Stagiaire.');
    if (stagiaire.status !== UserStatus.ACTIF) throw new ConflictException('Le compte du stagiaire n’est pas actif.');
    const ouvert = await this.prisma.stage.findFirst({ where: { stagiaireId: stagiaire.id, statut: { in: STAGE_OUVERT } } });
    if (ouvert) throw new ConflictException('Ce stagiaire a déjà un stage prévu ou en cours.');
    const stage = await this.prisma.stage.create({
      data: {
        stagiaireId: stagiaire.id,
        etablissement: dto.etablissement.trim(),
        diplomePrepare: dto.diplomePrepare?.trim(),
        encadrantAcademique: dto.encadrantAcademique?.trim(),
        dateDebut,
        dateFin,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Stage', entityId: stage.id, metadata: { stagiaireId: stagiaire.id, dateDebut, dateFin } });
    // Socle NIMBA : la fin prévue de l'agent stagiaire suit le stage (alertes J-15 / J-3).
    await this.reprise.synchroniserCompte(stagiaire.id);
    return this.findOne(actor, stage.id);
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierStageDto) {
    this.assertDrh(actor);
    const stage = await this.charger(id);
    this.assertStageOuvert(stage);
    const [dateDebut, dateFin] = this.intervalle(dto.dateDebut ?? stage.dateDebut, dto.dateFin ?? stage.dateFin);
    const hors = stage.periodes.filter((p) => PERIODE_OCCUPANTE.includes(p.statut) && (p.dateDebut < dateDebut || p.dateFin > dateFin));
    if (hors.length) throw new ConflictException('Des périodes du plan sortiraient des dates du stage : déplacez-les d’abord.');
    await this.prisma.stage.update({
      where: { id },
      data: {
        etablissement: dto.etablissement?.trim(),
        diplomePrepare: dto.diplomePrepare?.trim(),
        encadrantAcademique: dto.encadrantAcademique?.trim(),
        dateDebut,
        dateFin,
      },
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Stage', entityId: id, metadata: { avant: this.resumeStage(stage), apres: { ...dto } } });
    return this.findOne(actor, id);
  }

  async ajouterPeriode(actor: AuthenticatedUser, stageId: string, dto: PeriodeDto) {
    this.assertDrh(actor);
    const unite = await this.uniteValide(dto);
    const [dateDebut, dateFin] = this.intervalle(dto.dateDebut, dto.dateFin);
    const periodeId = await this.prisma.$transaction(async (tx) => {
      const stage = await this.verrouillerStage(tx, stageId);
      this.assertDansLeStage(stage, dateDebut, dateFin);
      await this.assertSansChevauchement(tx, stageId, dateDebut, dateFin, null);
      await this.assertCapacite(tx, unite, dateDebut, dateFin, null);
      const p = await tx.periodeStage.create({
        data: { stageId, ordre: 0, ...unite, dateDebut, dateFin, formatEvaluation: dto.formatEvaluation, objectifs: dto.objectifs?.trim() || null },
        select: { id: true },
      });
      await this.renumeroter(tx, stageId);
      return p.id;
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { stageId, uniteKey: cleUnite(unite), dateDebut, dateFin, formatEvaluation: dto.formatEvaluation } });
    await this.notifierAAccepter(stageId, periodeId);
    return this.findOne(actor, stageId);
  }

  async modifierPeriode(actor: AuthenticatedUser, stageId: string, periodeId: string, dto: ModifierPeriodeDto) {
    this.assertDrh(actor);
    const { periode } = await this.chargerPeriode(stageId, periodeId);
    const avant = this.resumePeriode(periode);
    let aReaccepter = false;
    let uniteChangee = false;
    await this.prisma.$transaction(async (tx) => {
      const stage = await this.verrouillerStage(tx, stageId);
      const p = (await tx.periodeStage.findUnique({ where: { id: periodeId }, include: { evaluation: true } }))!;
      if (p.statut === PeriodeStageStatut.EN_COURS) {
        // Période commencée : seule la date de fin se modifie, avec un motif.
        const autres = Object.entries(dto).filter(([k, v]) => v !== undefined && k !== 'dateFin' && k !== 'motif');
        if (autres.length || !dto.dateFin) throw new ConflictException('Une période commencée ne peut changer que de date de fin.');
        if (!dto.motif) throw new BadRequestException('Un motif est obligatoire pour modifier une période commencée.');
        const [, dateFin] = this.intervalle(p.dateDebut, dto.dateFin);
        if (dateFin < jour(new Date())) throw new ConflictException('La nouvelle date de fin est déjà passée.');
        this.assertDansLeStage(stage, p.dateDebut, dateFin);
        await this.assertSansChevauchement(tx, stageId, p.dateDebut, dateFin, periodeId);
        await this.assertCapacite(tx, p, p.dateDebut, dateFin, periodeId);
        await tx.periodeStage.update({ where: { id: periodeId }, data: { dateFin } });
        return;
      }
      if (p.statut !== PeriodeStageStatut.PROPOSEE && p.statut !== PeriodeStageStatut.ACCEPTEE && p.statut !== PeriodeStageStatut.REFUSEE) {
        throw new ConflictException('Cette période est terminée ou annulée.');
      }
      const uniteSaisie = dto.divisionId !== undefined || dto.sectionId !== undefined || dto.celluleId !== undefined;
      const unite = uniteSaisie ? await this.uniteValide(dto) : { divisionId: p.divisionId, sectionId: p.sectionId, celluleId: p.celluleId };
      const [dateDebut, dateFin] = this.intervalle(dto.dateDebut ?? p.dateDebut, dto.dateFin ?? p.dateFin);
      this.assertDansLeStage(stage, dateDebut, dateFin);
      await this.assertSansChevauchement(tx, stageId, dateDebut, dateFin, periodeId);
      await this.assertCapacite(tx, unite, dateDebut, dateFin, periodeId);
      uniteChangee = cleUnite(unite) !== cleUnite(p);
      const datesChangees = dateDebut.getTime() !== p.dateDebut.getTime() || dateFin.getTime() !== p.dateFin.getTime();
      aReaccepter = (uniteChangee || datesChangees) && p.statut !== PeriodeStageStatut.PROPOSEE;
      await tx.periodeStage.update({
        where: { id: periodeId },
        data: {
          ...unite,
          dateDebut,
          dateFin,
          objectifs: dto.objectifs !== undefined ? dto.objectifs.trim() || null : undefined,
          formatEvaluation: dto.formatEvaluation,
          ...(aReaccepter ? { statut: PeriodeStageStatut.PROPOSEE, motifRefus: null, decideeParId: null, decideeAt: null } : {}),
          ...(uniteChangee ? { tuteurId: null } : {}),
        },
      });
      await this.renumeroter(tx, stageId);
    });
    const apres = await this.chargerPeriode(stageId, periodeId);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { avant, apres: this.resumePeriode(apres.periode), motif: dto.motif ?? null } });
    if (aReaccepter || (uniteChangee && periode.statut === PeriodeStageStatut.PROPOSEE)) await this.notifierAAccepter(stageId, periodeId);
    else await this.notifierPlanModifie(apres.stage, apres.periode, 'La période a été modifiée.');
    return this.findOne(actor, stageId);
  }

  async annulerPeriode(actor: AuthenticatedUser, stageId: string, periodeId: string) {
    this.assertDrh(actor);
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertStageOuvert(stage);
    const ok = await this.prisma.periodeStage.updateMany({
      where: { id: periodeId, statut: { in: [PeriodeStageStatut.PROPOSEE, PeriodeStageStatut.ACCEPTEE, PeriodeStageStatut.REFUSEE] } },
      data: { statut: PeriodeStageStatut.ANNULEE },
    });
    if (ok.count === 0) throw new ConflictException('Seule une période qui n’a pas commencé peut être retirée du plan.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { event: 'annulee', periode: this.resumePeriode(periode) } });
    await this.notifierPlanModifie(stage, periode, 'Cette période a été retirée du plan de rotation.');
    return this.findOne(actor, stageId);
  }

  async fixerCapacite(actor: AuthenticatedUser, dto: CapaciteDto) {
    assertReglagesStages(actor);
    const unite = uniteDeCle(dto.uniteKey);
    if (!unite) throw new BadRequestException('Unité invalide.');
    await this.uniteExistante(unite, dto.uniteKey);
    const avant = await this.prisma.capaciteAccueil.findUnique({ where: { uniteKey: dto.uniteKey } });
    if (dto.maximum === null) {
      if (avant) await this.prisma.capaciteAccueil.delete({ where: { uniteKey: dto.uniteKey } });
    } else {
      await this.prisma.capaciteAccueil.upsert({
        where: { uniteKey: dto.uniteKey },
        create: { uniteKey: dto.uniteKey, maximum: dto.maximum, fixeeParId: actor.id },
        update: { maximum: dto.maximum, fixeeParId: actor.id },
      });
    }
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'CapaciteAccueil', entityId: dto.uniteKey, metadata: { avant: avant?.maximum ?? null, apres: dto.maximum } });
    return { uniteKey: dto.uniteKey, maximum: dto.maximum, libelle: await this.libelleCle(dto.uniteKey) };
  }

  async cloturer(actor: AuthenticatedUser, id: string) {
    this.assertDrh(actor);
    const stage = await this.charger(id);
    this.assertStageOuvert(stage);
    const nonTerminees = stage.periodes.filter((p) => p.statut === PeriodeStageStatut.PROPOSEE || p.statut === PeriodeStageStatut.ACCEPTEE || p.statut === PeriodeStageStatut.EN_COURS);
    if (nonTerminees.length) throw new ConflictException('Des périodes ne sont pas terminées : attendez leur fin ou interrompez le stage.');
    await this.prisma.stage.update({ where: { id }, data: { statut: StageStatut.TERMINE, clotureAt: new Date() } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'Stage', entityId: id, metadata: { event: 'cloture' } });
    return this.findOne(actor, id);
  }

  async interrompre(actor: AuthenticatedUser, id: string, motif: string) {
    this.assertDrh(actor);
    const stage = await this.charger(id);
    this.assertStageOuvert(stage);
    const aujourdhui = jour(new Date());
    await this.prisma.$transaction(async (tx) => {
      await this.verrouillerStage(tx, id);
      for (const p of stage.periodes) {
        if (p.statut === PeriodeStageStatut.EN_COURS) {
          await tx.periodeStage.update({ where: { id: p.id }, data: { statut: PeriodeStageStatut.TERMINEE, dateFin: p.dateFin < aujourdhui ? p.dateFin : aujourdhui } });
        } else if (p.statut === PeriodeStageStatut.PROPOSEE || p.statut === PeriodeStageStatut.ACCEPTEE) {
          await tx.periodeStage.update({ where: { id: p.id }, data: { statut: PeriodeStageStatut.ANNULEE } });
        }
      }
      await tx.stage.update({ where: { id }, data: { statut: StageStatut.INTERROMPU, motifInterruption: motif.trim(), clotureAt: new Date() } });
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Stage', entityId: id, metadata: { event: 'interrompu', motif } });
    const destinataires = new Set<string>([stage.stagiaireId]);
    for (const p of stage.periodes) {
      if (p.tuteurId && (p.statut === PeriodeStageStatut.EN_COURS || p.statut === PeriodeStageStatut.ACCEPTEE)) destinataires.add(p.tuteurId);
    }
    await this.notifications.notifyMany([...destinataires], NotificationType.STAGE_PLAN_MODIFIE, 'Stage interrompu', `Le stage de ${this.nom(stage.stagiaire)} a été interrompu.`, LIEN(id));
    return this.findOne(actor, id);
  }

  // --------------------------------------------------------------------
  // Responsable de l'unité : acceptation, tuteur, visa
  // --------------------------------------------------------------------

  async accepter(actor: AuthenticatedUser, stageId: string, periodeId: string, tuteurId: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertStageOuvert(stage);
    await this.assertResponsable(actor, periode, new Map());
    if (periode.statut !== PeriodeStageStatut.PROPOSEE) throw new ConflictException('Cette période a déjà été acceptée ou refusée.');
    await this.assertTuteurPossible(stage, periode, tuteurId);
    const ok = await this.prisma.periodeStage.updateMany({
      where: { id: periodeId, statut: PeriodeStageStatut.PROPOSEE },
      data: { statut: PeriodeStageStatut.ACCEPTEE, tuteurId, decideeParId: actor.id, decideeAt: new Date() },
    });
    if (ok.count === 0) throw new ConflictException('Cette période a déjà été acceptée ou refusée.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { event: 'acceptee', tuteurId } });
    await this.notifications.notify(tuteurId, NotificationType.STAGE_PLAN_MODIFIE, 'Vous êtes tuteur d’un stagiaire', `${this.nom(stage.stagiaire)} — ${this.dates(periode)}`, LIEN(stageId));
    return this.findOne(actor, stageId);
  }

  async refuser(actor: AuthenticatedUser, stageId: string, periodeId: string, motif: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertStageOuvert(stage);
    await this.assertResponsable(actor, periode, new Map());
    const ok = await this.prisma.periodeStage.updateMany({
      where: { id: periodeId, statut: PeriodeStageStatut.PROPOSEE },
      data: { statut: PeriodeStageStatut.REFUSEE, motifRefus: motif.trim(), decideeParId: actor.id, decideeAt: new Date() },
    });
    if (ok.count === 0) throw new ConflictException('Cette période a déjà été acceptée ou refusée.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { event: 'refusee', motif } });
    await this.notifierDrh(NotificationType.STAGE_PERIODE_REFUSEE, 'Période de stage refusée', `${this.nom(stage.stagiaire)} — ${await this.history.describeAttachment(periode)} (${this.dates(periode)}) : ${motif.trim()}`, stageId);
    return this.findOne(actor, stageId);
  }

  async changerTuteur(actor: AuthenticatedUser, stageId: string, periodeId: string, tuteurId: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertStageOuvert(stage);
    await this.assertResponsable(actor, periode, new Map());
    if (periode.statut !== PeriodeStageStatut.ACCEPTEE && periode.statut !== PeriodeStageStatut.EN_COURS && periode.statut !== PeriodeStageStatut.TERMINEE) {
      throw new ConflictException('Le tuteur se désigne en acceptant la période.');
    }
    const ev = periode.evaluation;
    if (ev && (ev.statut === EvaluationStageStatut.SOUMISE || ev.statut === EvaluationStageStatut.VISEE)) {
      throw new ConflictException('L’évaluation est déjà soumise : le tuteur ne peut plus changer.');
    }
    await this.assertTuteurPossible(stage, periode, tuteurId);
    await this.prisma.$transaction([
      this.prisma.periodeStage.update({ where: { id: periodeId }, data: { tuteurId } }),
      // Brouillon repris par le nouveau tuteur.
      ...(ev ? [this.prisma.evaluationStage.update({ where: { id: ev.id }, data: { redacteurId: tuteurId } })] : []),
    ]);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { event: 'tuteur_change', avant: periode.tuteurId, apres: tuteurId } });
    await this.notifications.notify(tuteurId, NotificationType.STAGE_PLAN_MODIFIE, 'Vous êtes tuteur d’un stagiaire', `${this.nom(stage.stagiaire)} — ${this.dates(periode)}`, LIEN(stageId));
    return this.findOne(actor, stageId);
  }

  // --------------------------------------------------------------------
  // Évaluation (tuteur, puis visa)
  // --------------------------------------------------------------------

  async changerFormat(actor: AuthenticatedUser, stageId: string, periodeId: string, format: EvaluationFormat) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertStageOuvert(stage);
    const tuteur = !!periode.tuteurId && this.cascade.isActingFor(actor, periode.tuteurId);
    if (!tuteur && !estDrh(actor)) throw new ForbiddenException('Seuls le tuteur et le DRH choisissent le format de l’évaluation.');
    if (periode.evaluation) throw new ConflictException('L’évaluation est commencée : son format ne change plus.');
    if (periode.statut === PeriodeStageStatut.TERMINEE || periode.statut === PeriodeStageStatut.ANNULEE || periode.statut === PeriodeStageStatut.REFUSEE) {
      throw new ConflictException('Cette période est close.');
    }
    await this.prisma.periodeStage.update({ where: { id: periodeId }, data: { formatEvaluation: format } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'PeriodeStage', entityId: periodeId, metadata: { event: 'format_evaluation', avant: periode.formatEvaluation, apres: format } });
    return this.findOne(actor, stageId);
  }

  async enregistrerEvaluation(actor: AuthenticatedUser, stageId: string, periodeId: string, dto: EvaluationDto) {
    const { periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertPeutRediger(actor, periode);
    const criteres = dto.criteres !== undefined ? this.criteresValides(dto.criteres, false) : undefined;
    const data = {
      ...(criteres !== undefined ? { criteres } : {}),
      ...(dto.appreciation !== undefined ? { appreciation: dto.appreciation.trim() || null } : {}),
    };
    if (periode.evaluation) {
      await this.prisma.evaluationStage.update({ where: { id: periode.evaluation.id }, data });
    } else {
      await this.prisma.evaluationStage.create({ data: { periodeId, redacteurId: periode.tuteurId!, ...data } });
    }
    return this.findOne(actor, stageId);
  }

  async soumettreEvaluation(actor: AuthenticatedUser, stageId: string, periodeId: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    this.assertPeutRediger(actor, periode);
    const ev = periode.evaluation;
    if (!ev) throw new ConflictException('L’évaluation est vide.');
    if (periode.formatEvaluation === EvaluationFormat.GRILLE) this.criteresValides(ev.criteres, true);
    if (!ev.appreciation?.trim()) throw new BadRequestException('L’appréciation est obligatoire.');
    const ok = await this.prisma.evaluationStage.updateMany({
      where: { id: ev.id, statut: { in: [EvaluationStageStatut.BROUILLON, EvaluationStageStatut.RENVOYEE] } },
      data: { statut: EvaluationStageStatut.SOUMISE, soumiseAt: new Date(), motifRenvoi: null },
    });
    if (ok.count === 0) throw new ConflictException('L’évaluation est déjà soumise.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'EvaluationStage', entityId: ev.id, metadata: { event: 'soumise' } });
    const viseurs = await this.viseurs(periode, ev.redacteurId);
    await this.notifications.notifyMany(viseurs, NotificationType.STAGE_EVALUATION_A_VISER, 'Évaluation de stage à viser', `${this.nom(stage.stagiaire)} — ${this.dates(periode)}`, LIEN(stageId));
    return this.findOne(actor, stageId);
  }

  async viserEvaluation(actor: AuthenticatedUser, stageId: string, periodeId: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    const ev = periode.evaluation;
    if (!ev) throw new NotFoundException('Évaluation introuvable');
    await this.assertViseur(actor, periode, ev.redacteurId);
    const ok = await this.prisma.evaluationStage.updateMany({
      where: { id: ev.id, statut: EvaluationStageStatut.SOUMISE },
      data: { statut: EvaluationStageStatut.VISEE, viseeParId: actor.id, viseeAt: new Date() },
    });
    if (ok.count === 0) throw new ConflictException('Seule une évaluation soumise peut être visée.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'EvaluationStage', entityId: ev.id, metadata: { event: 'visee' } });
    await this.notifications.notifyMany([stage.stagiaireId, ev.redacteurId], NotificationType.STAGE_EVALUATION_VISEE, 'Évaluation de stage visée', `${await this.history.describeAttachment(periode)} — ${this.dates(periode)}`, LIEN(stageId));
    return this.findOne(actor, stageId);
  }

  async renvoyerEvaluation(actor: AuthenticatedUser, stageId: string, periodeId: string, motif: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    const ev = periode.evaluation;
    if (!ev) throw new NotFoundException('Évaluation introuvable');
    await this.assertViseur(actor, periode, ev.redacteurId);
    const ok = await this.prisma.evaluationStage.updateMany({
      where: { id: ev.id, statut: EvaluationStageStatut.SOUMISE },
      data: { statut: EvaluationStageStatut.RENVOYEE, motifRenvoi: motif.trim() },
    });
    if (ok.count === 0) throw new ConflictException('Seule une évaluation soumise peut être renvoyée.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'EvaluationStage', entityId: ev.id, metadata: { event: 'renvoyee', motif } });
    await this.notifications.notify(ev.redacteurId, NotificationType.STAGE_EVALUATION_RENVOYEE, 'Évaluation de stage renvoyée', `${this.nom(stage.stagiaire)} : ${motif.trim()}`, LIEN(stageId));
    return this.findOne(actor, stageId);
  }

  // --------------------------------------------------------------------
  // Règles partagées (exposées au job de rotation et au changement de rôle)
  // --------------------------------------------------------------------

  /** Responsables d'une unité par niveau (le plus proche d'abord) : chef de
   * Section, chef de Division, DN/DNA ; ou chef de Cellule, DN/DNA. Comptes
   * actifs seulement. */
  async niveauxResponsables(u: UniteStage, cache: Map<string, Niveaux> = new Map()): Promise<Niveaux> {
    const cle = cleUnite(u);
    const deja = cache.get(cle);
    if (deja) return deja;
    const actifs = { status: UserStatus.ACTIF };
    const ids = async (where: Prisma.UserWhereInput) => (await this.prisma.user.findMany({ where: { ...where, ...actifs }, select: { id: true } })).map((x) => x.id);
    const niveaux: string[][] = [];
    if (u.celluleId) {
      const cellule = await this.prisma.cellule.findUnique({ where: { id: u.celluleId }, select: { chefId: true } });
      const chefs = new Set(await ids({ role: SystemRole.CHEF_CELLULE, celluleId: u.celluleId }));
      if (cellule?.chefId && (await ids({ id: cellule.chefId })).length) chefs.add(cellule.chefId);
      niveaux.push([...chefs]);
    } else {
      const divisionId = u.divisionId ?? (u.sectionId ? (await this.prisma.section.findUnique({ where: { id: u.sectionId }, select: { divisionId: true } }))?.divisionId : null);
      if (u.sectionId) niveaux.push(await ids({ role: SystemRole.CHEF_SECTION, sectionId: u.sectionId }));
      if (divisionId) niveaux.push(await ids({ role: SystemRole.CHEF_DIVISION, divisionId }));
    }
    niveaux.push(await ids({ role: { in: [SystemRole.DN, SystemRole.DNA] } }));
    const r = { niveaux };
    cache.set(cle, r);
    return r;
  }

  /** Responsables d'acceptation : le premier niveau occupé. */
  async responsables(u: UniteStage, cache?: Map<string, Niveaux>): Promise<string[]> {
    return (await this.niveauxResponsables(u, cache)).niveaux.find((n) => n.length > 0) ?? [];
  }

  /** Viseurs d'une évaluation : le premier niveau occupé par quelqu'un d'autre
   * que son rédacteur (jamais de visa de sa propre évaluation). */
  async viseurs(u: UniteStage, redacteurId: string, cache?: Map<string, Niveaux>): Promise<string[]> {
    for (const n of (await this.niveauxResponsables(u, cache)).niveaux) {
      const autres = n.filter((id) => id !== redacteurId);
      if (autres.length) return autres;
    }
    return [];
  }

  /** Stage prévu ou en cours d'une personne (changement de rôle). */
  aUnStageOuvert(userId: string) {
    return this.prisma.stage.findFirst({ where: { stagiaireId: userId, statut: { in: STAGE_OUVERT } }, select: { id: true } });
  }

  // --------------------------------------------------------------------
  // Interne
  // --------------------------------------------------------------------

  private agitPour(actor: AuthenticatedUser, ids: string[]): boolean {
    return ids.some((id) => this.cascade.isActingFor(actor, id));
  }

  private async estResponsable(actor: AuthenticatedUser, u: UniteStage, cache: Map<string, Niveaux>): Promise<boolean> {
    return this.agitPour(actor, await this.responsables(u, cache));
  }

  private async assertResponsable(actor: AuthenticatedUser, u: UniteStage, cache: Map<string, Niveaux>) {
    if (!(await this.estResponsable(actor, u, cache))) {
      throw new ForbiddenException('Seul le responsable de l’unité d’accueil (ou son suppléant en intérim) peut décider de cette période.');
    }
  }

  private async assertViseur(actor: AuthenticatedUser, periode: PeriodeChargee, redacteurId: string) {
    if (this.cascade.isActingFor(actor, redacteurId) || !this.agitPour(actor, await this.viseurs(periode, redacteurId))) {
      throw new ForbiddenException('Seul le responsable de l’unité d’accueil vise l’évaluation (jamais son rédacteur).');
    }
  }

  private assertPeutRediger(actor: AuthenticatedUser, periode: PeriodeChargee) {
    if (!periode.tuteurId || !this.cascade.isActingFor(actor, periode.tuteurId)) {
      throw new ForbiddenException('Seul le tuteur de la période rédige son évaluation.');
    }
    if (periode.formatEvaluation === EvaluationFormat.AUCUNE) throw new ConflictException('Cette période n’a pas d’évaluation.');
    if (periode.statut !== PeriodeStageStatut.EN_COURS && periode.statut !== PeriodeStageStatut.TERMINEE) {
      throw new ConflictException('L’évaluation se rédige à partir du début de la période.');
    }
    const ev = periode.evaluation;
    if (ev && ev.statut !== EvaluationStageStatut.BROUILLON && ev.statut !== EvaluationStageStatut.RENVOYEE) {
      throw new ConflictException('L’évaluation est soumise ou visée : elle ne se modifie plus.');
    }
  }

  private criteresValides(valeur: unknown, complet: boolean): Prisma.InputJsonValue {
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) {
      if (complet) throw new BadRequestException('La grille doit noter les 4 critères.');
      return {};
    }
    const entrees = Object.entries(valeur as Record<string, unknown>);
    for (const [k, v] of entrees) {
      if (!(CRITERES_GRILLE as readonly string[]).includes(k)) throw new BadRequestException(`Critère inconnu : ${k}.`);
      if (!(NIVEAUX_GRILLE as readonly string[]).includes(String(v))) throw new BadRequestException(`Niveau invalide pour ${k}.`);
    }
    if (complet && CRITERES_GRILLE.some((k) => !(valeur as Record<string, unknown>)[k])) {
      throw new BadRequestException('La grille doit noter les 4 critères.');
    }
    return Object.fromEntries(entrees) as Prisma.InputJsonValue;
  }

  private async candidatsTuteur(stage: StageCharge, periode: UniteStage) {
    const membre: Prisma.UserWhereInput = periode.celluleId
      ? { celluleId: periode.celluleId }
      : periode.sectionId
        ? { sectionId: periode.sectionId }
        : { divisionId: periode.divisionId };
    const responsables = await this.responsables(periode);
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIF,
        role: { not: SystemRole.STAGIAIRE },
        id: { not: stage.stagiaireId },
        OR: [membre, { id: { in: responsables } }],
      },
      select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return users;
  }

  private async assertTuteurPossible(stage: StageCharge, periode: UniteStage, tuteurId: string) {
    const ok = (await this.candidatsTuteur(stage, periode)).some((u) => u.id === tuteurId);
    if (!ok) throw new ForbiddenException('Le tuteur doit être un membre actif de l’unité d’accueil (ou son responsable), jamais le stagiaire.');
  }

  private async vue(actor: AuthenticatedUser, s: StageCharge, cache: Map<string, Niveaux>): Promise<Vue | null> {
    if (actor.id === s.stagiaireId) return 'STAGIAIRE';
    if (estDrh(actor)) return 'DRH';
    if (actor.role === SystemRole.DN || actor.role === SystemRole.DNA) return 'DIRECTION';
    for (const p of s.periodes) {
      if (p.tuteurId && this.cascade.isActingFor(actor, p.tuteurId)) return 'UNITE';
      // Toute la chaîne des chefs de l'unité d'accueil lit le plan (seul le
      // premier niveau occupé décide : estResponsable).
      if (this.agitPour(actor, (await this.niveauxResponsables(p, cache)).niveaux.flat())) return 'UNITE';
      if (p.evaluation && this.agitPour(actor, await this.viseurs(p, p.evaluation.redacteurId, cache))) return 'UNITE';
    }
    return null;
  }

  private async aTraiter(actor: AuthenticatedUser, s: StageCharge, cache: Map<string, Niveaux>): Promise<number> {
    let n = 0;
    for (const p of s.periodes) {
      if (p.statut === PeriodeStageStatut.PROPOSEE && (await this.estResponsable(actor, p, cache))) n++;
      const ev = p.evaluation;
      if (ev?.statut === EvaluationStageStatut.SOUMISE && this.agitPour(actor, await this.viseurs(p, ev.redacteurId, cache))) n++;
      const redaction = (p.statut === PeriodeStageStatut.EN_COURS || p.statut === PeriodeStageStatut.TERMINEE) && p.formatEvaluation !== EvaluationFormat.AUCUNE;
      if (redaction && p.tuteurId && this.cascade.isActingFor(actor, p.tuteurId) && (!ev || ev.statut === EvaluationStageStatut.BROUILLON || ev.statut === EvaluationStageStatut.RENVOYEE)) n++;
    }
    return n;
  }

  private async presenter(actor: AuthenticatedUser, s: StageCharge, vue: Vue, cache: Map<string, Niveaux>) {
    const drh = vue === 'DRH';
    const ouvert = STAGE_OUVERT.includes(s.statut);
    const periodes = [];
    for (const p of s.periodes) {
      const tuteur = !!p.tuteurId && this.cascade.isActingFor(actor, p.tuteurId);
      const responsable = await this.estResponsable(actor, p, cache);
      const ev = p.evaluation;
      const viseur = !!ev && !this.cascade.isActingFor(actor, ev.redacteurId) && this.agitPour(actor, await this.viseurs(p, ev.redacteurId, cache));
      const concerne = vue !== 'UNITE' || tuteur || responsable || viseur;
      let evaluation = null;
      if (ev) {
        const visible =
          tuteur ||
          ((responsable || viseur || drh) && ev.statut !== EvaluationStageStatut.BROUILLON) ||
          ((vue === 'DIRECTION' || vue === 'STAGIAIRE') && ev.statut === EvaluationStageStatut.VISEE);
        if (visible) evaluation = { ...ev, redacteur: ev.redacteur, viseePar: ev.viseePar };
      }
      const redaction = (p.statut === PeriodeStageStatut.EN_COURS || p.statut === PeriodeStageStatut.TERMINEE) && p.formatEvaluation !== EvaluationFormat.AUCUNE;
      const brouillon = !ev || ev.statut === EvaluationStageStatut.BROUILLON || ev.statut === EvaluationStageStatut.RENVOYEE;
      const avantDebut = p.statut === PeriodeStageStatut.PROPOSEE || p.statut === PeriodeStageStatut.ACCEPTEE || p.statut === PeriodeStageStatut.REFUSEE;
      periodes.push({
        ...this.resumePeriode(p),
        unite: await this.history.describeAttachment(p),
        uniteKey: cleUnite(p),
        objectifs: concerne ? p.objectifs : null,
        tuteur: p.tuteur,
        motifRefus: concerne ? p.motifRefus : null,
        responsables: await this.noms(await this.responsables(p, cache)),
        evaluation,
        droits: {
          modifier: drh && ouvert && (avantDebut || p.statut === PeriodeStageStatut.EN_COURS),
          annuler: drh && ouvert && avantDebut,
          accepter: responsable && ouvert && p.statut === PeriodeStageStatut.PROPOSEE,
          refuser: responsable && ouvert && p.statut === PeriodeStageStatut.PROPOSEE,
          changerTuteur:
            responsable && ouvert &&
            (p.statut === PeriodeStageStatut.ACCEPTEE || p.statut === PeriodeStageStatut.EN_COURS || p.statut === PeriodeStageStatut.TERMINEE) &&
            (!ev || brouillon),
          changerFormat: (tuteur || drh) && ouvert && !ev && (p.statut === PeriodeStageStatut.PROPOSEE || p.statut === PeriodeStageStatut.ACCEPTEE || p.statut === PeriodeStageStatut.EN_COURS),
          rediger: tuteur && redaction && brouillon,
          viser: viseur && ev?.statut === EvaluationStageStatut.SOUMISE,
        },
      });
    }
    return {
      id: s.id,
      vue,
      statut: s.statut,
      stagiaire: { id: s.stagiaire.id, firstName: s.stagiaire.firstName, lastName: s.stagiaire.lastName, status: s.stagiaire.status },
      rattachementActuel: await this.history.describeAttachment(s.stagiaire),
      etablissement: s.etablissement,
      diplomePrepare: s.diplomePrepare,
      encadrantAcademique: s.encadrantAcademique,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      motifInterruption: s.motifInterruption,
      clotureAt: s.clotureAt,
      periodes,
      attestation: await this.attestation.etat(actor, s.id, vue),
      droits: {
        modifier: drh && ouvert,
        ajouterPeriode: drh && ouvert,
        cloturer: drh && ouvert,
        interrompre: drh && ouvert,
      },
    };
  }

  private resumePeriode(p: Pick<PeriodeChargee, 'id' | 'ordre' | 'divisionId' | 'sectionId' | 'celluleId' | 'dateDebut' | 'dateFin' | 'formatEvaluation' | 'statut'>) {
    return {
      id: p.id,
      ordre: p.ordre,
      divisionId: p.divisionId,
      sectionId: p.sectionId,
      celluleId: p.celluleId,
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
      formatEvaluation: p.formatEvaluation,
      statut: p.statut,
    };
  }

  private resumeStage(s: StageCharge) {
    return { etablissement: s.etablissement, diplomePrepare: s.diplomePrepare, encadrantAcademique: s.encadrantAcademique, dateDebut: s.dateDebut, dateFin: s.dateFin };
  }

  private async charger(id: string): Promise<StageCharge> {
    const s = await this.prisma.stage.findUnique({ where: { id }, select: STAGE_SELECT });
    if (!s) throw new NotFoundException('Stage introuvable');
    return s;
  }

  private async chargerPeriode(stageId: string, periodeId: string) {
    const stage = await this.charger(stageId);
    const periode = stage.periodes.find((p) => p.id === periodeId);
    if (!periode) throw new NotFoundException('Période introuvable');
    return { stage, periode };
  }

  private async verrouillerStage(tx: Prisma.TransactionClient, stageId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM stages WHERE id = ${stageId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Stage introuvable');
    const stage = (await tx.stage.findUnique({ where: { id: stageId }, select: { id: true, statut: true, dateDebut: true, dateFin: true } }))!;
    this.assertStageOuvert(stage);
    return stage;
  }

  private assertStageOuvert(s: { statut: StageStatut }) {
    if (!STAGE_OUVERT.includes(s.statut)) throw new ConflictException('Ce stage est clôturé ou interrompu.');
  }

  private assertDansLeStage(s: { dateDebut: Date; dateFin: Date }, dateDebut: Date, dateFin: Date) {
    if (dateDebut < s.dateDebut || dateFin > s.dateFin) throw new ConflictException('La période doit être comprise dans les dates du stage.');
  }

  private async assertSansChevauchement(tx: Prisma.TransactionClient, stageId: string, dateDebut: Date, dateFin: Date, exclure: string | null) {
    const autres = await tx.periodeStage.findMany({
      where: { stageId, statut: { in: PERIODE_OCCUPANTE }, ...(exclure ? { id: { not: exclure } } : {}) },
      select: { dateDebut: true, dateFin: true },
    });
    if (autres.some((a) => chevauche(a, { dateDebut, dateFin }))) throw new ConflictException('Cette période chevauche une autre période du plan.');
  }

  /** Capacité d'accueil (bloquante, 409) de chaque unité concernée. Verrou
   * consultatif par unité : deux créations simultanées ne dépassent jamais le maximum. */
  private async assertCapacite(tx: Prisma.TransactionClient, u: UniteStage, dateDebut: Date, dateFin: Date, exclure: string | null) {
    const unite = { ...u };
    if (unite.sectionId && !unite.divisionId) {
      unite.divisionId = (await tx.section.findUnique({ where: { id: unite.sectionId }, select: { divisionId: true } }))?.divisionId ?? null;
    }
    for (const cle of clesCapacite(unite)) {
      const capacite = await tx.capaciteAccueil.findUnique({ where: { uniteKey: cle } });
      if (!capacite) continue;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'capacite:' + cle}))`;
      const occupees = await tx.periodeStage.findMany({
        where: {
          ...periodesDeLaCle(cle),
          statut: { in: PERIODE_OCCUPANTE },
          dateDebut: { lte: dateFin },
          dateFin: { gte: dateDebut },
          stage: { statut: { in: STAGE_OUVERT } },
          ...(exclure ? { id: { not: exclure } } : {}),
        },
        select: { dateDebut: true, dateFin: true },
      });
      const bornees = occupees.map((o) => ({ dateDebut: o.dateDebut < dateDebut ? dateDebut : o.dateDebut, dateFin: o.dateFin > dateFin ? dateFin : o.dateFin }));
      if (maximumSimultane([...bornees, { dateDebut, dateFin }]) > capacite.maximum) {
        throw new ConflictException(`Capacité d’accueil atteinte pour ${await this.libelleCle(cle)} : ${capacite.maximum} stagiaire(s) simultané(s) au maximum.`);
      }
    }
  }

  private async renumeroter(tx: Prisma.TransactionClient, stageId: string) {
    const ps = await tx.periodeStage.findMany({ where: { stageId }, orderBy: [{ dateDebut: 'asc' }, { createdAt: 'asc' }], select: { id: true, ordre: true } });
    for (const [i, p] of ps.entries()) if (p.ordre !== i + 1) await tx.periodeStage.update({ where: { id: p.id }, data: { ordre: i + 1 } });
  }

  private intervalle(debut: string | Date, fin: string | Date): [Date, Date] {
    const d = jour(new Date(debut));
    const f = jour(new Date(fin));
    if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) throw new BadRequestException('Dates invalides.');
    if (f < d) throw new BadRequestException('La date de fin doit suivre la date de début.');
    return [d, f];
  }

  private async uniteValide(dto: { divisionId?: string | null; sectionId?: string | null; celluleId?: string | null }): Promise<UniteStage> {
    const d = dto.divisionId || null;
    const s = dto.sectionId || null;
    const c = dto.celluleId || null;
    if (!!(d || s) === !!c) throw new BadRequestException('Une période se déroule dans une Division (section facultative) ou dans une Cellule.');
    if (s && !d) throw new BadRequestException('Une Section ne peut être renseignée sans Division.');
    const unite = { divisionId: d, sectionId: s, celluleId: c };
    await this.users.assertOrgAttachmentValid({ ...unite, supervisorId: null });
    await this.users.assertUnitsActiveForNewAttachment({ ...unite, supervisorId: null });
    return unite;
  }

  private async uniteExistante(u: UniteStage, cle: string) {
    const ok = u.celluleId
      ? await this.prisma.cellule.findUnique({ where: { id: u.celluleId } })
      : u.sectionId
        ? await this.prisma.section.findUnique({ where: { id: u.sectionId } })
        : await this.prisma.division.findUnique({ where: { id: u.divisionId! } });
    if (!ok) throw new NotFoundException(`Unité introuvable : ${cle}`);
  }

  private async libelleCle(cle: string): Promise<string> {
    const u = uniteDeCle(cle);
    if (!u) return cle;
    if (u.sectionId) {
      const s = await this.prisma.section.findUnique({ where: { id: u.sectionId }, select: { name: true, division: { select: { name: true } } } });
      return s ? `${s.division.name} / ${s.name}` : cle;
    }
    return this.history.describeAttachment(u);
  }

  private assertDrh(actor: AuthenticatedUser) {
    if (!estDrh(actor)) throw new ForbiddenException('Réservé au DRH.');
  }

  private assertDrhOuDirection(actor: AuthenticatedUser) {
    if (!estDrh(actor) && actor.role !== SystemRole.DN && actor.role !== SystemRole.DNA) {
      throw new ForbiddenException('Réservé au DRH et à la Direction.');
    }
  }

  private nom(u: { firstName: string; lastName: string }) {
    return `${u.firstName} ${u.lastName}`;
  }

  private async noms(ids: string[]) {
    if (!ids.length) return [];
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
  }

  private dates(p: { dateDebut: Date; dateFin: Date }) {
    const f = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    return `du ${f(p.dateDebut)} au ${f(p.dateFin)}`;
  }

  private async notifierDrh(type: NotificationType, titre: string, corps: string, stageId: string) {
    const drh = await this.prisma.user.findMany({ where: detenteursWhere(RoleFonctionnel.DRH), select: { id: true } });
    await this.notifications.notifyMany(drh.map((d) => d.id), type, titre, corps, LIEN(stageId));
  }

  private async notifierAAccepter(stageId: string, periodeId: string) {
    const { stage, periode } = await this.chargerPeriode(stageId, periodeId);
    const resp = await this.responsables(periode);
    await this.notifications.notifyMany(
      resp,
      NotificationType.STAGE_PERIODE_A_ACCEPTER,
      'Stagiaire proposé dans votre unité',
      `${this.nom(stage.stagiaire)} — ${await this.history.describeAttachment(periode)}, ${this.dates(periode)}. Acceptez la période et désignez le tuteur, ou refusez-la.`,
      LIEN(stageId),
    );
  }

  private async notifierPlanModifie(stage: StageCharge, periode: PeriodeChargee, message: string) {
    const ids = new Set(await this.responsables(periode));
    if (periode.tuteurId) ids.add(periode.tuteurId);
    await this.notifications.notifyMany([...ids], NotificationType.STAGE_PLAN_MODIFIE, 'Plan de stage modifié', `${this.nom(stage.stagiaire)} — ${message}`, LIEN(stage.id));
  }
}

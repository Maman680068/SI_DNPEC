import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ArriveeStatut,
  AuditAction,
  CourrierConfidentialite,
  ImputationNature,
  ImputationStatut,
  NotificationType,
  PieceCourrierNature,
  Prisma,
  RegistreNature,
  RegistrePortee,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import {
  ARRIVEE_ACCES_SELECT,
  ContexteAcces,
  CourrierAccesService,
  NiveauAcces,
  auMoins,
} from './courrier-acces.service';
import { NumerotationService, TRANSACTION_NUMEROTATION } from './numerotation.service';
import { UNITE_DIRECTION, assertUnitePourPortee } from './unites';
import { responsablesDeUnite } from './responsables';
import { controlerDates } from './dates-arrivee';
import { CascadeService } from '../org/cascade/cascade.service';
import { chargerPersonnes, personnesCitees } from './personnes';
import {
  ArriveeFiltresDto,
  CompleterPliDto,
  CreateArriveeDto,
  MotifDto,
  RequalifierPliDto,
  UpdateArriveeDto,
} from './dto/arrivee.dto';

export const ARRIVEE_SELECT = {
  ...ARRIVEE_ACCES_SELECT,
  annee: true,
  sequence: true,
  numero: true,
  dateReception: true,
  expediteur: true,
  referenceExpediteur: true,
  dateCourrier: true,
  motifDerogationDate: true,
  objet: true,
  statut: true,
  enregistreParId: true,
  classeAt: true,
  classeParId: true,
  annuleAt: true,
  annuleParId: true,
  motifAnnulation: true,
  createdAt: true,
  updatedAt: true,
  registre: { select: { portee: true, code: true, libelle: true } },
  imputations: {
    select: {
      id: true,
      parentId: true,
      imputeParId: true,
      auNomDeId: true,
      imputeAId: true,
      imputeA: { select: { id: true, divisionId: true, sectionId: true, celluleId: true } },
      nature: true,
      instructions: true,
      echeance: true,
      statut: true,
      compteRendu: true,
      reponseActeId: true,
      traiteeAt: true,
      traiteeParId: true,
      createdAt: true,
      tache: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  pieces: {
    select: { id: true, nature: true, fileName: true, mimeType: true, sizeBytes: true, deposeParId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CourrierArriveeSelect;

export type ArriveeChargee = Prisma.CourrierArriveeGetPayload<{ select: typeof ARRIVEE_SELECT }>;

type Fichier = Express.Multer.File;

/** Libellé d'un courrier dans une notification ou un email (Brevo = externe) :
 * jamais l'objet d'un CONFIDENTIEL ou d'un PERSONNEL. */
export function libelleCourrier(a: { numero: string; objet: string | null; confidentialite: CourrierConfidentialite }): string {
  return a.confidentialite === CourrierConfidentialite.ORDINAIRE && a.objet
    ? `n° ${a.numero} — ${a.objet}`
    : `n° ${a.numero} (${a.confidentialite === CourrierConfidentialite.PERSONNEL ? 'pli personnel' : 'confidentiel'})`;
}

/**
 * Courrier arrivée (D7, flux A) : enregistrement numéroté par le secrétariat
 * habilité, lecture selon la matrice (CourrierAccesService), pli personnel
 * (complétion et requalification par le seul destinataire), correction
 * auditée, annulation motivée, classement. Les imputations sont dans
 * ImputationsService.
 */
@Injectable()
export class ArriveesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly acces: CourrierAccesService,
    private readonly numerotation: NumerotationService,
    private readonly cascade: CascadeService,
  ) {}

  // ------------------------------------------------------------------
  // Enregistrement (numérotation à l'enregistrement)
  // ------------------------------------------------------------------

  async enregistrer(actor: AuthenticatedUser, dto: CreateArriveeDto, fichiers: Fichier[]) {
    const registre = await this.prisma.registreCourrier.findUnique({ where: { id: dto.registreId } });
    if (!registre || !registre.isActive) throw new NotFoundException('Registre introuvable ou inactif');
    if (registre.nature !== RegistreNature.ARRIVEE) {
      throw new BadRequestException('Ce registre n’est pas un registre de courrier arrivée.');
    }
    const uniteKey = registre.portee === RegistrePortee.DIRECTION ? UNITE_DIRECTION : dto.uniteKey ?? '';
    assertUnitePourPortee(registre.portee, uniteKey);

    // Habilitation courrier : identité réelle, jamais empruntée.
    const ctx = await this.acces.contexte(actor);
    if (!this.acces.estHabilite(ctx, registre.id, uniteKey)) {
      throw new ForbiddenException('Vous n’êtes pas habilité à enregistrer le courrier de ce registre pour cette unité.');
    }

    if (dto.confidentialite === CourrierConfidentialite.PERSONNEL) {
      if (!dto.destinataireId) throw new BadRequestException('Un pli personnel exige son destinataire nominatif.');
      if (dto.objet) throw new BadRequestException('Un pli personnel n’a pas d’objet au registre (pli fermé).');
      if (fichiers.length > 0) throw new BadRequestException('Un pli personnel ne se scanne pas (pli fermé).');
    } else if (!dto.objet) {
      throw new BadRequestException('L’objet du courrier est obligatoire.');
    }
    if (dto.destinataireId) await this.assertActif(dto.destinataireId, 'Destinataire');
    const motifDerogationDate = controlerDates(
      { dateReception: new Date(dto.dateReception), dateCourrier: dto.dateCourrier ? new Date(dto.dateCourrier) : null },
      dto,
    );

    const uniteCode = await this.numerotation.codeUnite(uniteKey);

    const cree = await this.storage.saveAllThen(
      fichiers.map((f) => ({ buffer: f.buffer, originalName: f.originalname })),
      (saved) =>
        this.prisma.$transaction(async (tx) => {
          const n = await this.numerotation.attribuer(tx, registre, uniteKey, uniteCode);
          const arrivee = await tx.courrierArrivee.create({
            data: {
              registreId: registre.id,
              uniteKey,
              annee: n.annee,
              sequence: n.sequence,
              numero: n.numero,
              dateReception: new Date(dto.dateReception),
              expediteur: dto.expediteur,
              referenceExpediteur: dto.referenceExpediteur,
              dateCourrier: dto.dateCourrier ? new Date(dto.dateCourrier) : undefined,
              motifDerogationDate,
              objet: dto.objet,
              confidentialite: dto.confidentialite,
              destinataireId: dto.destinataireId,
              enregistreParId: actor.id,
              pieces: {
                create: saved.map((s, i) => ({
                  nature: PieceCourrierNature.SCAN,
                  fileName: fichiers[i]!.originalname,
                  fileKey: s.fileKey,
                  mimeType: fichiers[i]!.mimetype,
                  sizeBytes: s.sizeBytes,
                  deposeParId: actor.id,
                })),
              },
            },
            select: { id: true, numero: true, objet: true, confidentialite: true, destinataireId: true },
          });
          await this.audit.log(
            {
              actorId: actor.id,
              action: AuditAction.CREATION,
              entityType: 'CourrierArrivee',
              entityId: arrivee.id,
              metadata: {
                event: 'enregistrement',
                numero: n.numero,
                registre: registre.code,
                uniteKey,
                confidentialite: dto.confidentialite,
                ...(motifDerogationDate ? { derogationDate: motifDerogationDate } : {}),
              },
            },
            tx,
          );
          return arrivee;
        }, TRANSACTION_NUMEROTATION),
    );

    // Notifications APRÈS le commit seulement (un échec d'email n'annule rien, A7).
    if (cree.confidentialite === CourrierConfidentialite.PERSONNEL) {
      // Pli fermé : seul son destinataire est prévenu, jamais « à imputer ».
      if (cree.destinataireId) {
        await this.notifications.notify(
          cree.destinataireId,
          NotificationType.PLI_PERSONNEL_RECU,
          'Un pli personnel vous attend',
          `Pli n° ${cree.numero}, enregistré au courrier.`,
          `/courrier?arrivee=${cree.id}`,
        );
      }
    } else {
      // « Nouveau courrier à imputer » : DN et DNA (registre DIRECTION), le chef
      // de l'unité (registre UNITE, ou DN/DNA si l'unité n'a pas de chef),
      // jamais la personne qui vient de l'enregistrer. Sans objet si CONFIDENTIEL.
      const destinataires = (await responsablesDeUnite(this.prisma, uniteKey)).filter((id) => id !== actor.id);
      const confidentiel = cree.confidentialite === CourrierConfidentialite.CONFIDENTIEL;
      await this.notifications.notifyMany(
        destinataires,
        NotificationType.COURRIER_A_IMPUTER,
        confidentiel ? 'Nouveau courrier confidentiel à imputer' : 'Nouveau courrier à imputer',
        confidentiel ? `Nouveau courrier confidentiel à imputer, n° ${cree.numero}.` : `Courrier n° ${cree.numero} — ${cree.objet ?? ''}.`,
        `/courrier?arrivee=${cree.id}`,
      );
    }
    return this.findOne(actor, cree.id);
  }

  // ------------------------------------------------------------------
  // Lecture (même projection pour l'écran et l'export)
  // ------------------------------------------------------------------

  async lister(actor: AuthenticatedUser, filtres: ArriveeFiltresDto) {
    const ctx = await this.acces.contexte(actor);
    // Année explicite (filtre) : exactement cette année, archives comprises.
    // Vue par défaut : l'année en cours ET, quelle que soit leur année, tout ce
    // qui est encore en cours (arrivée ni classée ni annulée, ou imputation non
    // traitée) — un changement d'année ne fait rien disparaître.
    const periode: Prisma.CourrierArriveeWhereInput =
      filtres.annee !== undefined
        ? { annee: filtres.annee }
        : {
            OR: [
              { annee: new Date().getFullYear() },
              { statut: { notIn: [ArriveeStatut.CLASSE, ArriveeStatut.ANNULE] } },
              { imputations: { some: { statut: ImputationStatut.EN_COURS } } },
            ],
          };
    const rows = await this.prisma.courrierArrivee.findMany({
      where: { ...periode, registreId: filtres.registreId, statut: filtres.statut },
      select: ARRIVEE_SELECT,
      orderBy: [{ dateReception: 'desc' }, { sequence: 'desc' }],
    });
    const q = filtres.q?.trim().toLowerCase();
    const projetes = rows
      .map((a) => ({ a, niveau: this.acces.niveauArrivee(ctx, a) }))
      .filter(({ niveau }) => niveau !== 'AUCUN')
      .map(({ a, niveau }) => this.projeter(ctx, a, niveau))
      .filter((p) => !q || [p.numero, p.expediteur, p.objet ?? ''].some((v) => v.toLowerCase().includes(q)));
    return this.avecPersonnes(projetes);
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const ctx = await this.acces.contexte(actor);
    const a = await this.charger(id);
    const niveau = this.acces.assertArrivee(ctx, a, 'EXISTENCE');
    const [projete] = await this.avecPersonnes([this.projeter(ctx, a, niveau)]);
    return projete!;
  }

  /** Noms des personnes citées par chaque courrier projeté (et par elles
   * seules) — champs d'affichage, résolus en une requête. */
  private async avecPersonnes<T extends ReturnType<ArriveesService['projeter']>>(projetes: T[]) {
    const cites = (p: T) => [
      p.destinataireId,
      ...p.imputations.flatMap((i) => [i.imputeParId, i.auNomDeId, i.imputeAId, i.traiteeParId]),
      ...p.pieces.map((f) => f.deposeParId),
    ];
    const annuaire = await chargerPersonnes(this.prisma, projetes.flatMap(cites));
    return projetes.map((p) => ({ ...p, personnes: personnesCitees(annuaire, cites(p)) }));
  }

  /** Projection selon le niveau d'accès — jamais plus que la matrice. */
  projeter(ctx: ContexteAcces, a: ArriveeChargee, niveau: NiveauAcces) {
    const base = {
      id: a.id,
      numero: a.numero,
      annee: a.annee,
      sequence: a.sequence,
      registre: { id: a.registreId, code: a.registre.code, libelle: a.registre.libelle, portee: a.registre.portee },
      uniteKey: a.uniteKey,
      dateReception: a.dateReception,
      expediteur: a.expediteur,
      confidentialite: a.confidentialite,
      destinataireId: a.destinataireId,
      statut: a.statut,
      motifAnnulation: a.motifAnnulation,
      createdAt: a.createdAt,
      niveau,
      droits: this.droits(ctx, a, niveau),
    };
    if (niveau === 'EXISTENCE') {
      return { ...base, objet: null, referenceExpediteur: null, dateCourrier: null, motifDerogationDate: null, imputations: [], pieces: [] };
    }
    const meta = { ...base, objet: a.objet, referenceExpediteur: a.referenceExpediteur, dateCourrier: a.dateCourrier, motifDerogationDate: a.motifDerogationDate };
    if (niveau === 'METADONNEES') return { ...meta, imputations: [], pieces: [] };
    return {
      ...meta,
      imputations: a.imputations.map(({ imputeA: _i, ...imp }) => ({ ...imp, droits: this.droitsImputation(ctx, a, imp) })),
      pieces: a.pieces,
    };
  }

  /** Actions possibles pour l'écran — le serveur revérifie toujours à l'action. */
  private droits(ctx: ContexteAcces, a: ArriveeChargee, niveau: NiveauAcces) {
    const { actor } = ctx;
    const ouvert = a.statut !== ArriveeStatut.ANNULE && a.statut !== ArriveeStatut.CLASSE;
    const personnel = a.confidentialite === CourrierConfidentialite.PERSONNEL;
    const destinataire = a.destinataireId === actor.id;
    const gestion =
      this.acces.estHabilite(ctx, a.registreId, a.uniteKey) ||
      this.acces.estResponsableAction(actor, a.registre.portee, a.uniteKey);
    return {
      imputer: ouvert && !personnel && niveau === 'CONTENU' && this.acces.estResponsableAction(actor, a.registre.portee, a.uniteKey),
      completer: ouvert && personnel && destinataire,
      requalifier: ouvert && personnel && destinataire,
      corriger: ouvert && gestion,
      annuler: ouvert && gestion,
      classer: ouvert && (personnel ? destinataire : gestion) && this.classable(a),
      ajouterPiece: ouvert && (personnel ? destinataire : gestion && auMoins(niveau, 'CONTENU')),
      // « Rédiger une réponse » : ActesService.validerChamps exige l'accès au contenu.
      repondre: ouvert && niveau === 'CONTENU',
      deleguer:
        ouvert &&
        a.confidentialite === CourrierConfidentialite.CONFIDENTIEL &&
        !actor.interimForId &&
        this.acces.niveauArrivee(ctx, a, { sansDelegation: true }) === 'CONTENU',
    };
  }

  /** Actions sur une imputation (niveau CONTENU acquis) — mêmes règles que
   * ImputationsService.traiter / sousImputer / convertirEnTache, qui revérifient. */
  private droitsImputation(
    ctx: ContexteAcces,
    a: ArriveeChargee,
    imp: { statut: ImputationStatut; imputeAId: string; imputeParId: string; tache: { id: string } | null },
  ) {
    const enCours = a.statut !== ArriveeStatut.ANNULE && a.statut !== ArriveeStatut.CLASSE && imp.statut === ImputationStatut.EN_COURS;
    const impute = enCours && this.cascade.isActingFor(ctx.actor, imp.imputeAId);
    return {
      traiter: impute,
      sousImputer: impute,
      convertir: enCours && !imp.tache && this.cascade.isActingFor(ctx.actor, imp.imputeParId),
    };
  }

  // ------------------------------------------------------------------
  // Pli PERSONNEL — destinataire seul (actor.id strict, jamais isActingFor)
  // ------------------------------------------------------------------

  async completer(actor: AuthenticatedUser, id: string, dto: CompleterPliDto) {
    const a = await this.charger(id);
    this.assertPliDuDestinataire(actor, a);
    await this.prisma.courrierArrivee.update({ where: { id }, data: { objet: dto.objet } });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'CourrierArrivee',
      entityId: id,
      metadata: { event: 'pli_complete' },
    });
    return this.findOne(actor, id);
  }

  /** Sens unique PERSONNEL → ORDINAIRE/CONFIDENTIEL, pour entrer dans le
   * circuit d'imputation. Le destinataire garde toujours l'accès complet. */
  async requalifier(actor: AuthenticatedUser, id: string, dto: RequalifierPliDto) {
    const a = await this.charger(id);
    this.assertPliDuDestinataire(actor, a);
    if (!a.objet) throw new ConflictException('Complétez d’abord l’objet du pli avant de le requalifier.');
    await this.prisma.courrierArrivee.update({ where: { id }, data: { confidentialite: dto.confidentialite } });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'CourrierArrivee',
      entityId: id,
      metadata: { event: 'pli_requalifie', avant: CourrierConfidentialite.PERSONNEL, apres: dto.confidentialite },
    });
    return this.findOne(actor, id);
  }

  private assertPliDuDestinataire(actor: AuthenticatedUser, a: ArriveeChargee): void {
    if (a.confidentialite !== CourrierConfidentialite.PERSONNEL) {
      throw new ConflictException('Ce courrier n’est pas (ou plus) un pli personnel.');
    }
    if (a.destinataireId !== actor.id) {
      throw new ForbiddenException('Seul le destinataire peut ouvrir et compléter un pli personnel.');
    }
    this.assertOuvert(a);
  }

  // ------------------------------------------------------------------
  // Correction, annulation, classement
  // ------------------------------------------------------------------

  async corriger(actor: AuthenticatedUser, id: string, dto: UpdateArriveeDto) {
    const a = await this.charger(id);
    this.assertOuvert(a);
    const ctx = await this.acces.contexte(actor);
    this.assertGestion(ctx, a);
    if (a.confidentialite === CourrierConfidentialite.PERSONNEL && dto.objet !== undefined) {
      throw new ForbiddenException('L’objet d’un pli personnel ne peut être renseigné que par son destinataire.');
    }
    const { derogationDate, motifDerogation, ...modif } = dto;
    const data: Prisma.CourrierArriveeUpdateInput = {
      dateReception: modif.dateReception ? new Date(modif.dateReception) : undefined,
      expediteur: modif.expediteur,
      referenceExpediteur: modif.referenceExpediteur,
      dateCourrier: modif.dateCourrier ? new Date(modif.dateCourrier) : undefined,
      objet: modif.objet,
    };
    // Même contrôle des dates qu'à l'enregistrement, dès qu'une date change (ou
    // qu'une dérogation est envoyée) : le motif est réécrit — vidé si l'anomalie
    // disparaît — et tracé avant/après.
    if (modif.dateReception !== undefined || modif.dateCourrier !== undefined || derogationDate) {
      data.motifDerogationDate = controlerDates(
        {
          dateReception: modif.dateReception ? new Date(modif.dateReception) : a.dateReception,
          dateCourrier: modif.dateCourrier ? new Date(modif.dateCourrier) : a.dateCourrier,
        },
        { derogationDate, motifDerogation },
      );
    }
    const champs = Object.keys(modif).filter((k) => (modif as Record<string, unknown>)[k] !== undefined);
    if (data.motifDerogationDate !== undefined && data.motifDerogationDate !== a.motifDerogationDate) champs.push('motifDerogationDate');
    // Avant/après : valeurs réelles, sauf l'objet d'un CONFIDENTIEL (seulement
    // mentionné comme modifié — l'audit n'est pas un canal de lecture).
    const valeur = (k: string, v: unknown) =>
      k === 'objet' && a.confidentialite !== CourrierConfidentialite.ORDINAIRE ? '(protégé)' : v;
    // Sérialisation JSON explicite (dates → chaînes) pour la colonne metadata.
    const json = (o: object) => JSON.parse(JSON.stringify(o)) as Prisma.InputJsonObject;
    const avant = json(Object.fromEntries(champs.map((k) => [k, valeur(k, (a as Record<string, unknown>)[k])])));
    const apres = json(Object.fromEntries(champs.map((k) => [k, valeur(k, k === 'motifDerogationDate' ? data.motifDerogationDate : (modif as Record<string, unknown>)[k])])));

    await this.prisma.$transaction(async (tx) => {
      await tx.courrierArrivee.update({ where: { id }, data });
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'CourrierArrivee', entityId: id, metadata: { event: 'correction', avant, apres } },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  /** Le numéro est conservé (statut ANNULE + motif obligatoire) — jamais de suppression. */
  async annuler(actor: AuthenticatedUser, id: string, dto: MotifDto) {
    const a = await this.charger(id);
    this.assertOuvert(a);
    const ctx = await this.acces.contexte(actor);
    this.assertGestion(ctx, a);
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.courrierArrivee.updateMany({
        where: { id, statut: { notIn: [ArriveeStatut.ANNULE, ArriveeStatut.CLASSE] } },
        data: { statut: ArriveeStatut.ANNULE, annuleAt: new Date(), annuleParId: actor.id, motifAnnulation: dto.motif },
      });
      if (done.count === 0) throw new ConflictException('Ce courrier est déjà annulé ou classé.');
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'CourrierArrivee', entityId: id, metadata: { event: 'annulation', numero: a.numero, motif: dto.motif } },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  async classer(actor: AuthenticatedUser, id: string) {
    const a = await this.charger(id);
    this.assertOuvert(a);
    if (a.confidentialite === CourrierConfidentialite.PERSONNEL) {
      if (a.destinataireId !== actor.id) throw new ForbiddenException('Seul le destinataire classe un pli personnel.');
    } else {
      this.assertGestion(await this.acces.contexte(actor), a);
      if (!this.classable(a)) {
        throw new ConflictException('Ce courrier ne peut être classé qu’une fois imputé et toutes ses attributions traitées.');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.courrierArrivee.updateMany({
        where: { id, statut: { notIn: [ArriveeStatut.ANNULE, ArriveeStatut.CLASSE] } },
        data: { statut: ArriveeStatut.CLASSE, classeAt: new Date(), classeParId: actor.id },
      });
      if (done.count === 0) throw new ConflictException('Ce courrier est déjà annulé ou classé.');
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'CourrierArrivee', entityId: id, metadata: { event: 'classement', numero: a.numero } },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  private classable(a: ArriveeChargee): boolean {
    if (a.confidentialite === CourrierConfidentialite.PERSONNEL) return true;
    if (a.imputations.length === 0) return false;
    return a.imputations
      .filter((i) => i.nature === ImputationNature.ATTRIBUTION)
      .every((i) => i.statut === ImputationStatut.TRAITEE);
  }

  // ------------------------------------------------------------------
  // Pièces (scans)
  // ------------------------------------------------------------------

  async ajouterPieces(actor: AuthenticatedUser, id: string, fichiers: Fichier[]) {
    if (fichiers.length === 0) throw new BadRequestException('Aucun fichier reçu.');
    const a = await this.charger(id);
    this.assertOuvert(a);
    const ctx = await this.acces.contexte(actor);
    if (a.confidentialite === CourrierConfidentialite.PERSONNEL) {
      if (a.destinataireId !== actor.id) throw new ForbiddenException('Seul le destinataire peut joindre une pièce à un pli personnel.');
    } else {
      this.assertGestion(ctx, a);
      this.acces.assertArrivee(ctx, a, 'CONTENU');
    }
    await this.storage.saveAllThen(
      fichiers.map((f) => ({ buffer: f.buffer, originalName: f.originalname })),
      (saved) =>
        this.prisma.$transaction(async (tx) => {
          await tx.pieceCourrier.createMany({
            data: saved.map((s, i) => ({
              arriveeId: id,
              nature: PieceCourrierNature.SCAN,
              fileName: fichiers[i]!.originalname,
              fileKey: s.fileKey,
              mimeType: fichiers[i]!.mimetype,
              sizeBytes: s.sizeBytes,
              deposeParId: actor.id,
            })),
          });
          await this.audit.log(
            { actorId: actor.id, action: AuditAction.CREATION, entityType: 'PieceCourrier', entityId: id, metadata: { event: 'pieces_arrivee', nombre: saved.length } },
            tx,
          );
        }),
    );
    return this.findOne(actor, id);
  }

  async telechargerPiece(actor: AuthenticatedUser, id: string, pieceId: string) {
    const a = await this.charger(id);
    const ctx = await this.acces.contexte(actor);
    this.acces.assertArrivee(ctx, a, 'CONTENU');
    const piece = await this.prisma.pieceCourrier.findUnique({ where: { id: pieceId } });
    if (!piece || piece.arriveeId !== id) throw new NotFoundException('Pièce introuvable pour ce courrier');
    return { piece, stream: this.storage.createReadStream(piece.fileKey) };
  }

  // ------------------------------------------------------------------

  async charger(id: string): Promise<ArriveeChargee> {
    const a = await this.prisma.courrierArrivee.findUnique({ where: { id }, select: ARRIVEE_SELECT });
    if (!a) throw new NotFoundException('Courrier introuvable');
    return a;
  }

  /** Secrétariat habilité du registre/unité, ou direction/chef d'unité (P.I. possible). */
  assertGestion(ctx: ContexteAcces, a: ArriveeChargee): void {
    if (
      !this.acces.estHabilite(ctx, a.registreId, a.uniteKey) &&
      !this.acces.estResponsableAction(ctx.actor, a.registre.portee, a.uniteKey)
    ) {
      throw new ForbiddenException('Seuls le secrétariat habilité et la direction (ou le chef de l’unité) gèrent ce registre.');
    }
  }

  assertOuvert(a: { statut: ArriveeStatut }): void {
    if (a.statut === ArriveeStatut.ANNULE) throw new ConflictException('Ce courrier est annulé.');
    if (a.statut === ArriveeStatut.CLASSE) throw new ConflictException('Ce courrier est classé.');
  }

  private async assertActif(userId: string, label: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!u) throw new NotFoundException(`${label} introuvable`);
    if (u.status !== UserStatus.ACTIF) throw new BadRequestException(`${label} : compte inactif.`);
  }
}

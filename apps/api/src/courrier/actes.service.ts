import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActeStatut,
  AuditAction,
  CourrierConfidentialite,
  NotificationType,
  PieceCourrierNature,
  Prisma,
  RegistreNature,
  RegistrePortee,
  SystemRole,
  UserStatus,
  VisaStatut,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ACTE_ACCES_SELECT, ARRIVEE_ACCES_SELECT, ContexteAcces, CourrierAccesService } from './courrier-acces.service';
import { NumerotationService, TRANSACTION_NUMEROTATION } from './numerotation.service';
import { UNITE_DIRECTION, uniteDe } from './unites';
import { responsablesDeUnite } from './responsables';
import { chargerPersonnes, personnesCitees } from './personnes';
import { ActeFiltresDto, CreateActeDto, ExpedierDto, UpdateActeDto, ViserDto } from './dto/acte.dto';
import { MotifDto } from './dto/arrivee.dto';

export const ACTE_SELECT = {
  ...ACTE_ACCES_SELECT,
  annee: true,
  numero: true,
  objet: true,
  destinataires: true,
  corps: true,
  priseConnaissanceRequise: true,
  priseConnaissanceAt: true,
  repondAId: true,
  cycle: true,
  motifRenvoi: true,
  signataireId: true,
  signeAuNomDeId: true,
  signeAt: true,
  expedieAt: true,
  expedieParId: true,
  modeExpedition: true,
  annuleAt: true,
  annuleParId: true,
  motifAnnulation: true,
  createdAt: true,
  updatedAt: true,
  registre: { select: { portee: true, code: true, libelle: true, nature: true, gabaritNumero: true, id: true } },
  redacteur: { select: { id: true, role: true, divisionId: true, sectionId: true, celluleId: true } },
  visas: {
    select: {
      id: true,
      cycle: true,
      ordre: true,
      niveau: true,
      viseurAttenduId: true,
      statut: true,
      motifSaut: true,
      viseParId: true,
      viseAuNomDeId: true,
      commentaire: true,
      viseAt: true,
    },
    orderBy: [{ cycle: 'asc' }, { ordre: 'asc' }],
  },
  pieces: {
    select: { id: true, nature: true, fileName: true, mimeType: true, sizeBytes: true, deposeParId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ActeCourrierSelect;

export type ActeCharge = Prisma.ActeCourrierGetPayload<{ select: typeof ACTE_SELECT }>;
type Visa = ActeCharge['visas'][number];
type Fichier = Express.Multer.File;

type NiveauCircuit = { niveau: SystemRole; chefs: { id: string }[] };

/** Libellé d'un acte dans une notification/email : jamais l'objet d'un CONFIDENTIEL. */
function libelleActe(a: { numero: string | null; objet: string; confidentialite: CourrierConfidentialite }): string {
  const ref = a.numero ? `n° ${a.numero}` : '(non numéroté)';
  return a.confidentialite === CourrierConfidentialite.ORDINAIRE ? `${ref} — ${a.objet}` : `${ref} (confidentiel)`;
}

/**
 * Départs et actes (D7, flux B) : brouillon → circuit de visa → signature
 * (numérotation) → expédition. Règles validées :
 * - circuit automatique depuis le rédacteur : son Chef de Section, puis son
 *   Chef de Division/Cellule, en s'arrêtant AVANT le signataire (portée
 *   UNITE : le chef d'unité signe, il ne vise pas) ; niveau sauté si le
 *   rédacteur est ce chef ou si le poste est vacant (journalisé) ; deux chefs
 *   actifs au même niveau → 409 ; viseur figé à la soumission ;
 * - personne ne vise sa propre lettre ; un viseur absent est suppléé en
 *   intérim (P.I., stocké et audité) ;
 * - signature : DIRECTION → DN/DNA ; UNITE → chef de la Division/Cellule
 *   émettrice ou DN/DNA (jamais un Chef de Section, jamais pour une autre
 *   unité) ; P.I. possible ; jamais par le bénéficiaire de l'acte (ni par le
 *   suppléant de ce bénéficiaire) ;
 * - numéro attribué À LA SIGNATURE, dans la transaction qui fait passer
 *   l'acte de A_SIGNER à SIGNE (0 ligne → 409, aucun numéro consommé).
 */
@Injectable()
export class ActesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly acces: CourrierAccesService,
    private readonly numerotation: NumerotationService,
  ) {}

  // ------------------------------------------------------------------
  // Brouillon
  // ------------------------------------------------------------------

  async creer(actor: AuthenticatedUser, dto: CreateActeDto) {
    const redacteur = await this.chargerPersonne(actor.id);
    if (redacteur.role === SystemRole.ADMIN_SYSTEME) {
      throw new ForbiddenException('L’administrateur système n’a pas accès au courrier : il ne rédige pas d’acte.');
    }
    const { registreId, uniteKey } = await this.resoudreRegistre(dto.registreId, redacteur);
    await this.validerChamps(actor, dto);
    const acte = await this.prisma.acteCourrier.create({
      data: {
        registreId,
        uniteKey,
        objet: dto.objet,
        destinataires: dto.destinataires,
        corps: dto.corps,
        confidentialite: dto.confidentialite,
        beneficiaireId: dto.beneficiaireId,
        priseConnaissanceRequise: dto.priseConnaissanceRequise ?? false,
        repondAId: dto.repondAId,
        redacteurId: actor.id,
      },
      select: { id: true },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'ActeCourrier',
      entityId: acte.id,
      metadata: { event: 'brouillon', registreId, uniteKey, confidentialite: dto.confidentialite },
    });
    return this.findOne(actor, acte.id);
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: UpdateActeDto) {
    const acte = await this.charger(id);
    this.assertRedacteur(actor, acte);
    if (acte.statut !== ActeStatut.BROUILLON && acte.statut !== ActeStatut.RENVOYE) {
      throw new ConflictException('Seul un brouillon ou un acte renvoyé pour correction est modifiable.');
    }
    const fusion = {
      beneficiaireId: dto.beneficiaireId ?? acte.beneficiaireId ?? undefined,
      priseConnaissanceRequise: dto.priseConnaissanceRequise ?? acte.priseConnaissanceRequise,
      repondAId: dto.repondAId,
    };
    await this.validerChamps(actor, fusion);
    let registre: { registreId: string; uniteKey: string } | null = null;
    if (dto.registreId && dto.registreId !== acte.registreId) {
      registre = await this.resoudreRegistre(dto.registreId, await this.chargerPersonne(actor.id));
    }
    await this.prisma.acteCourrier.update({
      where: { id },
      data: {
        ...(registre ?? {}),
        objet: dto.objet,
        destinataires: dto.destinataires,
        corps: dto.corps,
        confidentialite: dto.confidentialite,
        beneficiaireId: dto.beneficiaireId,
        priseConnaissanceRequise: dto.priseConnaissanceRequise,
        repondAId: dto.repondAId,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'ActeCourrier',
      entityId: id,
      metadata: { event: 'brouillon_modifie', champs: Object.keys(dto) },
    });
    return this.findOne(actor, id);
  }

  /** Suppression physique UNIQUEMENT d'un brouillon jamais soumis (cycle 0). */
  async supprimer(actor: AuthenticatedUser, id: string): Promise<void> {
    const acte = await this.charger(id);
    this.assertRedacteur(actor, acte);
    if (acte.statut !== ActeStatut.BROUILLON || acte.cycle > 0) {
      throw new ConflictException('Cet acte a déjà été soumis : il ne peut plus être supprimé, seulement annulé (motif obligatoire).');
    }
    // Clés des fichiers lues AVANT la suppression (les pièces partent en cascade).
    const fichiers = await this.prisma.pieceCourrier.findMany({ where: { acteId: id }, select: { fileKey: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.acteCourrier.delete({ where: { id } });
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'ActeCourrier', entityId: id, metadata: { event: 'brouillon_supprime', objet: acte.objet } },
        tx,
      );
    });
    // Fichiers supprimés après le commit seulement (un rollback les garderait référencés).
    await Promise.all(fichiers.map((f) => this.storage.delete(f.fileKey)));
  }

  // ------------------------------------------------------------------
  // Circuit de visa
  // ------------------------------------------------------------------

  async soumettre(actor: AuthenticatedUser, id: string) {
    const acte = await this.charger(id);
    this.assertRedacteur(actor, acte);
    const obsolete = acte.statut === ActeStatut.EN_VISA && (await this.circuitObsolete(acte));
    if (acte.statut !== ActeStatut.BROUILLON && acte.statut !== ActeStatut.RENVOYE && !obsolete) {
      throw new ConflictException('Seul un brouillon, un acte renvoyé ou un circuit devenu obsolète peut être (re)soumis.');
    }
    const redacteur = await this.chargerPersonne(acte.redacteurId);
    const niveaux = await this.niveauxDuCircuit(redacteur, acte.registre.portee);
    const cycle = acte.cycle + 1;
    const lignes = niveaux.map((n, ordre) => {
      if (n.chefs.length > 1) {
        throw new ConflictException(
          'Anomalie d’organisation : deux chefs actifs occupent le même niveau du circuit de visa. Contactez l’administrateur.',
        );
      }
      const chef = n.chefs[0];
      if (!chef) return { ordre, niveau: n.niveau, statut: VisaStatut.SAUTE, motifSaut: 'Poste vacant', viseurAttenduId: null };
      if (chef.id === redacteur.id) {
        return { ordre, niveau: n.niveau, statut: VisaStatut.SAUTE, motifSaut: 'Le rédacteur est lui-même ce chef', viseurAttenduId: null };
      }
      return { ordre, niveau: n.niveau, statut: VisaStatut.EN_ATTENTE, motifSaut: null, viseurAttenduId: chef.id };
    });
    const premier = lignes.find((l) => l.statut === VisaStatut.EN_ATTENTE);
    const statut = premier ? ActeStatut.EN_VISA : ActeStatut.A_SIGNER;

    await this.prisma.$transaction(async (tx) => {
      await tx.visaActe.updateMany({ where: { acteId: id, statut: VisaStatut.EN_ATTENTE }, data: { statut: VisaStatut.SAUTE, motifSaut: 'Circuit remplacé par une nouvelle soumission' } });
      await tx.visaActe.createMany({ data: lignes.map((l) => ({ ...l, acteId: id, cycle })) });
      await tx.acteCourrier.update({ where: { id }, data: { statut, cycle, motifRenvoi: null } });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.MODIFICATION,
          entityType: 'ActeCourrier',
          entityId: id,
          metadata: { event: 'soumission', cycle, circuit: lignes.map((l) => ({ niveau: l.niveau, statut: l.statut, motifSaut: l.motifSaut, viseurAttenduId: l.viseurAttenduId })) },
        },
        tx,
      );
    });

    if (premier?.viseurAttenduId) {
      await this.notifier([premier.viseurAttenduId], NotificationType.ACTE_A_VISER, 'Acte à viser', acte);
    } else {
      await this.notifierSignataires(acte);
    }
    return this.findOne(actor, id);
  }

  async viser(actor: AuthenticatedUser, id: string, dto: ViserDto) {
    const acte = await this.charger(id);
    if (acte.statut !== ActeStatut.EN_VISA) throw new ConflictException('Cet acte n’est pas en cours de visa.');
    if (actor.id === acte.redacteurId) throw new ForbiddenException('Personne ne vise sa propre lettre.');
    const visa = this.visaCourant(acte);
    if (!visa?.viseurAttenduId || !this.cascade.isActingFor(actor, visa.viseurAttenduId)) {
      throw new ForbiddenException('Ce visa ne vous revient pas (ni en votre nom, ni en intérim du viseur attendu).');
    }
    this.acces.assertActe(await this.acces.contexte(actor), acte);
    await this.assertViseurToujoursChef(acte, visa);

    const suivant = acte.visas.find((v) => v.cycle === acte.cycle && v.statut === VisaStatut.EN_ATTENTE && v.ordre > visa.ordre);
    const auNomDeId = this.auNomDuViseur(actor, visa.viseurAttenduId);
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.visaActe.updateMany({
        where: { id: visa.id, statut: VisaStatut.EN_ATTENTE },
        data: { statut: VisaStatut.VISE, viseParId: actor.id, viseAuNomDeId: auNomDeId, commentaire: dto.commentaire, viseAt: new Date() },
      });
      if (done.count === 0) throw new ConflictException('Ce visa a déjà été posé.');
      if (!suivant) {
        await tx.acteCourrier.update({ where: { id }, data: { statut: ActeStatut.A_SIGNER } });
      }
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'ActeCourrier', entityId: id, metadata: { event: 'visa', niveau: visa.niveau, cycle: acte.cycle, auNomDeId } },
        tx,
      );
    });

    if (suivant?.viseurAttenduId) {
      await this.notifier([suivant.viseurAttenduId], NotificationType.ACTE_A_VISER, 'Acte à viser', acte);
    } else if (!suivant) {
      await this.notifierSignataires(acte);
    }
    return this.findOne(actor, id);
  }

  /** Renvoi pour correction (viseur courant, ou signataire) : retour au rédacteur. */
  async renvoyer(actor: AuthenticatedUser, id: string, dto: MotifDto) {
    const acte = await this.charger(id);
    // Signataire (A_SIGNER) : autorité du rôle, empruntée en intérim.
    let auNomDeId = actor.interimForId;
    if (acte.statut === ActeStatut.EN_VISA) {
      if (actor.id === acte.redacteurId) throw new ForbiddenException('Personne ne vise sa propre lettre.');
      const visa = this.visaCourant(acte);
      if (!visa?.viseurAttenduId || !this.cascade.isActingFor(actor, visa.viseurAttenduId)) {
        throw new ForbiddenException('Seul le viseur attendu peut renvoyer l’acte à ce stade.');
      }
      auNomDeId = this.auNomDuViseur(actor, visa.viseurAttenduId);
    } else if (acte.statut === ActeStatut.A_SIGNER) {
      this.assertPeutSigner(actor, acte);
    } else {
      throw new ConflictException('Cet acte n’est ni en visa ni à signer.');
    }
    this.acces.assertActe(await this.acces.contexte(actor), acte);

    await this.prisma.$transaction(async (tx) => {
      const done = await tx.acteCourrier.updateMany({
        where: { id, statut: acte.statut },
        data: { statut: ActeStatut.RENVOYE, motifRenvoi: dto.motif },
      });
      if (done.count === 0) throw new ConflictException('L’acte a changé d’état entre-temps.');
      await tx.visaActe.updateMany({
        where: { acteId: id, cycle: acte.cycle, statut: VisaStatut.EN_ATTENTE },
        data: { statut: VisaStatut.RENVOYE, viseParId: actor.id, viseAuNomDeId: auNomDeId, commentaire: dto.motif, viseAt: new Date() },
      });
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.REJET, entityType: 'ActeCourrier', entityId: id, metadata: { event: 'renvoi', motif: dto.motif, cycle: acte.cycle, auNomDeId } },
        tx,
      );
    });
    await this.notifier([acte.redacteurId], NotificationType.ACTE_RENVOYE, 'Acte renvoyé pour correction', acte, dto.motif);
    return this.findOne(actor, id);
  }

  // ------------------------------------------------------------------
  // Signature (numérotation)
  // ------------------------------------------------------------------

  async signer(actor: AuthenticatedUser, id: string, fichier?: Fichier) {
    const acte = await this.charger(id);
    if (acte.statut !== ActeStatut.A_SIGNER) throw new ConflictException('Cet acte n’est pas à signer.');
    this.assertPeutSigner(actor, acte);
    this.acces.assertActe(await this.acces.contexte(actor), acte);
    const uniteCode = await this.numerotation.codeUnite(acte.uniteKey);

    const transaction = (saved: { fileKey: string; sizeBytes: number } | null) =>
      this.prisma.$transaction(async (tx) => {
        // Transition conditionnelle AVANT toute numérotation : un double-clic
        // ou une signature concurrente trouve 0 ligne → 409, aucun numéro consommé.
        const done = await tx.acteCourrier.updateMany({
          where: { id, statut: ActeStatut.A_SIGNER },
          data: { statut: ActeStatut.SIGNE },
        });
        if (done.count === 0) throw new ConflictException('Cet acte vient d’être signé (ou n’est plus à signer).');
        const n = await this.numerotation.attribuer(tx, acte.registre, acte.uniteKey, uniteCode);
        await tx.acteCourrier.update({
          where: { id },
          data: {
            annee: n.annee,
            sequence: n.sequence,
            numero: n.numero,
            signataireId: actor.id,
            signeAuNomDeId: actor.interimForId,
            signeAt: new Date(),
          },
        });
        if (saved && fichier) {
          await tx.pieceCourrier.create({
            data: {
              acteId: id,
              nature: PieceCourrierNature.ACTE_SIGNE,
              fileName: fichier.originalname,
              fileKey: saved.fileKey,
              mimeType: fichier.mimetype,
              sizeBytes: saved.sizeBytes,
              deposeParId: actor.id,
            },
          });
        }
        await this.audit.log(
          {
            actorId: actor.id,
            action: AuditAction.VALIDATION,
            entityType: 'ActeCourrier',
            entityId: id,
            metadata: { event: 'signature', numero: n.numero, registre: acte.registre.code, uniteKey: acte.uniteKey, auNomDeId: actor.interimForId },
          },
          tx,
        );
        return n.numero;
      }, TRANSACTION_NUMEROTATION);

    const numero = fichier
      ? await this.storage.saveThen(fichier.buffer, fichier.originalname, (saved) => transaction(saved))
      : await transaction(null);

    // Notifications APRÈS le commit.
    const signe = { ...acte, numero };
    await this.notifier([acte.redacteurId].filter((u) => u !== actor.id), NotificationType.ACTE_SIGNE, 'Acte signé', signe);
    const habilites = await this.prisma.habilitationCourrier.findMany({
      where: { registreId: acte.registreId, uniteKey: acte.uniteKey, revoqueeAt: null },
      select: { userId: true },
    });
    await this.notifier(habilites.map((h) => h.userId), NotificationType.ACTE_SIGNE, 'Acte signé à expédier', signe);
    if (acte.priseConnaissanceRequise && acte.beneficiaireId) {
      await this.notifier([acte.beneficiaireId], NotificationType.ACTE_PRISE_CONNAISSANCE, 'Acte à prendre en connaissance', signe);
    }
    return this.findOne(actor, id);
  }

  /**
   * Signataires autorisés (rôle effectif : la suppléance P.I. s'applique).
   * Jamais le bénéficiaire de l'acte, ni son suppléant en intérim.
   */
  private assertPeutSigner(actor: AuthenticatedUser, acte: ActeCharge): void {
    if (acte.beneficiaireId && (acte.beneficiaireId === actor.id || acte.beneficiaireId === actor.interimForId)) {
      throw new ForbiddenException('Le bénéficiaire d’un acte ne peut pas le signer (ni son suppléant en son nom).');
    }
    if (this.cascade.isLeadershipRole(actor.role)) return;
    if (acte.registre.portee === RegistrePortee.DIRECTION) {
      throw new ForbiddenException('Un acte de ce registre est signé par le DN ou la DNA.');
    }
    if (actor.role === SystemRole.CHEF_SECTION) {
      throw new ForbiddenException('Un Chef de Section ne signe pas : l’acte est signé par le chef de la Division ou de la Cellule émettrice.');
    }
    if (!this.acces.estChefUnite(actor, acte.uniteKey)) {
      throw new ForbiddenException('Vous ne pouvez signer que les actes de votre propre unité.');
    }
  }

  // ------------------------------------------------------------------
  // Expédition, annulation, prise de connaissance
  // ------------------------------------------------------------------

  async expedier(actor: AuthenticatedUser, id: string, dto: ExpedierDto) {
    const acte = await this.charger(id);
    const ctx = await this.acces.contexte(actor);
    if (!this.acces.estHabilite(ctx, acte.registreId, acte.uniteKey)) {
      throw new ForbiddenException('Seul le secrétariat habilité de ce registre expédie les actes signés.');
    }
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.acteCourrier.updateMany({
        where: { id, statut: ActeStatut.SIGNE },
        data: { statut: ActeStatut.EXPEDIE, expedieAt: new Date(), expedieParId: actor.id, modeExpedition: dto.modeExpedition },
      });
      if (done.count === 0) throw new ConflictException('Seul un acte signé, pas encore expédié, peut être expédié.');
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'ActeCourrier', entityId: id, metadata: { event: 'expedition', numero: acte.numero, mode: dto.modeExpedition } },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  /** Annulation motivée — le numéro éventuel est conservé, jamais de suppression. */
  async annuler(actor: AuthenticatedUser, id: string, dto: MotifDto) {
    const acte = await this.charger(id);
    if (acte.statut === ActeStatut.ANNULE) throw new ConflictException('Cet acte est déjà annulé.');
    if (acte.statut === ActeStatut.BROUILLON && acte.cycle === 0) {
      throw new ConflictException('Un brouillon jamais soumis se supprime, il ne s’annule pas.');
    }
    const numerote = acte.sequence !== null;
    const autorise = numerote
      ? (acte.signataireId && this.cascade.isActingFor(actor, acte.signataireId)) ||
        this.acces.estResponsableAction(actor, acte.registre.portee, acte.uniteKey)
      : actor.id === acte.redacteurId || this.acces.estResponsableAction(actor, acte.registre.portee, acte.uniteKey);
    if (!autorise) throw new ForbiddenException('Vous n’avez pas l’autorité pour annuler cet acte.');
    this.acces.assertActe(await this.acces.contexte(actor), acte);

    await this.prisma.$transaction(async (tx) => {
      const done = await tx.acteCourrier.updateMany({
        where: { id, statut: { not: ActeStatut.ANNULE } },
        data: { statut: ActeStatut.ANNULE, annuleAt: new Date(), annuleParId: actor.id, motifAnnulation: dto.motif },
      });
      if (done.count === 0) throw new ConflictException('Cet acte est déjà annulé.');
      await tx.visaActe.updateMany({
        where: { acteId: id, statut: VisaStatut.EN_ATTENTE },
        data: { statut: VisaStatut.SAUTE, motifSaut: 'Acte annulé' },
      });
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'ActeCourrier', entityId: id, metadata: { event: 'annulation', numero: acte.numero, motif: dto.motif } },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  /** « J'ai pris connaissance » — le bénéficiaire lui-même (actor.id strict), une seule fois. */
  async prendreConnaissance(actor: AuthenticatedUser, id: string) {
    const acte = await this.charger(id);
    if (acte.beneficiaireId !== actor.id) {
      throw new ForbiddenException('Seul le bénéficiaire de l’acte peut en attester la prise de connaissance.');
    }
    if (!acte.priseConnaissanceRequise) throw new ConflictException('Cet acte ne requiert pas de prise de connaissance.');
    if (acte.statut !== ActeStatut.SIGNE && acte.statut !== ActeStatut.EXPEDIE) {
      throw new ConflictException('L’acte doit être signé pour en prendre connaissance.');
    }
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.acteCourrier.updateMany({
        where: { id, priseConnaissanceAt: null },
        data: { priseConnaissanceAt: new Date() },
      });
      if (done.count === 0) throw new ConflictException('La prise de connaissance a déjà été enregistrée.');
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'ActeCourrier', entityId: id, metadata: { event: 'prise_de_connaissance', numero: acte.numero } },
        tx,
      );
    });
    return this.findOne(actor, id);
  }

  // ------------------------------------------------------------------
  // Pièces
  // ------------------------------------------------------------------

  async ajouterPieces(actor: AuthenticatedUser, id: string, fichiers: Fichier[]) {
    if (fichiers.length === 0) throw new BadRequestException('Aucun fichier reçu.');
    const acte = await this.charger(id);
    this.assertRedacteur(actor, acte);
    if (acte.statut !== ActeStatut.BROUILLON && acte.statut !== ActeStatut.RENVOYE) {
      throw new ConflictException('Les annexes se joignent au brouillon (ou après un renvoi).');
    }
    await this.storage.saveAllThen(
      fichiers.map((f) => ({ buffer: f.buffer, originalName: f.originalname })),
      (saved) =>
        this.prisma.pieceCourrier.createMany({
          data: saved.map((s, i) => ({
            acteId: id,
            nature: PieceCourrierNature.ANNEXE,
            fileName: fichiers[i]!.originalname,
            fileKey: s.fileKey,
            mimeType: fichiers[i]!.mimetype,
            sizeBytes: s.sizeBytes,
            deposeParId: actor.id,
          })),
        }),
    );
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'PieceCourrier', entityId: id, metadata: { event: 'pieces_acte', nombre: fichiers.length } });
    return this.findOne(actor, id);
  }

  async telechargerPiece(actor: AuthenticatedUser, id: string, pieceId: string) {
    const acte = await this.charger(id);
    this.acces.assertActe(await this.acces.contexte(actor), acte);
    const piece = await this.prisma.pieceCourrier.findUnique({ where: { id: pieceId } });
    if (!piece || piece.acteId !== id) throw new NotFoundException('Pièce introuvable pour cet acte');
    return { piece, stream: this.storage.createReadStream(piece.fileKey) };
  }

  // ------------------------------------------------------------------
  // Lecture
  // ------------------------------------------------------------------

  async lister(actor: AuthenticatedUser, filtres: ActeFiltresDto) {
    const ctx = await this.acces.contexte(actor);
    // Année = année de numérotation, ou de création tant que l'acte n'est pas
    // numéroté. Année explicite (filtre) : exactement cette année. Vue par
    // défaut : l'année en cours ET, quelle que soit leur année, tous les actes
    // encore en cours (ni expédiés ni annulés).
    const annee = filtres.annee ?? new Date().getFullYear();
    const deLAnnee: Prisma.ActeCourrierWhereInput[] = [
      { annee },
      { annee: null, createdAt: { gte: new Date(annee, 0, 1), lt: new Date(annee + 1, 0, 1) } },
    ];
    const periode: Prisma.ActeCourrierWhereInput = {
      OR: filtres.annee !== undefined ? deLAnnee : [...deLAnnee, { statut: { notIn: [ActeStatut.EXPEDIE, ActeStatut.ANNULE] } }],
    };
    const rows = await this.prisma.acteCourrier.findMany({
      where: { ...periode, registreId: filtres.registreId, statut: filtres.statut },
      select: ACTE_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    const q = filtres.q?.trim().toLowerCase();
    const projetes = rows
      .filter((a) => this.acces.niveauActe(ctx, a) === 'CONTENU')
      .map((a) => this.projeter(ctx, a))
      .filter((p) => !q || [p.numero ?? '', p.objet, p.destinataires ?? ''].some((v) => v.toLowerCase().includes(q)));
    return this.avecPersonnes(projetes);
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const ctx = await this.acces.contexte(actor);
    const acte = await this.charger(id);
    this.acces.assertActe(ctx, acte);
    const [projete] = await this.avecPersonnes([this.projeter(ctx, acte)]);
    const circuitObsolete = acte.statut === ActeStatut.EN_VISA ? await this.circuitObsolete(acte) : false;
    // Circuit obsolète : le rédacteur peut resoumettre (ActesService.soumettre).
    const droits = { ...projete!.droits, soumettre: projete!.droits.soumettre || (circuitObsolete && acte.redacteurId === ctx.actor.id) };
    return { ...projete!, droits, circuitObsolete };
  }

  /** Noms des personnes citées par chaque acte projeté (et par lui seul). */
  private async avecPersonnes<T extends ReturnType<ActesService['projeter']>>(projetes: T[]) {
    const cites = (p: T) => [
      p.redacteurId,
      p.beneficiaireId,
      p.signataireId,
      p.signeAuNomDeId,
      p.expedieParId,
      p.annuleParId,
      ...p.visas.flatMap((v) => [v.viseurAttenduId, v.viseParId, v.viseAuNomDeId]),
      ...p.pieces.map((f) => f.deposeParId),
    ];
    const annuaire = await chargerPersonnes(this.prisma, projetes.flatMap(cites));
    return projetes.map((p) => ({ ...p, personnes: personnesCitees(annuaire, cites(p)) }));
  }

  projeter(ctx: ContexteAcces, a: ActeCharge) {
    const { actor } = ctx;
    const { redacteur: _r, registre, ...reste } = a;
    const visa = this.visaCourant(a);
    const signable = a.statut === ActeStatut.A_SIGNER && this.peutSigner(actor, a);
    const viseur =
      a.statut === ActeStatut.EN_VISA && actor.id !== a.redacteurId && !!visa?.viseurAttenduId && this.cascade.isActingFor(actor, visa.viseurAttenduId);
    const responsable = this.acces.estResponsableAction(actor, a.registre.portee, a.uniteKey);
    // Annuler — mêmes règles que ActesService.annuler.
    const annulable =
      a.statut !== ActeStatut.ANNULE &&
      !(a.statut === ActeStatut.BROUILLON && a.cycle === 0) &&
      (a.sequence !== null
        ? (!!a.signataireId && this.cascade.isActingFor(actor, a.signataireId)) || responsable
        : actor.id === a.redacteurId || responsable);
    return {
      ...reste,
      registre: { id: registre.id, code: registre.code, libelle: registre.libelle, nature: registre.nature, portee: registre.portee },
      visaCourant: visa ?? null,
      enAttentePriseConnaissance: a.priseConnaissanceRequise && a.sequence !== null && !a.priseConnaissanceAt,
      droits: {
        modifier: a.redacteurId === actor.id && (a.statut === ActeStatut.BROUILLON || a.statut === ActeStatut.RENVOYE),
        supprimer: a.redacteurId === actor.id && a.statut === ActeStatut.BROUILLON && a.cycle === 0,
        soumettre: a.redacteurId === actor.id && (a.statut === ActeStatut.BROUILLON || a.statut === ActeStatut.RENVOYE),
        viser: viseur,
        // Renvoyer : le viseur attendu (EN_VISA) ou le signataire (A_SIGNER) — ActesService.renvoyer.
        renvoyer: viseur || signable,
        signer: signable,
        expedier: a.statut === ActeStatut.SIGNE && this.acces.estHabilite(ctx, a.registreId, a.uniteKey),
        annuler: annulable,
        ajouterPiece: a.redacteurId === actor.id && (a.statut === ActeStatut.BROUILLON || a.statut === ActeStatut.RENVOYE),
        prendreConnaissance: a.beneficiaireId === actor.id && a.priseConnaissanceRequise && !a.priseConnaissanceAt && a.sequence !== null,
        deleguer:
          a.confidentialite === CourrierConfidentialite.CONFIDENTIEL &&
          !actor.interimForId &&
          this.acces.niveauActe(ctx, a, { sansDelegation: true }) === 'CONTENU',
      },
    };
  }

  private peutSigner(actor: AuthenticatedUser, acte: ActeCharge): boolean {
    try {
      this.assertPeutSigner(actor, acte);
      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Aides
  // ------------------------------------------------------------------

  async charger(id: string): Promise<ActeCharge> {
    const acte = await this.prisma.acteCourrier.findUnique({ where: { id }, select: ACTE_SELECT });
    if (!acte) throw new NotFoundException('Acte introuvable');
    return acte;
  }

  private assertRedacteur(actor: AuthenticatedUser, acte: ActeCharge): void {
    if (acte.redacteurId !== actor.id) throw new ForbiddenException('Seul le rédacteur peut effectuer cette action.');
  }

  /** Le visa est nominatif (viseur attendu figé) : le viseur attendu qui vise
   * alors que son onglet est en intérim d'un autre agit en SON nom propre —
   * « au nom de » n'est posé que lorsqu'il vise pour le titulaire. */
  private auNomDuViseur(actor: AuthenticatedUser, viseurAttenduId: string): string | null {
    return viseurAttenduId === actor.id ? null : (actor.interimForId ?? null);
  }

  private visaCourant(acte: ActeCharge): Visa | undefined {
    return acte.visas.find((v) => v.cycle === acte.cycle && v.statut === VisaStatut.EN_ATTENTE);
  }

  /** Rattachement RÉEL (jamais le rôle emprunté d'un intérim). */
  private async chargerPersonne(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!u) throw new NotFoundException('Utilisateur introuvable');
    return u;
  }

  private async resoudreRegistre(registreId: string, redacteur: { divisionId: string | null; celluleId: string | null }) {
    const registre = await this.prisma.registreCourrier.findUnique({ where: { id: registreId } });
    if (!registre || !registre.isActive) throw new NotFoundException('Registre introuvable ou inactif');
    if (registre.nature === RegistreNature.ARRIVEE) throw new BadRequestException('Un acte se rédige dans un registre de départ ou d’actes.');
    if (registre.portee === RegistrePortee.DIRECTION) return { registreId, uniteKey: UNITE_DIRECTION };
    const unite = uniteDe(redacteur);
    if (!unite) throw new BadRequestException('Registre d’unité : vous n’êtes rattaché à aucune Division ni Cellule.');
    return { registreId, uniteKey: unite };
  }

  private async validerChamps(
    actor: AuthenticatedUser,
    d: { beneficiaireId?: string; priseConnaissanceRequise?: boolean; repondAId?: string },
  ): Promise<void> {
    if (d.priseConnaissanceRequise && !d.beneficiaireId) {
      throw new BadRequestException('La prise de connaissance exige un bénéficiaire.');
    }
    if (d.beneficiaireId) {
      const b = await this.prisma.user.findUnique({ where: { id: d.beneficiaireId }, select: { status: true, role: true } });
      if (!b) throw new NotFoundException('Bénéficiaire introuvable');
      if (b.role === SystemRole.ADMIN_SYSTEME) {
        throw new ForbiddenException('L’administrateur système n’a pas accès au courrier : il ne peut pas être le bénéficiaire d’un acte.');
      }
      if (b.status !== UserStatus.ACTIF) throw new BadRequestException('Bénéficiaire : compte inactif.');
    }
    if (d.repondAId) {
      const arrivee = await this.prisma.courrierArrivee.findUnique({ where: { id: d.repondAId }, select: ARRIVEE_ACCES_SELECT });
      if (!arrivee) throw new NotFoundException('Courrier arrivée introuvable');
      const ctx = await this.acces.contexte(actor);
      this.acces.assertArrivee(ctx, arrivee, 'CONTENU');
    }
  }

  /** Niveaux du circuit : Chef de Section du rédacteur, puis Chef de sa
   * Division/Cellule — ce dernier retiré pour la portée UNITE (il signe). */
  private async niveauxDuCircuit(
    r: { divisionId: string | null; sectionId: string | null; celluleId: string | null },
    portee: RegistrePortee,
  ): Promise<NiveauCircuit[]> {
    const chefs = (where: Prisma.UserWhereInput) =>
      this.prisma.user.findMany({ where: { ...where, status: UserStatus.ACTIF }, select: { id: true } });
    const niveaux: NiveauCircuit[] = [];
    if (r.divisionId && r.sectionId) {
      niveaux.push({ niveau: SystemRole.CHEF_SECTION, chefs: await chefs({ role: SystemRole.CHEF_SECTION, divisionId: r.divisionId, sectionId: r.sectionId }) });
    }
    if (portee === RegistrePortee.DIRECTION) {
      if (r.divisionId) {
        niveaux.push({ niveau: SystemRole.CHEF_DIVISION, chefs: await chefs({ role: SystemRole.CHEF_DIVISION, divisionId: r.divisionId }) });
      } else if (r.celluleId) {
        niveaux.push({ niveau: SystemRole.CHEF_CELLULE, chefs: await chefs({ role: SystemRole.CHEF_CELLULE, celluleId: r.celluleId }) });
      }
    }
    return niveaux;
  }

  /** Le viseur attendu (figé à la soumission) occupe-t-il toujours ce poste ? */
  private async viseurToujoursChef(acte: ActeCharge, visa: Visa): Promise<boolean> {
    if (!visa.viseurAttenduId) return true;
    const v = await this.prisma.user.findUnique({
      where: { id: visa.viseurAttenduId },
      select: { role: true, status: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!v || v.status !== UserStatus.ACTIF || v.role !== visa.niveau) return false;
    const r = acte.redacteur;
    if (visa.niveau === SystemRole.CHEF_SECTION) return v.divisionId === r.divisionId && v.sectionId === r.sectionId;
    if (visa.niveau === SystemRole.CHEF_DIVISION) return v.divisionId === r.divisionId;
    return v.celluleId === r.celluleId;
  }

  private async circuitObsolete(acte: ActeCharge): Promise<boolean> {
    const visa = this.visaCourant(acte);
    return !!visa && !(await this.viseurToujoursChef(acte, visa));
  }

  /** Viseur plus chef : le rédacteur est prévenu, il doit resoumettre. */
  private async assertViseurToujoursChef(acte: ActeCharge, visa: Visa): Promise<void> {
    if (await this.viseurToujoursChef(acte, visa)) return;
    await this.notifier(
      [acte.redacteurId],
      NotificationType.ACTE_RENVOYE,
      'Circuit de visa à recalculer',
      acte,
      'Le viseur attendu n’occupe plus ce poste : resoumettez l’acte pour recalculer le circuit.',
    );
    throw new ConflictException(
      'Le viseur attendu n’occupe plus ce poste. Le rédacteur a été prévenu : il doit resoumettre l’acte pour recalculer le circuit.',
    );
  }

  private async notifierSignataires(acte: ActeCharge): Promise<void> {
    const ids = await responsablesDeUnite(this.prisma, acte.uniteKey);
    await this.notifier(ids.filter((id) => id !== acte.beneficiaireId), NotificationType.ACTE_A_SIGNER, 'Acte à signer', acte);
  }

  private async notifier(
    userIds: string[],
    type: NotificationType,
    titre: string,
    acte: { id: string; numero: string | null; objet: string; confidentialite: CourrierConfidentialite },
    complement?: string,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.notifications.notifyMany(
      [...new Set(userIds)],
      type,
      titre,
      `Acte ${libelleActe(acte)}.${complement ? ` ${complement}` : ''}`,
      `/courrier?acte=${acte.id}`,
    );
  }
}

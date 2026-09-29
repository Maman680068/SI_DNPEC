import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActeStatut,
  AuditAction,
  CourrierConfidentialite,
  ModeleAttestationType,
  PeriodeStageStatut,
  PieceCourrierNature,
  RegistreNature,
  RegistrePortee,
  StageStatut,
  SystemRole,
  UserStatus,
} from '@prisma/client';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import PDFKit from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import * as fs from 'fs';
import { StorageService } from '../common/storage/storage.service';
import { PREFIXE_INTEGRE, assertReglagesStages, cheminIntegre } from './reglages-stages';
import { PersonnelHistoryService } from '../personnel/personnel-history.service';
import { ActesService } from '../courrier/actes.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { estDrh } from '../socle/roles-fonctionnels';

/** Champs disponibles dans un modèle d'attestation (Word : {{CLE}} ; PDF :
 * champ de formulaire nommé CLE). Le nom vient toujours du compte à jour. */
export const CHAMPS_ATTESTATION: { cle: string; description: string }[] = [
  { cle: 'PRENOM', description: 'Prénom du stagiaire (compte à jour)' },
  { cle: 'NOM', description: 'Nom du stagiaire, en majuscules (compte à jour)' },
  { cle: 'NOM_COMPLET', description: 'Prénom et NOM du stagiaire' },
  { cle: 'ETABLISSEMENT', description: 'Établissement d’origine' },
  { cle: 'DIPLOME', description: 'Diplôme préparé' },
  { cle: 'ENCADRANT', description: 'Encadrant académique' },
  { cle: 'DATE_DEBUT', description: 'Début du stage (ex. 3 mars 2027)' },
  { cle: 'DATE_FIN', description: 'Fin du stage (fin effective en cas d’interruption)' },
  { cle: 'DUREE', description: 'Durée en jours' },
  { cle: 'UNITES', description: 'Unités parcourues, avec leurs dates' },
  { cle: 'TUTEURS', description: 'Tuteurs successifs' },
  { cle: 'NUMERO', description: 'Numéro de l’attestation (vide tant qu’elle n’est pas signée)' },
  { cle: 'SIGNATAIRE', description: 'Signataire (DN ou DNA) une fois signée' },
  { cle: 'DATE_DU_JOUR', description: 'Date de production du document' },
];
const CLES = new Set(CHAMPS_ATTESTATION.map((c) => c.cle));
const PROVISOIRE = 'PROVISOIRE — NON SIGNÉE';
const EFFECTIVES: PeriodeStageStatut[] = [PeriodeStageStatut.EN_COURS, PeriodeStageStatut.TERMINEE];

const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export interface DocumentGenere {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

/**
 * Attestation de fin de stage (D6) :
 * - modèle importé par le DRH (Word à champs {{CLE}}, ou PDF à champs de
 *   formulaire), champs inconnus refusés à l'import ;
 * - version PROVISOIRE en PDF (mention « Provisoire — non signée », sans
 *   numéro), tant que la version finale n'est pas signée ;
 * - version FINALE = acte du module Courrier (registre d'actes), document
 *   rempli joint, stagiaire bénéficiaire avec prise de connaissance ; numéro
 *   attribué à la signature par DN/DNA (circuit du module Courrier).
 */
@Injectable()
export class AttestationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly history: PersonnelHistoryService,
    private readonly actes: ActesService,
  ) {}

  // ------------------------------------------------------------------ modèle

  async modele(actor: AuthenticatedUser) {
    assertReglagesStages(actor);
    const m = await this.modeleActif();
    return {
      champsDisponibles: CHAMPS_ATTESTATION,
      modele: m && { id: m.id, type: m.type, fileName: m.fileName, champs: m.champs, createdAt: m.createdAt, importePar: m.importePar, parDefaut: m.fileKey.startsWith(PREFIXE_INTEGRE) },
    };
  }

  async importerModele(actor: AuthenticatedUser, fichier: { buffer: Buffer; originalname: string } | undefined) {
    assertReglagesStages(actor);
    if (!fichier) throw new BadRequestException('Aucun fichier reçu.');
    const nom = fichier.originalname.toLowerCase();
    const type = nom.endsWith('.docx') ? ModeleAttestationType.DOCX : nom.endsWith('.pdf') ? ModeleAttestationType.PDF : null;
    if (!type) throw new BadRequestException('Modèle attendu : document Word (.docx) ou PDF à champs de formulaire (.pdf).');
    const champs = type === ModeleAttestationType.DOCX ? this.champsDocx(fichier.buffer) : await this.champsPdf(fichier.buffer);
    const inconnus = champs.filter((c) => !CLES.has(c));
    if (inconnus.length) {
      throw new BadRequestException(`Champs inconnus dans le modèle : ${inconnus.join(', ')}. Champs disponibles : ${[...CLES].join(', ')}.`);
    }
    if (!champs.length) {
      throw new BadRequestException(
        type === ModeleAttestationType.DOCX
          ? 'Aucun champ trouvé : insérez des champs sous la forme {{NOM_COMPLET}}, {{DATE_DEBUT}}…'
          : 'Aucun champ de formulaire trouvé dans ce PDF : nommez ses champs NOM_COMPLET, DATE_DEBUT…',
      );
    }
    const cree = await this.storage.saveThen(fichier.buffer, fichier.originalname, ({ fileKey }) =>
      this.prisma.$transaction(async (tx) => {
        await tx.modeleAttestation.updateMany({ where: { actif: true }, data: { actif: false } });
        return tx.modeleAttestation.create({ data: { type, fileKey, fileName: fichier.originalname, champs, importeParId: actor.id }, select: { id: true } });
      }),
    );
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'ModeleAttestation', entityId: cree.id, metadata: { type, fileName: fichier.originalname, champs } });
    return this.modele(actor);
  }

  /** Registres que creerActe accepte : registres d'actes actifs. */
  async registres(actor: AuthenticatedUser) {
    this.assertDrh(actor);
    return this.prisma.registreCourrier.findMany({
      where: { nature: RegistreNature.ACTE, portee: RegistrePortee.DIRECTION, isActive: true },
      select: { id: true, code: true, libelle: true, portee: true },
      orderBy: { code: 'asc' },
    });
  }

  async telechargerModele(actor: AuthenticatedUser) {
    assertReglagesStages(actor);
    const m = await this.modeleActif();
    if (!m) throw new NotFoundException('Aucun modèle d’attestation importé');
    const stream = m.fileKey.startsWith(PREFIXE_INTEGRE) ? fs.createReadStream(cheminIntegre(m.fileKey)) : this.storage.createReadStream(m.fileKey);
    return { fileName: m.fileName, stream };
  }

  // ------------------------------------------------------------- documents

  /** Version provisoire (PDF), tant que la finale n'est pas signée. */
  async provisoire(actor: AuthenticatedUser, stageId: string): Promise<DocumentGenere> {
    this.assertDrh(actor);
    const stage = await this.chargerStage(stageId);
    if (this.finaleSignee(stage.attestationActe)) throw new ConflictException('L’attestation finale est signée : la version provisoire n’est plus disponible.');
    const valeurs = await this.valeurs(stage, { numero: '', signataire: '' });
    const m = await this.modeleActif();
    const buffer = m?.type === ModeleAttestationType.PDF ? await this.remplirPdf(m.fileKey, valeurs, true) : await this.pdfStandard(valeurs, true);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Stage', entityId: stageId, metadata: { event: 'attestation_provisoire' } });
    return { buffer, fileName: `attestation-provisoire-${this.slug(valeurs.NOM_COMPLET ?? '')}.pdf`, mimeType: 'application/pdf' };
  }

  /** Document rempli depuis le modèle (sans mention provisoire) : c'est la
   * pièce jointe à l'acte ; le numéro et le signataire y figurent une fois
   * l'acte signé. Sans modèle importé : mise en page standard (PDF). */
  async document(actor: AuthenticatedUser, stageId: string): Promise<DocumentGenere> {
    this.assertDrh(actor);
    const stage = await this.chargerStage(stageId);
    return this.produireDocument(stage);
  }

  /** Version finale : acte du module Courrier, document rempli joint. */
  async creerActe(actor: AuthenticatedUser, stageId: string, registreId: string) {
    this.assertDrh(actor);
    const stage = await this.chargerStage(stageId);
    if (stage.statut !== StageStatut.TERMINE && stage.statut !== StageStatut.INTERROMPU) {
      throw new ConflictException('L’attestation finale se prépare une fois le stage clôturé ou interrompu.');
    }
    if (stage.attestationActe && stage.attestationActe.statut !== ActeStatut.ANNULE) {
      throw new ConflictException('L’attestation finale de ce stage existe déjà (acte en cours dans le module Courrier).');
    }
    const registre = await this.prisma.registreCourrier.findUnique({ where: { id: registreId } });
    if (!registre) throw new NotFoundException('Registre introuvable');
    if (registre.nature !== RegistreNature.ACTE || registre.portee !== RegistrePortee.DIRECTION || !registre.isActive) {
      throw new BadRequestException('Choisissez un registre d’actes actif de la Direction (signature par le DN ou la DNA).');
    }
    if (stage.stagiaire.status !== UserStatus.ACTIF) throw new ConflictException('Le compte du stagiaire n’est plus actif : il ne peut pas être bénéficiaire de l’acte.');
    const doc = await this.produireDocument(stage);
    const acte = await this.actes.creer(actor, {
      registreId,
      objet: `Attestation de stage — ${stage.stagiaire.firstName} ${stage.stagiaire.lastName.toUpperCase()}`,
      corps: `Attestation de fin de stage (${stage.etablissement}), du ${dateFr(stage.dateDebut)} au ${dateFr(await this.finEffective(stage))}.`,
      confidentialite: CourrierConfidentialite.ORDINAIRE,
      beneficiaireId: stage.stagiaireId,
      priseConnaissanceRequise: true,
    });
    await this.actes.ajouterPieces(actor, acte.id, [{ buffer: doc.buffer, originalname: doc.fileName, mimetype: doc.mimeType } as never]);
    await this.prisma.stage.update({ where: { id: stageId }, data: { attestationActeId: acte.id } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Stage', entityId: stageId, metadata: { event: 'attestation_acte', acteId: acte.id, registre: registre.code } });
    return { acteId: acte.id };
  }

  /** Prise de connaissance de l'attestation finale, par le stagiaire depuis son stage. */
  async prendreConnaissance(actor: AuthenticatedUser, stageId: string) {
    const stage = await this.chargerStage(stageId);
    if (actor.id !== stage.stagiaireId) throw new ForbiddenException('Seul le stagiaire prend connaissance de son attestation.');
    if (!stage.attestationActe) throw new NotFoundException('Aucune attestation finale pour ce stage.');
    await this.actes.attesterPriseDeConnaissance(actor, stage.attestationActe.id);
  }

  /** Scan de l'attestation signée : stagiaire, DRH, DN/DNA. */
  async telechargerFinale(actor: AuthenticatedUser, stageId: string) {
    const stage = await this.chargerStage(stageId);
    const autorise = actor.id === stage.stagiaireId || estDrh(actor) || actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    if (!autorise) throw new ForbiddenException('Réservé au stagiaire, au DRH et à la Direction.');
    const piece = stage.attestationActe?.pieces.find((p) => p.nature === PieceCourrierNature.ACTE_SIGNE);
    if (!piece || !this.finaleSignee(stage.attestationActe)) throw new NotFoundException('L’attestation signée n’est pas encore disponible.');
    return { fileName: piece.fileName, stream: this.storage.createReadStream(piece.fileKey) };
  }

  /** État de l'attestation pour la fiche du stage (droits calculés ici). */
  async etat(actor: AuthenticatedUser, stageId: string, vue: string) {
    const stage = await this.chargerStage(stageId);
    const a = stage.attestationActe;
    const signee = this.finaleSignee(a);
    const drh = vue === 'DRH';
    const scan = !!a?.pieces.some((p) => p.nature === PieceCourrierNature.ACTE_SIGNE);
    const lecteur = drh || vue === 'STAGIAIRE' || vue === 'DIRECTION';
    return {
      modeleImporte: drh ? !!(await this.modeleActif()) : undefined,
      acte: a && lecteur && (drh || signee) ? { id: a.id, statut: a.statut, numero: a.numero, signeAt: a.signeAt, priseConnaissanceAt: a.priseConnaissanceAt } : null,
      droits: {
        provisoire: drh && !signee,
        document: drh,
        creerActe: drh && (stage.statut === StageStatut.TERMINE || stage.statut === StageStatut.INTERROMPU) && (!a || a.statut === ActeStatut.ANNULE),
        prendreConnaissance: vue === 'STAGIAIRE' && signee && !!a?.priseConnaissanceRequise && !a?.priseConnaissanceAt,
        telechargerFinale: lecteur && signee && scan,
      },
    };
  }

  // ------------------------------------------------------------------ interne

  private async produireDocument(stage: Awaited<ReturnType<AttestationService['chargerStage']>>): Promise<DocumentGenere> {
    const a = stage.attestationActe;
    const signee = this.finaleSignee(a);
    const signataire = signee && a?.signataire ? `${a.signataire.firstName} ${a.signataire.lastName}` : '';
    const valeurs = await this.valeurs(stage, { numero: signee ? a?.numero ?? '' : '', signataire });
    const m = await this.modeleActif();
    const base = `attestation-${this.slug(valeurs.NOM_COMPLET ?? '')}`;
    if (m?.type === ModeleAttestationType.DOCX) {
      return { buffer: await this.remplirDocx(m.fileKey, valeurs), fileName: `${base}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    const buffer = m?.type === ModeleAttestationType.PDF ? await this.remplirPdf(m.fileKey, valeurs, false) : await this.pdfStandard(valeurs, false);
    return { buffer, fileName: `${base}.pdf`, mimeType: 'application/pdf' };
  }

  private async chargerStage(id: string) {
    const s = await this.prisma.stage.findUnique({
      where: { id },
      select: {
        id: true, statut: true, etablissement: true, diplomePrepare: true, encadrantAcademique: true, dateDebut: true, dateFin: true, clotureAt: true, stagiaireId: true,
        stagiaire: { select: { firstName: true, lastName: true, status: true } },
        periodes: {
          where: { statut: { in: EFFECTIVES } },
          orderBy: { dateDebut: 'asc' },
          select: { divisionId: true, sectionId: true, celluleId: true, dateDebut: true, dateFin: true, tuteur: { select: { firstName: true, lastName: true } } },
        },
        attestationActe: {
          select: {
            id: true, statut: true, numero: true, signeAt: true, priseConnaissanceRequise: true, priseConnaissanceAt: true,
            signataire: { select: { firstName: true, lastName: true } },
            pieces: { select: { id: true, nature: true, fileName: true, fileKey: true } },
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Stage introuvable');
    return s;
  }

  private finaleSignee(a: { statut: ActeStatut } | null | undefined): boolean {
    return !!a && (a.statut === ActeStatut.SIGNE || a.statut === ActeStatut.EXPEDIE);
  }

  private async finEffective(stage: { statut: StageStatut; dateFin: Date; periodes: { dateFin: Date }[] }): Promise<Date> {
    if (stage.statut === StageStatut.INTERROMPU && stage.periodes.length) return stage.periodes[stage.periodes.length - 1]!.dateFin;
    return stage.dateFin;
  }

  private async valeurs(stage: Awaited<ReturnType<AttestationService['chargerStage']>>, x: { numero: string; signataire: string }): Promise<Record<string, string>> {
    const fin = await this.finEffective(stage);
    const unites = [];
    for (const p of stage.periodes) unites.push(`${await this.history.describeAttachment(p)} (du ${dateFr(p.dateDebut)} au ${dateFr(p.dateFin)})`);
    const tuteurs = [...new Set(stage.periodes.filter((p) => p.tuteur).map((p) => `${p.tuteur!.firstName} ${p.tuteur!.lastName}`))];
    const duree = Math.round((fin.getTime() - stage.dateDebut.getTime()) / 86400000) + 1;
    return {
      PRENOM: stage.stagiaire.firstName,
      NOM: stage.stagiaire.lastName.toUpperCase(),
      NOM_COMPLET: `${stage.stagiaire.firstName} ${stage.stagiaire.lastName.toUpperCase()}`,
      ETABLISSEMENT: stage.etablissement,
      DIPLOME: stage.diplomePrepare ?? '',
      ENCADRANT: stage.encadrantAcademique ?? '',
      DATE_DEBUT: dateFr(stage.dateDebut),
      DATE_FIN: dateFr(fin),
      DUREE: `${duree} jours`,
      UNITES: unites.join(' ; '),
      TUTEURS: tuteurs.join(', '),
      NUMERO: x.numero,
      SIGNATAIRE: x.signataire,
      DATE_DU_JOUR: dateFr(new Date()),
    };
  }

  private champsDocx(buffer: Buffer): string[] {
    try {
      // Le parseur est appelé pour chaque champ à la compilation du modèle.
      const tags = new Set<string>();
      new Docxtemplater(new PizZip(buffer), {
        delimiters: { start: '{{', end: '}}' },
        paragraphLoop: true,
        linebreaks: true,
        parser: (tag: string) => {
          tags.add(tag.trim());
          return { get: () => '' };
        },
      });
      return [...tags];
    } catch (e) {
      throw new BadRequestException(`Document Word illisible ou champ mal formé : ${this.messageDocx(e)}`);
    }
  }

  private async champsPdf(buffer: Buffer): Promise<string[]> {
    try {
      const pdf = await PDFDocument.load(buffer);
      return pdf.getForm().getFields().map((f) => f.getName());
    } catch {
      throw new BadRequestException('PDF illisible.');
    }
  }

  private async lire(fileKey: string): Promise<Buffer> {
    if (fileKey.startsWith(PREFIXE_INTEGRE)) return fs.promises.readFile(cheminIntegre(fileKey));
    const chunks: Buffer[] = [];
    for await (const c of this.storage.createReadStream(fileKey)) chunks.push(Buffer.from(c as Buffer));
    return Buffer.concat(chunks);
  }

  private async remplirDocx(fileKey: string, valeurs: Record<string, string>): Promise<Buffer> {
    const doc = new Docxtemplater(new PizZip(await this.lire(fileKey)), { delimiters: { start: '{{', end: '}}' }, paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    doc.render(valeurs);
    return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
  }

  private async remplirPdf(fileKey: string, valeurs: Record<string, string>, provisoire: boolean): Promise<Buffer> {
    const pdf = await PDFDocument.load(await this.lire(fileKey));
    const form = pdf.getForm();
    for (const f of form.getFields()) {
      const v = valeurs[f.getName()];
      if (v === undefined) continue;
      try {
        form.getTextField(f.getName()).setText(v);
      } catch {
        // champ non textuel : ignoré
      }
    }
    form.flatten();
    if (provisoire) {
      const police = await pdf.embedFont(StandardFonts.HelveticaBold);
      for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        page.drawText('PROVISOIRE - NON SIGNEE', { x: width * 0.12, y: height * 0.35, size: 42, font: police, color: rgb(0.8, 0.1, 0.1), opacity: 0.35, rotate: degrees(35) });
      }
    }
    return Buffer.from(await pdf.save());
  }

  /** Mise en page standard (sans modèle importé), PDF A4. */
  private pdfStandard(v: Record<string, string>, provisoire: boolean): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFKit({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(10).text('RÉPUBLIQUE DE GUINÉE', { align: 'center' }).text('Travail — Justice — Solidarité', { align: 'center' });
      doc.moveDown(0.5).text('Ministère de l’Économie, des Finances et du Budget', { align: 'center' });
      doc.text('Direction Nationale des Prévisions Économiques et de la Conjoncture (DNPEC)', { align: 'center' });
      if (provisoire) doc.moveDown().fillColor('#b22222').fontSize(14).text(PROVISOIRE, { align: 'center' }).fillColor('black');
      doc.moveDown(2).fontSize(18).text('ATTESTATION DE STAGE', { align: 'center' });
      doc.moveDown(0.3).fontSize(11).text(v.NUMERO ? `N° ${v.NUMERO}` : 'N° —', { align: 'center' });
      doc.moveDown(2).fontSize(12).text(
        `Le Directeur National des Prévisions Économiques et de la Conjoncture atteste que ${v.NOM_COMPLET}` +
          `${v.ETABLISSEMENT ? `, de ${v.ETABLISSEMENT}` : ''}${v.DIPLOME ? ` (${v.DIPLOME})` : ''}, a effectué un stage à la DNPEC ` +
          `du ${v.DATE_DEBUT} au ${v.DATE_FIN} (${v.DUREE}).`,
        { align: 'justify' },
      );
      if (v.UNITES) doc.moveDown().text(`Unités d’accueil : ${v.UNITES}.`, { align: 'justify' });
      if (v.TUTEURS) doc.moveDown().text(`Tuteurs : ${v.TUTEURS}.`);
      doc.moveDown().text('En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.', { align: 'justify' });
      doc.moveDown(2).text(`Conakry, le ${v.DATE_DU_JOUR}`, { align: 'right' });
      doc.moveDown(3).text(v.SIGNATAIRE || (provisoire ? PROVISOIRE : ''), { align: 'right' });
      doc.end();
    });
  }

  private async modeleActif() {
    return this.prisma.modeleAttestation.findFirst({ where: { actif: true }, include: { importePar: { select: { id: true, firstName: true, lastName: true } } } });
  }

  private assertDrh(actor: AuthenticatedUser) {
    if (!estDrh(actor)) throw new ForbiddenException('Réservé au DRH.');
  }

  private slug(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  }

  private messageDocx(e: unknown): string {
    const err = e as { properties?: { errors?: { properties?: { explanation?: string } }[] }; message?: string };
    return err.properties?.errors?.map((x) => x.properties?.explanation).filter(Boolean).join(' ; ') || err.message || 'erreur';
  }
}

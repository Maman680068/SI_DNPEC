import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActeStatut, AuditAction, CourrierConfidentialite, Prisma, RegistreNature, RegistrePortee, StatutDiffusion, SystemRole, TaskStatus, TypeDocument, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ActesService } from '../courrier/actes.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskFiltersDto } from '../tasks/dto/task-filters.dto';
import { DocumentsService } from '../documents/documents.service';
import { MessagesService } from '../communication/messages/messages.service';
import { PersonnelHistoryService } from '../personnel/personnel-history.service';
import { ExportsService, MENTION_STATUT } from '../socle/exports.service';
import { estDrh } from '../socle/roles-fonctionnels';
import { montantEnLettres } from '../socle/montant-en-lettres';
import { Bloc, MIME_DOCX, MIME_PDF, PageDocument, dateFr, renduDocx, renduPdf, slug } from './mise-en-page';
import { Perimetre, ProduireDto, TransmettreDto, TypeGenere } from './dto/produire.dto';
import { OrdreMissionDto } from './dto/actes-generes.dto';
import { PlanTravailService } from '../plan-travail/plan-travail.service';

export interface FichierGenere {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  /** Édition enregistrée d'un document signé (1 = original, > 1 = duplicata). */
  edition: number | null;
}

const LIBELLES: Record<TypeGenere, string> = {
  ATTESTATION_TRAVAIL: 'Attestation de travail',
  ORDRE_MISSION: 'Ordre de mission',
  RAPPORT_ACTIVITE: 'Rapport d’activité',
};
const PROJET = 'PROJET — non signé';
const DUPLICATA = 'DUPLICATA';
const QUALITE_SIGNATAIRE = 'Le Directeur National';
const signe = (a: { statut: ActeStatut } | null | undefined) => !!a && (a.statut === ActeStatut.SIGNE || a.statut === ActeStatut.EXPEDIE);
const civilite = (genre: string | null | undefined) => (genre === 'F' ? 'Madame' : genre === 'M' ? 'Monsieur' : '');
const nomComplet = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName.toUpperCase()}`;
const jour = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);
const ACTE_SELECT = { id: true, statut: true, numero: true, signeAt: true, signataire: { select: { firstName: true, lastName: true } } } satisfies Prisma.ActeCourrierSelect;
type ActeCharge = Prisma.ActeCourrierGetPayload<{ select: typeof ACTE_SELECT }>;
const STATUT_TACHE: Record<TaskStatus, string> = {
  A_FAIRE: 'À faire', EN_COURS: 'En cours', SOUMISE_VALIDATION: 'Soumise', VALIDEE: 'Validée', REJETEE: 'Rejetée', TERMINEE: 'Terminée',
};

/**
 * Documents générés (socle N4, SIG-RF-DOC) : attestation de travail, ordre de mission, rapport
 * d'activité, produits sans ressaisie à partir des données enregistrées, sur le modèle de page commun
 * (PDF et Word identiques). Un document opposable devient un acte du module Courrier (numéro, visa,
 * signature) ; chaque édition d'un document signé est enregistrée, les suivantes portent « DUPLICATA ».
 */
@Injectable()
export class GenerateurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly cascade: CascadeService,
    private readonly actes: ActesService,
    private readonly plan: PlanTravailService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
    private readonly messages: MessagesService,
    private readonly history: PersonnelHistoryService,
    private readonly exports: ExportsService,
  ) {}

  // ------------------------------------------------------------------ catalogue (droits et listes de choix)

  async catalogue(actor: AuthenticatedUser) {
    const drh = estDrh(actor);
    const direction = this.direction(actor);
    const subordonnes = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE }, id: { not: actor.id } },
      select: { id: true, firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const personne = (u: { id: string; firstName: string; lastName: string }) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}` });
    const missionnables = subordonnes.filter((u) => this.cascade.hasDirectAuthorityOver(actor, u)).map(personne);
    const registres = await this.prisma.registreCourrier.findMany({
      where: { nature: RegistreNature.ACTE, portee: RegistrePortee.DIRECTION, isActive: true },
      select: { id: true, code: true, libelle: true },
      orderBy: { code: 'asc' },
    });
    return {
      attestationTravail: { peutCreer: drh, agents: drh ? subordonnes.map(personne) : [] },
      ordreMission: { peutCreer: missionnables.length > 0, agents: missionnables },
      rapportActivite: { perimetres: await this.perimetres(actor) },
      registres: drh || direction || missionnables.length ? registres : [],
      peutDeposerEnGed: !!actor.divisionId || (!!actor.celluleId && actor.role !== SystemRole.STAGIAIRE),
      // Transmission par la messagerie : tout compte actif (comme la messagerie elle-même).
      destinataires: (await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, id: { not: actor.id } }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })).map(personne),
    };
  }

  /** Périmètres de rapport d'activité ouverts à l'acteur (soi, ses subordonnés, ses unités, la Direction). */
  private async perimetres(actor: AuthenticatedUser) {
    const res: { perimetre: Perimetre; cibleId: string | null; libelle: string }[] = [{ perimetre: 'AGENT', cibleId: actor.id, libelle: 'Mon activité' }];
    const direction = this.direction(actor);
    if (direction) res.push({ perimetre: 'DIRECTION', cibleId: null, libelle: 'Toute la Direction' });
    const divisions = await this.prisma.division.findMany({ select: { id: true, name: true, sections: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } });
    for (const d of divisions) {
      const chef = actor.role === SystemRole.CHEF_DIVISION && actor.divisionId === d.id;
      if (direction || chef) res.push({ perimetre: 'DIVISION', cibleId: d.id, libelle: d.name });
      for (const s of d.sections) {
        if (direction || chef || (actor.role === SystemRole.CHEF_SECTION && actor.sectionId === s.id)) res.push({ perimetre: 'SECTION', cibleId: s.id, libelle: `${s.name} (${d.name})` });
      }
    }
    for (const c of await this.prisma.cellule.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })) {
      if (direction || (actor.role === SystemRole.CHEF_CELLULE && actor.celluleId === c.id)) res.push({ perimetre: 'CELLULE', cibleId: c.id, libelle: c.name });
    }
    return res;
  }

  // ------------------------------------------------------------------ attestations de travail (DRH)

  async creerAttestation(actor: AuthenticatedUser, agentId: string) {
    this.assertDrh(actor);
    const u = await this.prisma.user.findUnique({ where: { id: agentId }, select: { id: true, status: true, role: true, firstName: true, lastName: true } });
    if (!u || u.status !== UserStatus.ACTIF) throw new BadRequestException('Agent introuvable ou inactif.');
    if (u.role === SystemRole.STAGIAIRE) throw new BadRequestException('Un stagiaire reçoit une attestation de stage, pas une attestation de travail.');
    const a = await this.prisma.attestationTravail.create({ data: { agentId, creeParId: actor.id } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'AttestationTravail', entityId: a.id, metadata: { agentId } });
    return this.vueAttestation(actor, a.id);
  }

  async listeAttestations(actor: AuthenticatedUser) {
    const where: Prisma.AttestationTravailWhereInput = estDrh(actor) ? {} : { agentId: actor.id };
    const liste = await this.prisma.attestationTravail.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true } });
    return Promise.all(liste.map((a) => this.vueAttestation(actor, a.id)));
  }

  private async vueAttestation(actor: AuthenticatedUser, id: string) {
    const a = await this.chargerAttestation(id);
    const drh = estDrh(actor);
    if (!drh && a.agentId !== actor.id) throw new ForbiddenException('Attestation réservée à l’agent et au DRH.');
    const acte = a.acteId ? await this.chargerActe(a.acteId) : null;
    const agent = await this.prisma.user.findUniqueOrThrow({ where: { id: a.agentId }, select: { id: true, firstName: true, lastName: true } });
    return {
      id: a.id,
      type: 'ATTESTATION_TRAVAIL' as const,
      agent: { id: agent.id, nom: `${agent.firstName} ${agent.lastName}` },
      createdAt: a.createdAt,
      acte: acte ? { id: acte.id, statut: acte.statut, numero: signe(acte) ? acte.numero : null } : null,
      droits: {
        produire: drh || (a.agentId === actor.id && signe(acte)),
        preparerActe: drh && (!acte || acte.statut === ActeStatut.ANNULE),
      },
    };
  }

  async acteAttestation(actor: AuthenticatedUser, id: string, registreId: string) {
    this.assertDrh(actor);
    const a = await this.chargerAttestation(id);
    const agent = await this.prisma.user.findUniqueOrThrow({ where: { id: a.agentId }, select: { firstName: true, lastName: true } });
    return this.creerActe(actor, { type: 'ATTESTATION_TRAVAIL', attestationId: id }, registreId, a.acteId, {
      objet: `Attestation de travail — ${nomComplet(agent)}`,
      beneficiaireId: a.agentId,
      lier: (acteId) => this.prisma.attestationTravail.update({ where: { id }, data: { acteId } }),
    });
  }

  // ------------------------------------------------------------------ ordres de mission

  async creerOrdre(actor: AuthenticatedUser, dto: OrdreMissionDto) {
    const agent = await this.prisma.user.findUnique({ where: { id: dto.agentId }, select: { id: true, status: true, role: true, divisionId: true, sectionId: true, celluleId: true } });
    if (!agent || agent.status !== UserStatus.ACTIF) throw new BadRequestException('Agent introuvable ou inactif.');
    if (!this.cascade.hasDirectAuthorityOver(actor, agent)) throw new ForbiddenException('L’ordre de mission est établi par le chef direct de l’agent, le DN ou la DNA.');
    if (jour(dto.dateRetour) < jour(dto.dateDepart)) throw new BadRequestException('La date de retour précède la date de départ.');
    const o = await this.prisma.ordreMission.create({
      data: {
        agentId: dto.agentId,
        objet: dto.objet.trim(),
        destination: dto.destination.trim(),
        dateDepart: jour(dto.dateDepart),
        dateRetour: jour(dto.dateRetour),
        transport: dto.transport?.trim() || null,
        fraisMontant: dto.fraisMontant ?? null,
        creeParId: actor.id,
      },
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'OrdreMission', entityId: o.id, metadata: { agentId: dto.agentId, destination: o.destination } });
    return this.vueOrdre(actor, o.id);
  }

  async listeOrdres(actor: AuthenticatedUser) {
    const tous = await this.prisma.ordreMission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, agentId: true, creeParId: true, agent: { select: { id: true, divisionId: true, sectionId: true, celluleId: true } } },
    });
    const visibles = tous.filter((o) => this.ordreVisible(actor, o));
    return Promise.all(visibles.map((o) => this.vueOrdre(actor, o.id)));
  }

  private ordreVisible(actor: AuthenticatedUser, o: { agentId: string; creeParId: string; agent: { id: string; divisionId: string | null; sectionId: string | null; celluleId: string | null } }) {
    return o.agentId === actor.id || o.creeParId === actor.id || estDrh(actor) || this.cascade.hasDirectAuthorityOver(actor, o.agent);
  }

  private async vueOrdre(actor: AuthenticatedUser, id: string) {
    const o = await this.chargerOrdre(id);
    if (!this.ordreVisible(actor, o)) throw new ForbiddenException('Ordre de mission hors de votre périmètre.');
    const acte = o.acteId ? await this.chargerActe(o.acteId) : null;
    const redacteur = o.creeParId === actor.id || this.direction(actor);
    return {
      id: o.id,
      type: 'ORDRE_MISSION' as const,
      agent: { id: o.agent.id, nom: `${o.agent.firstName} ${o.agent.lastName}` },
      objet: o.objet,
      destination: o.destination,
      dateDepart: o.dateDepart,
      dateRetour: o.dateRetour,
      transport: o.transport,
      // Véhicule de service affecté par le gestionnaire logistique (N6) : affiché à l'écran, jamais
      // ajouté au document opposable (le texte signé ne change pas après la signature).
      vehicule: o.vehicule ? { ...o.vehicule, kilometrageDepart: o.kilometrageDepart, kilometrageRetour: o.kilometrageRetour } : null,
      fraisMontant: o.fraisMontant,
      fraisEnLettres: o.fraisMontant != null ? montantEnLettres(o.fraisMontant) : null,
      acte: acte ? { id: acte.id, statut: acte.statut, numero: signe(acte) ? acte.numero : null } : null,
      droits: {
        produire: true,
        preparerActe: redacteur && (!acte || acte.statut === ActeStatut.ANNULE),
      },
    };
  }

  async acteOrdre(actor: AuthenticatedUser, id: string, registreId: string) {
    const o = await this.chargerOrdre(id);
    if (o.creeParId !== actor.id && !this.direction(actor)) throw new ForbiddenException('L’acte est préparé par l’auteur de l’ordre de mission, le DN ou la DNA.');
    return this.creerActe(actor, { type: 'ORDRE_MISSION', ordreMissionId: id }, registreId, o.acteId, {
      objet: `Ordre de mission — ${nomComplet(o.agent)} — ${o.destination}`,
      beneficiaireId: o.agentId,
      lier: (acteId) => this.prisma.ordreMission.update({ where: { id }, data: { acteId } }),
    });
  }

  /** Acte du module Courrier (registre d'actes de la Direction), document projet joint. */
  private async creerActe(
    actor: AuthenticatedUser,
    source: ProduireDto,
    registreId: string,
    acteExistant: string | null,
    x: { objet: string; beneficiaireId: string; lier: (acteId: string) => Promise<unknown> },
  ) {
    if (acteExistant) {
      const a = await this.chargerActe(acteExistant);
      if (a.statut !== ActeStatut.ANNULE) throw new ConflictException('L’acte existe déjà (en cours dans le module Courrier).');
    }
    const registre = await this.prisma.registreCourrier.findUnique({ where: { id: registreId } });
    if (!registre || registre.nature !== RegistreNature.ACTE || registre.portee !== RegistrePortee.DIRECTION || !registre.isActive) {
      throw new BadRequestException('Choisissez un registre d’actes actif de la Direction (signature par le DN ou la DNA).');
    }
    const doc = await this.produire(actor, { ...source, format: 'PDF' }, { enregistrer: false });
    const acte = await this.actes.creer(actor, {
      registreId,
      objet: x.objet,
      corps: `${LIBELLES[source.type]} produite par NIMBA à partir des données enregistrées ; document joint.`,
      confidentialite: CourrierConfidentialite.ORDINAIRE,
      beneficiaireId: x.beneficiaireId,
      priseConnaissanceRequise: true,
    });
    await this.actes.ajouterPieces(actor, acte.id, [{ buffer: doc.buffer, originalname: doc.fileName, mimetype: doc.mimeType } as never]);
    await x.lier(acte.id);
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: source.type === 'ORDRE_MISSION' ? 'OrdreMission' : 'AttestationTravail', entityId: (source.ordreMissionId ?? source.attestationId)!, metadata: { event: 'acte_prepare', acteId: acte.id, registre: registre.code } });
    return { acteId: acte.id };
  }

  // ------------------------------------------------------------------ production (aperçu, téléchargement, GED, transmission)

  /**
   * Produit le document. `enregistrer` : une édition d'un document signé est comptée (la 2e et les
   * suivantes portent « DUPLICATA ») ; l'aperçu n'enregistre rien mais montre exactement ce qui sera imprimé.
   */
  async produire(actor: AuthenticatedUser, dto: ProduireDto, o: { enregistrer: boolean }): Promise<FichierGenere> {
    const format = dto.format ?? 'PDF';
    const { page, base, signeActe, objetId, statut } = await this.construire(actor, dto);
    let edition: number | null = null;
    if (signeActe) {
      const deja = await this.prisma.documentGenere.count({ where: { type: dto.type, objetId } });
      edition = deja + 1;
      if (deja > 0) page.mentions = [...(page.mentions ?? []), DUPLICATA];
      if (o.enregistrer) {
        await this.prisma.documentGenere.create({ data: { type: dto.type, objetId, acteId: signeActe.id, edition, format, parId: actor.id } });
        await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: dto.type === 'ORDRE_MISSION' ? 'OrdreMission' : 'AttestationTravail', entityId: objetId, metadata: { event: deja > 0 ? 'duplicata' : 'edition_originale', edition, format } });
      } else edition = null;
    }
    if (statut) page.mentions = [...(page.mentions ?? []), MENTION_STATUT[statut]];
    const pdf = format === 'PDF';
    return {
      buffer: pdf ? await renduPdf(page) : renduDocx(page),
      fileName: `${base}${edition && edition > 1 ? '-duplicata' : ''}.${pdf ? 'pdf' : 'docx'}`,
      mimeType: pdf ? MIME_PDF : MIME_DOCX,
      edition,
    };
  }

  /** Dépôt en GED : document Brouillon dans l'unité de l'acteur (division ou cellule), type et période renseignés. */
  async deposerEnGed(actor: AuthenticatedUser, dto: ProduireDto) {
    if (!actor.divisionId && !actor.celluleId) throw new ConflictException('Vous n’avez pas d’espace documentaire de division ou de cellule : dépôt impossible.');
    const f = await this.produire(actor, { ...dto, format: dto.format ?? 'PDF' }, { enregistrer: true });
    const { titre, periode } = await this.metaGed(dto);
    const d = await this.documents.create(
      actor,
      { title: titre, typeDocument: dto.type === 'RAPPORT_ACTIVITE' ? TypeDocument.RAPPORT : TypeDocument.ACTE, periodeDebut: periode[0], periodeFin: periode[1], ...(actor.divisionId ? { divisionId: actor.divisionId } : { celluleId: actor.celluleId! }) },
      { buffer: f.buffer, originalname: f.fileName, mimetype: f.mimeType } as Express.Multer.File,
    );
    return { documentId: d.id };
  }

  /** Transmission par la messagerie : PDF joint au message. */
  async transmettre(actor: AuthenticatedUser, dto: TransmettreDto) {
    const f = await this.produire(actor, { ...dto, format: 'PDF' }, { enregistrer: true });
    const { fileKey } = await this.storage.save(f.buffer, f.fileName);
    const corps = dto.message?.trim() || `${LIBELLES[dto.type]} en pièce jointe.`;
    await this.messages.send(actor, { recipientId: dto.destinataireId, body: corps, attachmentKey: fileKey, attachmentName: f.fileName });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'DocumentGenere', entityId: dto.type, metadata: { event: 'transmis', destinataireId: dto.destinataireId, fichier: f.fileName } });
    return { transmis: true };
  }

  // ------------------------------------------------------------------ construction du contenu

  private async construire(actor: AuthenticatedUser, dto: ProduireDto): Promise<{ page: PageDocument; base: string; signeActe: ActeCharge | null; objetId: string; statut: StatutDiffusion | null }> {
    const lieuDate = `Conakry, le ${dateFr(new Date())}`;
    if (dto.type === 'ATTESTATION_TRAVAIL') {
      if (!dto.attestationId) throw new BadRequestException('Attestation à produire non précisée.');
      const vue = await this.vueAttestation(actor, dto.attestationId);
      if (!vue.droits.produire) throw new ForbiddenException('Votre attestation est disponible une fois signée.');
      const a = await this.chargerAttestation(dto.attestationId);
      const acte = a.acteId ? await this.chargerActe(a.acteId) : null;
      const u = await this.prisma.user.findUniqueOrThrow({
        where: { id: a.agentId },
        select: { firstName: true, lastName: true, jobTitle: true, divisionId: true, sectionId: true, celluleId: true, agent: { select: { matricule: true, fonction: true, genre: true } }, personnelFileBasic: { select: { grade: true, serviceStartDate: true } } },
      });
      const unite = await this.history.describeAttachment(u);
      const fonction = u.agent?.fonction || u.jobTitle;
      const civ = civilite(u.agent?.genre);
      const texte =
        `Le Directeur National des Prévisions Économiques et de la Conjoncture atteste que ${civ ? `${civ} ` : ''}${nomComplet(u)}` +
        `${u.agent?.matricule ? `, matricule ${u.agent.matricule}` : ''}${u.personnelFileBasic?.grade ? `, ${u.personnelFileBasic.grade}` : ''}, ` +
        `est en service à la Direction Nationale des Prévisions Économiques et de la Conjoncture${u.personnelFileBasic?.serviceStartDate ? ` depuis le ${dateFr(u.personnelFileBasic.serviceStartDate)}` : ''}` +
        `${fonction ? `, en qualité de ${fonction}` : ''}${unite ? ` (${unite})` : ''}.`;
      const signeA = signe(acte);
      return {
        page: {
          titre: 'Attestation de travail',
          numero: signeA ? acte!.numero : null,
          mentions: signeA ? [] : [PROJET],
          corps: [{ type: 'paragraphe', texte }, { type: 'paragraphe', texte: 'En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.' }],
          lieuDate,
          signature: { qualite: QUALITE_SIGNATAIRE, nom: signeA && acte!.signataire ? nomComplet(acte!.signataire) : null },
        },
        base: `attestation-travail-${slug(nomComplet(u))}`,
        signeActe: signeA ? acte : null,
        objetId: a.id,
        statut: null,
      };
    }
    if (dto.type === 'ORDRE_MISSION') {
      if (!dto.ordreMissionId) throw new BadRequestException('Ordre de mission à produire non précisé.');
      await this.vueOrdre(actor, dto.ordreMissionId);
      const o = await this.chargerOrdre(dto.ordreMissionId);
      const acte = o.acteId ? await this.chargerActe(o.acteId) : null;
      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: o.agentId }, select: { firstName: true, lastName: true, jobTitle: true, divisionId: true, sectionId: true, celluleId: true, agent: { select: { matricule: true, fonction: true, genre: true } } } });
      const unite = await this.history.describeAttachment(u);
      const civ = civilite(u.agent?.genre);
      const signeA = signe(acte);
      const champs: [string, string][] = [
        ['Nom et prénoms', `${civ ? `${civ} ` : ''}${nomComplet(u)}`],
        ['Matricule', u.agent?.matricule ?? ''],
        ['Fonction', u.agent?.fonction || u.jobTitle || ''],
        ['Unité', unite],
        ['Destination', o.destination],
        ['Objet de la mission', o.objet],
        ['Date de départ', dateFr(o.dateDepart)],
        ['Date de retour', dateFr(o.dateRetour)],
        ['Moyen de transport', o.transport ?? ''],
      ];
      if (o.fraisMontant != null) champs.push(['Frais de mission', montantEnLettres(o.fraisMontant)]);
      return {
        page: {
          titre: 'Ordre de mission',
          numero: signeA ? acte!.numero : null,
          mentions: signeA ? [] : [PROJET],
          corps: [
            { type: 'paragraphe', texte: 'Le Directeur National des Prévisions Économiques et de la Conjoncture ordonne la mission suivante :' },
            { type: 'champs', lignes: champs },
            { type: 'paragraphe', texte: 'Les autorités civiles et militaires sont priées de faciliter l’accomplissement de la présente mission.' },
          ],
          lieuDate,
          signature: { qualite: QUALITE_SIGNATAIRE, nom: signeA && acte!.signataire ? nomComplet(acte!.signataire) : null },
        },
        base: `ordre-mission-${slug(nomComplet(u))}-${o.dateDepart.toISOString().slice(0, 10)}`,
        signeActe: signeA ? acte : null,
        objetId: o.id,
        statut: null,
      };
    }
    return this.rapportActivite(actor, dto, lieuDate);
  }

  /** Rapport d'activité : tâches de la période et du périmètre, jamais ressaisi (SIG-RF-DOC-08). */
  private async rapportActivite(actor: AuthenticatedUser, dto: ProduireDto, lieuDate: string) {
    if (!dto.debut || !dto.fin) throw new BadRequestException('Période du rapport obligatoire (début et fin).');
    const debut = jour(dto.debut), fin = new Date(jour(dto.fin).getTime() + 86400000 - 1);
    if (fin < debut) throw new BadRequestException('La fin de la période précède son début.');
    const perimetre = dto.perimetre ?? 'AGENT';
    const { libelle, membres } = await this.perimetreRapport(actor, perimetre, perimetre === 'AGENT' ? dto.cibleId ?? actor.id : dto.cibleId ?? null);
    // Même requête que l'écran des tâches : jamais une tâche que l'acteur ne verrait pas.
    const visibles = await this.tasks.findAllVisibleTo(actor, Object.assign(new TaskFiltersDto(), { includeSubtasks: 'false' }));
    const fini = (s: TaskStatus) => s === TaskStatus.TERMINEE || s === TaskStatus.VALIDEE;
    const taches = visibles.filter(
      (t) => t.assignees.some((a) => membres.has(a.userId)) && t.createdAt <= fin && (!fini(t.status) || (t.completedAt && t.completedAt >= debut)),
    );
    const terminees = taches.filter((t) => fini(t.status) && t.completedAt && t.completedAt <= fin);
    const enCours = taches.filter((t) => !fini(t.status));
    const enRetard = enCours.filter((t) => t.dueDate && t.dueDate < fin);
    const auteur = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { firstName: true, lastName: true } });
    const noms = new Map((await this.prisma.user.findMany({ where: { id: { in: [...new Set(taches.flatMap((t) => t.assignees.map((a) => a.userId)))] } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const ligne = (t: (typeof taches)[number]) => [
      t.title,
      t.assignees.map((a) => noms.get(a.userId) ?? '').filter(Boolean).join(', '),
      t.dueDate ? dateFr(t.dueDate) : '',
      STATUT_TACHE[t.status],
      `${t.progressPercent ?? 0} %`,
    ];
    const entetes = ['Tâche', 'Assignés', 'Échéance', 'Statut', 'Avancement'];
    const corps: Bloc[] = [
      { type: 'champs', lignes: [['Périmètre', libelle], ['Période', `du ${dateFr(debut)} au ${dateFr(jour(dto.fin))}`], ['Établi par', `${auteur.firstName} ${auteur.lastName}`]] },
      { type: 'intertitre', texte: 'Synthèse' },
      { type: 'tableau', entetes: ['Tâches suivies', 'Terminées', 'En cours', 'Dont en retard'], lignes: [[String(taches.length), String(terminees.length), String(enCours.length), String(enRetard.length)]] },
      { type: 'intertitre', texte: `Tâches terminées (${terminees.length})` },
      terminees.length ? { type: 'tableau', entetes, lignes: terminees.map(ligne), largeurs: [4, 3, 2, 1.5, 1.5] } : { type: 'paragraphe', texte: 'Aucune tâche terminée sur la période.' },
      { type: 'intertitre', texte: `Tâches en cours (${enCours.length})` },
      enCours.length ? { type: 'tableau', entetes, lignes: enCours.map(ligne), largeurs: [4, 3, 2, 1.5, 1.5] } : { type: 'paragraphe', texte: 'Aucune tâche en cours.' },
    ];
    // Socle N5 : activités du plan de travail du périmètre qui chevauchent la période (avancement calculé).
    const cible = perimetre === 'DIRECTION' ? {} : perimetre === 'AGENT' ? { responsableId: dto.cibleId ?? actor.id } : perimetre === 'DIVISION' ? { divisionId: dto.cibleId! } : perimetre === 'SECTION' ? { sectionId: dto.cibleId! } : { celluleId: dto.cibleId! };
    const activites = await this.plan.activitesDuPerimetre(cible, debut, fin);
    corps.push(
      { type: 'intertitre', texte: `Activités du plan de travail (${activites.length})` },
      activites.length
        ? {
            type: 'tableau',
            entetes: ['Activité', 'Responsable', 'Échéance', 'Indicateur', 'Avancement'],
            lignes: activites.map((a) => [`${a.libelle} (${a.objectif})`, a.responsable.nom, dateFr(a.dateFin), [a.indicateur, a.cible].filter(Boolean).join(' — '), `${a.avancement} %${a.enRetard ? ' — en retard' : ''}`]),
            largeurs: [4, 2.5, 2, 2.5, 1.5],
          }
        : { type: 'paragraphe', texte: 'Aucune activité du plan de travail sur la période.' },
    );
    return {
      page: { titre: 'Rapport d’activité', numero: null, mentions: [], corps, lieuDate },
      base: `rapport-activite-${slug(libelle)}-${dto.debut.slice(0, 10)}-${dto.fin.slice(0, 10)}`,
      signeActe: null,
      objetId: '',
      // Rapport calculé, non validé : il circule comme un brouillon (§7.1).
      statut: StatutDiffusion.BROUILLON,
    };
  }

  private async perimetreRapport(actor: AuthenticatedUser, perimetre: Perimetre, cibleId: string | null): Promise<{ libelle: string; membres: Set<string> }> {
    const direction = this.direction(actor);
    const refus = () => new ForbiddenException('Ce périmètre de rapport ne vous est pas ouvert.');
    const membres = async (where: Prisma.UserWhereInput) => new Set((await this.prisma.user.findMany({ where, select: { id: true } })).map((u) => u.id));
    if (perimetre === 'DIRECTION') {
      if (!direction) throw refus();
      return { libelle: 'Direction (DNPEC)', membres: await membres({}) };
    }
    if (!cibleId) throw new BadRequestException('Périmètre à préciser.');
    if (perimetre === 'AGENT') {
      const u = await this.prisma.user.findUnique({ where: { id: cibleId }, select: { id: true, firstName: true, lastName: true, divisionId: true, sectionId: true, celluleId: true } });
      if (!u) throw new NotFoundException('Agent introuvable');
      if (u.id !== actor.id && !this.cascade.hasDirectAuthorityOver(actor, u)) throw refus();
      return { libelle: `${u.firstName} ${u.lastName}`, membres: new Set([u.id]) };
    }
    if (perimetre === 'DIVISION') {
      const d = await this.prisma.division.findUnique({ where: { id: cibleId } });
      if (!d) throw new NotFoundException('Division introuvable');
      if (!direction && !(actor.role === SystemRole.CHEF_DIVISION && actor.divisionId === d.id)) throw refus();
      return { libelle: d.name, membres: await membres({ divisionId: d.id }) };
    }
    if (perimetre === 'SECTION') {
      const s = await this.prisma.section.findUnique({ where: { id: cibleId }, include: { division: true } });
      if (!s) throw new NotFoundException('Section introuvable');
      const chef = (actor.role === SystemRole.CHEF_DIVISION && actor.divisionId === s.divisionId) || (actor.role === SystemRole.CHEF_SECTION && actor.sectionId === s.id);
      if (!direction && !chef) throw refus();
      return { libelle: `${s.name} (${s.division.name})`, membres: await membres({ sectionId: s.id }) };
    }
    const c = await this.prisma.cellule.findUnique({ where: { id: cibleId } });
    if (!c) throw new NotFoundException('Cellule introuvable');
    if (!direction && !(actor.role === SystemRole.CHEF_CELLULE && actor.celluleId === c.id)) throw refus();
    return { libelle: c.name, membres: await membres({ celluleId: c.id }) };
  }

  private async metaGed(dto: ProduireDto): Promise<{ titre: string; periode: [string, string] }> {
    const auj = new Date().toISOString().slice(0, 10);
    if (dto.type === 'RAPPORT_ACTIVITE') return { titre: `Rapport d’activité du ${dto.debut!.slice(0, 10)} au ${dto.fin!.slice(0, 10)}`, periode: [dto.debut!, dto.fin!] };
    if (dto.type === 'ORDRE_MISSION') {
      const o = await this.chargerOrdre(dto.ordreMissionId!);
      return { titre: `Ordre de mission — ${nomComplet(o.agent)} — ${o.destination}`, periode: [o.dateDepart.toISOString(), o.dateRetour.toISOString()] };
    }
    const a = await this.chargerAttestation(dto.attestationId!);
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: a.agentId }, select: { firstName: true, lastName: true } });
    return { titre: `Attestation de travail — ${nomComplet(u)}`, periode: [auj, auj] };
  }

  // ------------------------------------------------------------------ interne

  private direction(actor: AuthenticatedUser) {
    return actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
  }

  private assertDrh(actor: AuthenticatedUser) {
    if (!estDrh(actor)) throw new ForbiddenException('Réservé au DRH.');
  }

  private async chargerAttestation(id: string) {
    const a = await this.prisma.attestationTravail.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Attestation introuvable');
    return a;
  }

  private async chargerOrdre(id: string) {
    const o = await this.prisma.ordreMission.findUnique({ where: { id }, include: { agent: { select: { id: true, firstName: true, lastName: true, divisionId: true, sectionId: true, celluleId: true } }, vehicule: { select: { immatriculation: true, marque: true, modele: true } } } });
    if (!o) throw new NotFoundException('Ordre de mission introuvable');
    return o;
  }

  private chargerActe(id: string): Promise<ActeCharge> {
    return this.prisma.acteCourrier.findUniqueOrThrow({ where: { id }, select: ACTE_SELECT });
  }
}

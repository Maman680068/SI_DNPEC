import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ActeStatut,
  AuditAction,
  CourrierConfidentialite,
  NotificationType,
  Prisma,
  RegistreNature,
  RegistrePortee,
  StatutMouvementCarriere,
  SystemRole,
  TypeMouvementCarriere,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { ActesService } from '../courrier/actes.service';
import { ReprisesN1Service } from '../socle/reprise-n1.service';
import { estDrh } from '../socle/roles-fonctionnels';
import { rattachementPourRole } from '../role-change/roles';
import { dateFr, renduPdf, slug } from '../generateur/mise-en-page';
import { FamilleRegistreDto, MouvementDto } from './dto/rh.dto';

/** Famille d'actes qui porte chaque type de mouvement (séquence et signataire de son registre). */
export const FAMILLE_PAR_TYPE: Record<TypeMouvementCarriere, string> = {
  NOMINATION: 'DECISION_NOMINATION',
  AVANCEMENT_ECHELON: 'DECISION_AVANCEMENT',
  PROMOTION: 'DECISION_AVANCEMENT',
  MUTATION: 'ARRETE_AFFECTATION',
  FIN_CONTRAT: 'DECISION_FIN_CONTRAT',
};
export const LIBELLE_TYPE: Record<TypeMouvementCarriere, string> = {
  NOMINATION: 'Nomination',
  AVANCEMENT_ECHELON: 'Avancement d’échelon',
  PROMOTION: 'Promotion',
  MUTATION: 'Mutation',
  FIN_CONTRAT: 'Fin de contrat',
};
const OUVERTS: StatutMouvementCarriere[] = [StatutMouvementCarriere.PREPARE, StatutMouvementCarriere.EN_ACTE];
/** Rôles mutés par un mouvement de carrière ; les autres changent de poste par le changement de rôle. */
const ROLES_MUTABLES: SystemRole[] = [SystemRole.AGENT, SystemRole.DRH, SystemRole.ADMIN_SYSTEME];
const jour = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);
type Valeurs = Record<string, string | null>;

/**
 * Carrière et actes des RH (socle N6, cahier NIMBA A3.6, SIG-RF-CAR-04 à 06).
 * - Mouvement daté (nomination, avancement d'échelon, promotion, mutation, fin de contrat) préparé par
 *   le DRH : valeurs avant (lues dans le dossier) et après.
 * - « Préparer l'acte » : acte du Courrier dans le registre de la famille (séquence propre, numéro
 *   continu attribué à la signature, signataire du registre : DN ou DNA), document joint.
 * - À la signature de l'acte (dans sa transaction) : le dossier est mis à jour, le mouvement passe
 *   « Appliqué », la Direction et l'agent sont notifiés. La grille de rémunération viendra avec D5.
 */
@Injectable()
export class CarriereService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly actes: ActesService,
    private readonly reprise: ReprisesN1Service,
  ) {}

  onModuleInit() {
    this.actes.surSignature((tx, acte, actor) => this.appliquer(tx, acte.id, acte.numero, actor));
  }

  private assertDrh(actor: AuthenticatedUser) {
    if (!estDrh(actor)) throw new ForbiddenException('Les mouvements de carrière sont instruits par le DRH.');
  }

  private direction(actor: AuthenticatedUser) {
    return actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
  }

  // ------------------------------------------------------------------ familles d'actes

  async familles(actor: AuthenticatedUser) {
    const gerer = estDrh(actor) || actor.role === SystemRole.ADMIN_SYSTEME;
    if (!gerer && !this.direction(actor)) throw new ForbiddenException('Réservé au DRH, à l’administrateur, au DN et à la DNA.');
    const familles = await this.prisma.familleActeRh.findMany({
      orderBy: { libelle: 'asc' },
      select: { code: true, libelle: true, registre: { select: { id: true, code: true, libelle: true, isActive: true } } },
    });
    const registres = gerer
      ? await this.prisma.registreCourrier.findMany({ where: { nature: RegistreNature.ACTE, portee: RegistrePortee.DIRECTION, isActive: true }, select: { id: true, code: true, libelle: true }, orderBy: { code: 'asc' } })
      : [];
    return { familles: familles.map((f) => ({ ...f, signataire: 'DN ou DNA' })), registresPossibles: registres, droits: { gerer } };
  }

  async choisirRegistre(actor: AuthenticatedUser, code: string, dto: FamilleRegistreDto) {
    if (!estDrh(actor) && actor.role !== SystemRole.ADMIN_SYSTEME) throw new ForbiddenException('Réservé au DRH et à l’administrateur.');
    const famille = await this.prisma.familleActeRh.findUnique({ where: { code } });
    if (!famille) throw new NotFoundException('Famille d’actes introuvable.');
    if (dto.registreId) {
      const r = await this.prisma.registreCourrier.findUnique({ where: { id: dto.registreId } });
      if (!r || r.nature !== RegistreNature.ACTE || r.portee !== RegistrePortee.DIRECTION || !r.isActive) {
        throw new BadRequestException('Choisissez un registre d’actes actif de la Direction (signature par le DN ou la DNA).');
      }
      const autre = await this.prisma.familleActeRh.findFirst({ where: { registreId: dto.registreId, code: { not: code } } });
      if (autre) throw new ConflictException(`Ce registre porte déjà la famille « ${autre.libelle} » : chaque famille a sa propre séquence.`);
    }
    const f = await this.prisma.familleActeRh.update({ where: { code }, data: { registreId: dto.registreId ?? null } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'FamilleActeRh', entityId: code, metadata: { registreId: f.registreId } });
    return this.familles(actor);
  }

  // ------------------------------------------------------------------ mouvements

  async liste(actor: AuthenticatedUser, userId?: string) {
    const tout = estDrh(actor) || this.direction(actor);
    if (!tout && userId && userId !== actor.id) throw new ForbiddenException('Vous ne voyez que vos propres mouvements de carrière.');
    const where: Prisma.MouvementCarriereWhereInput = tout ? (userId ? { userId } : {}) : { userId: actor.id, statut: StatutMouvementCarriere.APPLIQUE };
    const lignes = await this.prisma.mouvementCarriere.findMany({
      where,
      orderBy: [{ dateEffet: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, userId: true, type: true, avant: true, apres: true, dateEffet: true, motif: true, statut: true, familleCode: true, acteId: true, appliqueLe: true, createdAt: true, acte: { select: { id: true, numero: true, statut: true } } },
    });
    const noms = new Map((await this.prisma.user.findMany({ where: { id: { in: [...new Set(lignes.map((l) => l.userId))] } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const drh = estDrh(actor);
    return {
      mouvements: lignes.map((m) => ({
        ...m,
        libelleType: LIBELLE_TYPE[m.type],
        agent: noms.get(m.userId) ?? null,
        droits: {
          preparerActe: drh && (m.statut === StatutMouvementCarriere.PREPARE || (m.statut === StatutMouvementCarriere.EN_ACTE && m.acte?.statut === ActeStatut.ANNULE)),
          annuler: drh && (m.statut === StatutMouvementCarriere.PREPARE || (m.statut === StatutMouvementCarriere.EN_ACTE && m.acte?.statut === ActeStatut.ANNULE)),
        },
      })),
      droits: { preparer: drh },
      agents: drh ? await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }) : [],
    };
  }

  /** État actuel du dossier, pour le « avant » d'un mouvement. */
  private async etat(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, role: true, status: true, jobTitle: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true, agentId: true,
        agent: { select: { id: true, fonction: true, dateFinPrevue: true, natureFinPrevue: true } },
        personnelFileBasic: { select: { grade: true, echelon: true, categorie: true, employmentStatus: true } },
      },
    });
    if (!u || u.status !== UserStatus.ACTIF) throw new NotFoundException('Agent introuvable ou inactif.');
    return u;
  }

  async preparer(actor: AuthenticatedUser, dto: MouvementDto) {
    this.assertDrh(actor);
    if (dto.userId === actor.id) throw new ForbiddenException('Le DRH n’instruit pas son propre mouvement de carrière.');
    const u = await this.etat(dto.userId);
    if (u.role === SystemRole.STAGIAIRE) throw new BadRequestException('Un stagiaire n’a pas de carrière : son stage est suivi dans le module Stages.');
    const ouvert = await this.prisma.mouvementCarriere.findFirst({ where: { userId: u.id, type: dto.type, statut: { in: OUVERTS } } });
    if (ouvert) throw new ConflictException('Un mouvement de ce type est déjà en cours pour cet agent.');
    const a = dto.apres ?? {};
    const texte = (cle: string, libelle: string) => {
      const v = typeof a[cle] === 'string' ? a[cle]!.trim() : '';
      if (!v) throw new BadRequestException(`${libelle} : valeur après le mouvement obligatoire.`);
      if (v.length > 120) throw new BadRequestException(`${libelle} : 120 caractères au plus.`);
      return v;
    };
    let avant: Valeurs;
    let apres: Valeurs;
    const f = u.personnelFileBasic;
    switch (dto.type) {
      case TypeMouvementCarriere.NOMINATION:
        avant = { fonction: u.agent?.fonction ?? u.jobTitle ?? null };
        apres = { fonction: texte('fonction', 'Fonction') };
        break;
      case TypeMouvementCarriere.AVANCEMENT_ECHELON:
        avant = { echelon: f?.echelon ?? null };
        apres = { echelon: texte('echelon', 'Échelon') };
        break;
      case TypeMouvementCarriere.PROMOTION:
        avant = { grade: f?.grade ?? null, echelon: f?.echelon ?? null, categorie: f?.categorie ?? null };
        apres = { grade: texte('grade', 'Grade'), echelon: a.echelon?.trim() || null, categorie: a.categorie?.trim() || null };
        break;
      case TypeMouvementCarriere.MUTATION: {
        if (!ROLES_MUTABLES.includes(u.role)) {
          throw new ConflictException('Un chef, un assistant ou un membre de la Direction change de poste par le changement de rôle (Utilisateurs), pas par une mutation.');
        }
        const r = rattachementPourRole(u.role, { divisionId: a.divisionId ?? null, sectionId: a.sectionId ?? null, celluleId: a.celluleId ?? null, supervisorId: u.supervisorId });
        await this.verifierRattachement(r);
        if (r.divisionId === u.divisionId && r.sectionId === u.sectionId && r.celluleId === u.celluleId) throw new ConflictException('L’agent a déjà ce rattachement.');
        avant = { divisionId: u.divisionId, sectionId: u.sectionId, celluleId: u.celluleId };
        apres = { divisionId: r.divisionId, sectionId: r.sectionId, celluleId: r.celluleId };
        break;
      }
      case TypeMouvementCarriere.FIN_CONTRAT:
        if (!u.agent) throw new ConflictException('Ce compte n’est rattaché à aucun agent.');
        if (!dto.motif?.trim()) throw new BadRequestException('Une fin de contrat est motivée.');
        avant = { dateFinPrevue: u.agent.dateFinPrevue ? u.agent.dateFinPrevue.toISOString().slice(0, 10) : null };
        apres = { dateFinPrevue: dto.dateEffet.slice(0, 10) };
        break;
    }
    const m = await this.prisma.mouvementCarriere.create({
      data: { userId: u.id, type: dto.type, avant, apres, dateEffet: jour(dto.dateEffet), motif: dto.motif?.trim() || null, familleCode: FAMILLE_PAR_TYPE[dto.type], creeParId: actor.id },
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'MouvementCarriere', entityId: m.id, metadata: { type: dto.type, userId: u.id, avant, apres } });
    return m;
  }

  private async verifierRattachement(r: { divisionId: string | null; sectionId: string | null; celluleId: string | null }) {
    if (r.divisionId && !(await this.prisma.division.findFirst({ where: { id: r.divisionId, isActive: true } }))) throw new BadRequestException('Division inconnue ou suspendue.');
    if (r.sectionId && !(await this.prisma.section.findFirst({ where: { id: r.sectionId, divisionId: r.divisionId ?? undefined } }))) throw new BadRequestException('Section inconnue ou hors de cette division.');
    if (r.celluleId && !(await this.prisma.cellule.findFirst({ where: { id: r.celluleId, isActive: true } }))) throw new BadRequestException('Cellule inconnue ou suspendue.');
  }

  private async charger(id: string) {
    const m = await this.prisma.mouvementCarriere.findUnique({ where: { id }, include: { acte: { select: { id: true, statut: true } } } });
    if (!m) throw new NotFoundException('Mouvement introuvable.');
    return m;
  }

  async annuler(actor: AuthenticatedUser, id: string) {
    this.assertDrh(actor);
    const m = await this.charger(id);
    const libre = m.statut === StatutMouvementCarriere.PREPARE || (m.statut === StatutMouvementCarriere.EN_ACTE && m.acte?.statut === ActeStatut.ANNULE);
    if (!libre) throw new ConflictException('Ce mouvement est porté par un acte en cours ou est déjà appliqué : annulez d’abord l’acte dans le Courrier.');
    const n = await this.prisma.mouvementCarriere.updateMany({ where: { id, statut: m.statut }, data: { statut: StatutMouvementCarriere.ANNULE } });
    if (!n.count) throw new ConflictException('Le mouvement vient de changer : rechargez.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'MouvementCarriere', entityId: id, metadata: { event: 'annulation' } });
    return { ok: true };
  }

  /** Acte du Courrier dans le registre de la famille ; décision jointe (même modèle de page que N4). */
  async preparerActe(actor: AuthenticatedUser, id: string) {
    this.assertDrh(actor);
    const m = await this.charger(id);
    const libre = m.statut === StatutMouvementCarriere.PREPARE || (m.statut === StatutMouvementCarriere.EN_ACTE && m.acte?.statut === ActeStatut.ANNULE);
    if (!libre) throw new ConflictException('L’acte de ce mouvement existe déjà (en cours dans le module Courrier) ou le mouvement est clos.');
    const famille = await this.prisma.familleActeRh.findUnique({ where: { code: m.familleCode }, include: { registre: true } });
    const r = famille?.registre;
    if (!r || !r.isActive || r.nature !== RegistreNature.ACTE || r.portee !== RegistrePortee.DIRECTION) {
      throw new ConflictException(`Choisissez d’abord le registre de la famille « ${famille?.libelle ?? m.familleCode} » (Ressources humaines → Carrière et actes → Familles d’actes).`);
    }
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: m.userId }, select: { firstName: true, lastName: true, agent: { select: { matricule: true } } } });
    const nomAgent = `${u.firstName} ${u.lastName}`;
    const objet = `${famille!.libelle} — ${LIBELLE_TYPE[m.type]} de ${nomAgent}`;
    const pdf = await renduPdf({
      titre: famille!.libelle,
      mentions: ['PROJET — non signé'],
      corps: [
        { type: 'champs', lignes: [['Agent', nomAgent], ['Matricule', u.agent?.matricule ?? ''], ['Mouvement', LIBELLE_TYPE[m.type]], ['Date d’effet', dateFr(m.dateEffet)]] },
        { type: 'tableau', entetes: ['Élément', 'Avant', 'Après'], lignes: await this.lignesChangement(m.avant as Valeurs, m.apres as Valeurs) },
        ...(m.motif ? [{ type: 'paragraphe' as const, texte: `Motif : ${m.motif}` }] : []),
        { type: 'paragraphe', texte: 'La présente décision prend effet à la date indiquée ; le dossier de l’agent est mis à jour à sa signature.' },
      ],
      lieuDate: `Conakry, le ${dateFr(new Date())}`,
      signature: { qualite: 'Le Directeur National' },
    });
    const acte = await this.actes.creer(actor, {
      registreId: r.id,
      objet,
      corps: `${LIBELLE_TYPE[m.type]} préparé(e) par les ressources humaines ; décision jointe. Le dossier de l’agent est mis à jour à la signature.`,
      confidentialite: CourrierConfidentialite.ORDINAIRE,
      beneficiaireId: m.userId,
      priseConnaissanceRequise: true,
    });
    await this.actes.ajouterPieces(actor, acte.id, [{ buffer: pdf, originalname: `${slug(famille!.libelle)}-${slug(nomAgent)}.pdf`, mimetype: 'application/pdf' } as never]);
    await this.prisma.mouvementCarriere.update({ where: { id }, data: { acteId: acte.id, statut: StatutMouvementCarriere.EN_ACTE } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'MouvementCarriere', entityId: id, metadata: { event: 'acte_prepare', acteId: acte.id, registre: r.code } });
    return { acteId: acte.id };
  }

  private async lignesChangement(avant: Valeurs, apres: Valeurs): Promise<string[][]> {
    const libelles: Record<string, string> = { fonction: 'Fonction', echelon: 'Échelon', grade: 'Grade', categorie: 'Catégorie', divisionId: 'Division', sectionId: 'Section', celluleId: 'Cellule', dateFinPrevue: 'Fin de contrat' };
    const nomUnite = async (cle: string, v: string | null) => {
      if (!v) return '—';
      if (cle === 'divisionId') return (await this.prisma.division.findUnique({ where: { id: v }, select: { name: true } }))?.name ?? v;
      if (cle === 'sectionId') return (await this.prisma.section.findUnique({ where: { id: v }, select: { name: true } }))?.name ?? v;
      if (cle === 'celluleId') return (await this.prisma.cellule.findUnique({ where: { id: v }, select: { name: true } }))?.name ?? v;
      return v;
    };
    const cles = [...new Set([...Object.keys(avant), ...Object.keys(apres)])];
    const lignes: string[][] = [];
    for (const c of cles) lignes.push([libelles[c] ?? c, await nomUnite(c, avant[c] ?? null), await nomUnite(c, apres[c] ?? null)]);
    return lignes;
  }

  /** Écouteur de signature : applique le mouvement porté par l'acte, dans la transaction de signature. */
  private async appliquer(tx: Prisma.TransactionClient, acteId: string, numero: string, actor: AuthenticatedUser) {
    const m = await tx.mouvementCarriere.findUnique({ where: { acteId } });
    if (!m || m.statut !== StatutMouvementCarriere.EN_ACTE) return;
    const apres = m.apres as Valeurs;
    const u = await tx.user.findUniqueOrThrow({ where: { id: m.userId }, select: { id: true, agentId: true } });
    switch (m.type) {
      case TypeMouvementCarriere.NOMINATION:
        await tx.user.update({ where: { id: u.id }, data: { jobTitle: apres.fonction } });
        if (u.agentId) await tx.agent.update({ where: { id: u.agentId }, data: { fonction: apres.fonction } });
        break;
      case TypeMouvementCarriere.AVANCEMENT_ECHELON:
        await tx.personnelFileBasic.upsert({ where: { userId: u.id }, update: { echelon: apres.echelon, echelonDepuis: m.dateEffet, source: 'DRH' }, create: { userId: u.id, echelon: apres.echelon, echelonDepuis: m.dateEffet, source: 'DRH' } });
        break;
      case TypeMouvementCarriere.PROMOTION: {
        const data = { grade: apres.grade, ...(apres.echelon ? { echelon: apres.echelon, echelonDepuis: m.dateEffet } : {}), ...(apres.categorie ? { categorie: apres.categorie } : {}), source: 'DRH' };
        await tx.personnelFileBasic.upsert({ where: { userId: u.id }, update: data, create: { userId: u.id, ...data } });
        break;
      }
      case TypeMouvementCarriere.MUTATION:
        await tx.user.update({ where: { id: u.id }, data: { divisionId: apres.divisionId, sectionId: apres.sectionId, celluleId: apres.celluleId } });
        break;
      case TypeMouvementCarriere.FIN_CONTRAT:
        if (u.agentId) await tx.agent.update({ where: { id: u.agentId }, data: { dateFinPrevue: jour(apres.dateFinPrevue!), natureFinPrevue: 'CONTRAT', alerteJ15At: null, alerteJ3At: null } });
        break;
    }
    await tx.mouvementCarriere.update({ where: { id: m.id }, data: { statut: StatutMouvementCarriere.APPLIQUE, appliqueLe: new Date() } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'MouvementCarriere', entityId: m.id, metadata: { event: 'applique', acteId, numero, type: m.type, apres } }, tx);
    return async () => {
      if (m.type === TypeMouvementCarriere.MUTATION) await this.reprise.synchroniserCompte(m.userId);
      const direction = await this.prisma.user.findMany({ where: { role: { in: [SystemRole.DN, SystemRole.DNA] }, status: UserStatus.ACTIF }, select: { id: true } });
      const titre = `${LIBELLE_TYPE[m.type]} appliqué(e) — acte n° ${numero}`;
      for (const d of direction) {
        await this.notifications.notify(d.id, NotificationType.ACTE_SIGNE, titre, 'Le dossier de l’agent a été mis à jour.', `/rh?onglet=carriere&userId=${m.userId}`, undefined, { libelleBouton: 'Voir le mouvement' });
      }
      await this.notifications.notify(m.userId, NotificationType.ACTE_SIGNE, titre, 'Votre dossier a été mis à jour. Prenez connaissance de l’acte dans le module Courrier.', '/personnel', undefined, { libelleBouton: 'Voir mon dossier' });
    };
  }
}

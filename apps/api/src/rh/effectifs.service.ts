import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus, Prisma, StatutAgent, StatutMouvementCarriere, SystemRole, TypeMouvementCarriere, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ParametresService } from '../socle/parametres.service';
import { estDrh } from '../socle/roles-fonctionnels';
import { ModifierPieceRequiseDto, PieceRequiseDto } from './dto/rh.dto';

const J = 864e5;
const NON_RENSEIGNE = 'Non renseigné';
export type PrioriteAlerte = 'HAUTE' | 'MOYENNE' | 'BASSE';
export type TypeAlerteRh = 'FIN_CONTRAT' | 'FIN_STAGE' | 'AVANCEMENT_ECHELON' | 'DOSSIER_INCOMPLET';
export interface AlerteRh {
  /** Identifiant stable (type + agent) : l'alerte « disparaît » d'elle-même quand sa cause disparaît. */
  cle: string;
  type: TypeAlerteRh;
  priorite: PrioriteAlerte;
  userId: string | null;
  agentId: string | null;
  nom: string;
  libelle: string;
  detail: string;
  echeance: string | null;
  lien: string;
}
const ORDRE_PRIORITE: Record<PrioriteAlerte, number> = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };
/** Champs du dossier (niveau 1) qu'un dossier complet renseigne. */
const CHAMPS_DOSSIER: [string, string][] = [
  ['employmentStatus', 'statut d’emploi'],
  ['grade', 'grade'],
  ['echelon', 'échelon'],
  ['categorie', 'catégorie'],
  ['serviceStartDate', 'date de prise de service'],
];
const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Effectifs et alertes RH (socle N6, cahier NIMBA A3.5, SIG-RF-CAR-01 à 03).
 * - Effectifs : calculés à chaque lecture depuis les agents et leurs dossiers, jamais saisis.
 *   DRH : détail ; DN et DNA : les mêmes agrégats (aucun dossier individuel).
 * - Alertes : calculées à chaque lecture, donc fermées dès que leur cause disparaît (pièce enregistrée,
 *   avancement appliqué, fin prolongée ou confirmée). DRH seul (elles nomment des agents).
 * - Pièces requises : liste tenue par le DRH ; un document du dossier peut fournir une pièce requise.
 */
@Injectable()
export class EffectifsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly parametres: ParametresService,
  ) {}

  private assertDrh(actor: AuthenticatedUser) {
    if (!estDrh(actor)) throw new ForbiddenException('Réservé au DRH.');
  }

  /** Onglets de l'écran « Ressources humaines » ouverts à l'acteur (l'écran n'en calcule aucun). */
  onglets(actor: AuthenticatedUser) {
    const drh = estDrh(actor);
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    const chef = actor.role === SystemRole.CHEF_DIVISION || actor.role === SystemRole.CHEF_SECTION || actor.role === SystemRole.CHEF_CELLULE;
    return {
      effectifs: drh || direction,
      alertes: drh,
      carriere: true,
      familles: drh || direction || actor.role === SystemRole.ADMIN_SYSTEME,
      fiches: true,
      formation: drh || direction || chef,
      pieces: drh,
    };
  }

  // ------------------------------------------------------------------ effectifs

  async effectifs(actor: AuthenticatedUser) {
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    if (!estDrh(actor) && !direction) throw new ForbiddenException('Les effectifs sont consultés par le DRH, le DN et la DNA.');
    const agents = await this.prisma.agent.findMany({
      where: { statut: { not: StatutAgent.PARTI } },
      select: {
        genre: true,
        unite: { select: { libelle: true, code: true } },
        compte: { select: { role: true, personnelFileBasic: { select: { employmentStatus: true, categorie: true, serviceStartDate: true } } } },
      },
    });
    const maintenant = Date.now();
    const compter = (cles: string[]) => {
      const m = new Map<string, number>();
      for (const c of cles) m.set(c, (m.get(c) ?? 0) + 1);
      return [...m.entries()].map(([libelle, nombre]) => ({ libelle, nombre })).sort((a, b) => b.nombre - a.nombre || a.libelle.localeCompare(b.libelle));
    };
    const fichiers = agents.map((a) => a.compte?.personnelFileBasic ?? null);
    const anciennetes = fichiers.filter((f) => f?.serviceStartDate).map((f) => (maintenant - f!.serviceStartDate!.getTime()) / (365.25 * J));
    const genres = agents.filter((a) => a.genre === 'F' || a.genre === 'M');
    const femmes = genres.filter((a) => a.genre === 'F').length;
    return {
      total: agents.length,
      parUnite: compter(agents.map((a) => a.unite?.libelle ?? 'Sans unité')),
      parStatut: compter(fichiers.map((f) => (f?.employmentStatus ? LIBELLE_STATUT[f.employmentStatus] : NON_RENSEIGNE))),
      parCategorie: compter(fichiers.map((f) => (f?.categorie ? `Catégorie ${f.categorie}` : NON_RENSEIGNE))),
      ancienneteMoyenneAnnees: anciennetes.length ? Math.round((anciennetes.reduce((s, x) => s + x, 0) / anciennetes.length) * 10) / 10 : null,
      ancienneteRenseignee: anciennetes.length,
      femmes,
      genreRenseigne: genres.length,
      partFemmes: genres.length ? Math.round((femmes / genres.length) * 1000) / 10 : null,
      calculeLe: new Date().toISOString(),
    };
  }

  // ------------------------------------------------------------------ alertes

  async alertes(actor: AuthenticatedUser, maintenant = new Date()): Promise<AlerteRh[]> {
    this.assertDrh(actor);
    return this.calculerAlertes(maintenant);
  }

  /** Nombre d'alertes par type (tableau de bord du DRH). */
  async resumeAlertes(maintenant = new Date()) {
    const a = await this.calculerAlertes(maintenant);
    const parType = (t: TypeAlerteRh) => a.filter((x) => x.type === t).length;
    return { total: a.length, haute: a.filter((x) => x.priorite === 'HAUTE').length, finContrat: parType('FIN_CONTRAT'), finStage: parType('FIN_STAGE'), avancement: parType('AVANCEMENT_ECHELON'), dossierIncomplet: parType('DOSSIER_INCOMPLET') };
  }

  async calculerAlertes(maintenant = new Date()): Promise<AlerteRh[]> {
    const horizon = await this.parametres.valeur('finPrevue.alerteJours');
    const moisEchelon = await this.parametres.valeur('rh.avancementEchelonMois');
    const alertes: AlerteRh[] = [];

    // Fins prévues (contrat, stage) dans l'horizon, ou dépassées sans confirmation.
    const fins = await this.prisma.agent.findMany({
      where: { statut: { not: StatutAgent.PARTI }, dateFinPrevue: { not: null, lte: new Date(maintenant.getTime() + horizon * J) }, finConfirmeeAt: null },
      select: { id: true, nom: true, prenoms: true, dateFinPrevue: true, natureFinPrevue: true, compte: { select: { id: true } } },
    });
    for (const a of fins) {
      const jours = Math.ceil((a.dateFinPrevue!.getTime() - maintenant.getTime()) / J);
      const stage = a.natureFinPrevue === 'STAGE';
      alertes.push({
        cle: `${stage ? 'FIN_STAGE' : 'FIN_CONTRAT'}:${a.id}`,
        type: stage ? 'FIN_STAGE' : 'FIN_CONTRAT',
        priorite: jours <= 3 ? 'HAUTE' : 'MOYENNE',
        userId: a.compte?.id ?? null,
        agentId: a.id,
        nom: `${a.prenoms} ${a.nom}`,
        libelle: stage ? 'Fin de stage : attestation à préparer' : 'Fin de contrat à échéance',
        detail: jours < 0 ? `Fin prévue le ${jour(a.dateFinPrevue!)}, dépassée de ${-jours} jour(s) : à confirmer ou prolonger.` : `Fin prévue le ${jour(a.dateFinPrevue!)} (dans ${jours} jour(s)).`,
        echeance: jour(a.dateFinPrevue!),
        lien: `/agents?id=${a.id}`,
      });
    }

    // Comptes actifs (hors stagiaires) : dossier incomplet, avancement d'échelon à instruire.
    const comptes = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } },
      select: {
        id: true, firstName: true, lastName: true, agentId: true,
        personnelFileBasic: { select: { employmentStatus: true, grade: true, echelon: true, categorie: true, serviceStartDate: true, echelonDepuis: true } },
        personnelDocuments: { select: { pieceRequiseId: true } },
      },
    });
    const pieces = await this.prisma.pieceRequise.findMany({ where: { actif: true }, orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }] });
    const enCours = new Set(
      (await this.prisma.mouvementCarriere.findMany({
        where: { statut: { in: [StatutMouvementCarriere.PREPARE, StatutMouvementCarriere.EN_ACTE] }, type: { in: [TypeMouvementCarriere.AVANCEMENT_ECHELON, TypeMouvementCarriere.PROMOTION] } },
        select: { userId: true },
      })).map((m) => m.userId),
    );
    const seuilEchelon = new Date(maintenant);
    seuilEchelon.setUTCMonth(seuilEchelon.getUTCMonth() - moisEchelon);
    for (const u of comptes) {
      const f = u.personnelFileBasic;
      const nom = `${u.firstName} ${u.lastName}`;
      const fournies = new Set(u.personnelDocuments.map((d) => d.pieceRequiseId).filter(Boolean));
      const manquantes = [
        ...CHAMPS_DOSSIER.filter(([cle]) => !f || f[cle as keyof typeof f] === null || f[cle as keyof typeof f] === '').map(([, libelle]) => libelle),
        ...pieces.filter((p) => !fournies.has(p.id)).map((p) => p.libelle),
      ];
      if (manquantes.length) {
        alertes.push({
          cle: `DOSSIER_INCOMPLET:${u.id}`,
          type: 'DOSSIER_INCOMPLET',
          priorite: 'BASSE',
          userId: u.id,
          agentId: u.agentId,
          nom,
          libelle: 'Dossier incomplet',
          detail: `Manque : ${manquantes.join(', ')}.`,
          echeance: null,
          lien: `/personnel/${u.id}`,
        });
      }
      const depuis = f?.echelonDepuis ?? f?.serviceStartDate ?? null;
      if (f?.employmentStatus === EmploymentStatus.FONCTIONNAIRE && f.echelon && depuis && depuis <= seuilEchelon && !enCours.has(u.id)) {
        alertes.push({
          cle: `AVANCEMENT_ECHELON:${u.id}`,
          type: 'AVANCEMENT_ECHELON',
          priorite: 'MOYENNE',
          userId: u.id,
          agentId: u.agentId,
          nom,
          libelle: 'Avancement d’échelon à instruire',
          detail: `Échelon ${f.echelon} depuis le ${jour(depuis)} (plus de ${moisEchelon} mois).`,
          echeance: null,
          lien: `/rh?onglet=carriere&userId=${u.id}`,
        });
      }
    }
    return alertes.sort((a, b) => ORDRE_PRIORITE[a.priorite] - ORDRE_PRIORITE[b.priorite] || (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') || a.nom.localeCompare(b.nom));
  }

  // ------------------------------------------------------------------ pièces requises

  async piecesRequises(actor: AuthenticatedUser) {
    const lignes = await this.prisma.pieceRequise.findMany({ orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }], select: { id: true, libelle: true, ordre: true, actif: true } });
    return { pieces: lignes, droits: { gerer: estDrh(actor) } };
  }

  async creerPiece(actor: AuthenticatedUser, dto: PieceRequiseDto) {
    this.assertDrh(actor);
    try {
      const p = await this.prisma.pieceRequise.create({ data: { libelle: dto.libelle.trim(), ordre: dto.ordre ?? 0, actif: dto.actif ?? true } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'PieceRequise', entityId: p.id, metadata: { libelle: p.libelle } });
      return p;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Cette pièce figure déjà dans la liste.');
      throw e;
    }
  }

  async modifierPiece(actor: AuthenticatedUser, id: string, dto: ModifierPieceRequiseDto) {
    this.assertDrh(actor);
    if (!(await this.prisma.pieceRequise.findUnique({ where: { id } }))) throw new NotFoundException('Pièce introuvable.');
    try {
      const p = await this.prisma.pieceRequise.update({ where: { id }, data: { libelle: dto.libelle?.trim(), ordre: dto.ordre, actif: dto.actif } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'PieceRequise', entityId: id, metadata: { ...dto } });
      return p;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Cette pièce figure déjà dans la liste.');
      throw e;
    }
  }
}

const LIBELLE_STATUT: Record<EmploymentStatus, string> = {
  FONCTIONNAIRE: 'Fonctionnaire',
  CONTRACTUEL: 'Contractuel',
  STAGIAIRE: 'Stagiaire',
  MISE_A_DISPOSITION: 'Mis à disposition',
};

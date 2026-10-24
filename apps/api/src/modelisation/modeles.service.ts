import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  AuditAction,
  NotificationType,
  Prisma,
  RoleModelisation,
  StatutTravailCalcul,
  StatutVersionModele,
  SystemRole,
  TypeTravailCalcul,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { aAccesModelisation, gouverne, peutDesigner, rolesModelisation, RolesModelisation } from './acces';
import { FicheModele, lirePaquet, PaquetRefuse } from './paquet';
import { ControleVersion, TravauxCalculService } from './travaux.service';
import { ReglagesDto } from './dto/modelisation.dto';

export type ReglageManette = { id: string; actif: boolean; min: number; max: number };
export type ReglageCompteur = { id: string; actif: boolean };
export type Derogation = {
  controleId: string;
  motif: string;
  demandeeParId: string;
  demandeeLe: string;
  confirmeeParId: string | null;
  confirmeeLe: string | null;
};

const EN_COURS: StatutVersionModele[] = [StatutVersionModele.DEPOSEE, StatutVersionModele.CONTROLEE, StatutVersionModele.EN_ATTENTE];
const LIBELLE_ETAT: Record<StatutVersionModele, string> = {
  DEPOSEE: 'Vérification automatique',
  CONTROLEE: 'Manettes à régler',
  EN_ATTENTE: 'En attente d’approbation',
  ACTIVE: 'Active',
  REFUSEE: 'Refusée',
  ARCHIVEE: 'Archivée',
};
const TON_ETAT: Record<StatutVersionModele, string> = { DEPOSEE: 'bleu', CONTROLEE: 'bleu', EN_ATTENTE: 'or', ACTIVE: 'vert', REFUSEE: 'rouge', ARCHIVEE: 'gris' };
export const LIEN_MODELE = (id: string) => `/modelisation/${id}`;

const VERSION_SELECT = {
  id: true,
  modeleId: true,
  numero: true,
  empreinte: true,
  nomFichier: true,
  tailleOctets: true,
  fiche: true,
  statut: true,
  controles: true,
  controleLe: true,
  manettes: true,
  compteurs: true,
  derogations: true,
  avecDerogation: true,
  auteurId: true,
  envoyeLe: true,
  approbateurId: true,
  approuveLe: true,
  refuseParId: true,
  refuseLe: true,
  motifRefus: true,
  activeLe: true,
  archiveLe: true,
  createdAt: true,
} satisfies Prisma.VersionModeleSelect;
type VersionLue = Prisma.VersionModeleGetPayload<{ select: typeof VERSION_SELECT }>;

/**
 * Référentiel des modèles (domaine B, lot B1) : dépôt d'un paquet, vérification automatique par le
 * service de calcul, réglage des manettes, envoi au responsable, dérogation à deux, approbation et
 * activation, exécution interne. Règles : le rang ne donne aucun droit (rôles de modélisation) ;
 * personne ne valide ni n'active son propre travail ; l'administrateur ne voit jamais les chiffres
 * d'une simulation ; une version déposée est immuable (déclencheur en base).
 */
@Injectable()
export class ModelesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly travaux: TravauxCalculService,
  ) {}

  // -------------------------------------------------------------------------------------------
  // Accès et outils
  // -------------------------------------------------------------------------------------------

  async roles(actor: AuthenticatedUser): Promise<RolesModelisation> {
    const r = await rolesModelisation(this.prisma, actor);
    if (!aAccesModelisation(r)) throw new ForbiddenException({ message: 'La modélisation est réservée aux personnes qui ont un rôle de modélisation et à l’administrateur.', etape: 'ROLE', objetType: 'Modele' });
    return r;
  }

  private exigerAdministrateur(r: RolesModelisation, quoi: string): void {
    if (!r.administrateur) throw new ForbiddenException({ message: `Seul l’administrateur des modèles ${quoi}.`, etape: 'ROLE', objetType: 'VersionModele' });
  }

  private async noms(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const liste = [...new Set(ids.filter((x): x is string => !!x))];
    if (!liste.length) return new Map();
    const u = await this.prisma.user.findMany({ where: { id: { in: liste } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(u.map((x) => [x.id, `${x.firstName} ${x.lastName}`]));
  }

  private async gouvernance(modeleId: string) {
    const a = await this.prisma.affectationModelisation.findMany({
      where: { modeleId, fin: null, role: { in: [RoleModelisation.RESPONSABLE, RoleModelisation.SUPPLEANT] } },
      select: { userId: true, role: true },
    });
    return { responsableId: a.find((x) => x.role === RoleModelisation.RESPONSABLE)?.userId ?? null, suppleantId: a.find((x) => x.role === RoleModelisation.SUPPLEANT)?.userId ?? null };
  }

  private async version(versionId: string): Promise<VersionLue> {
    const v = await this.prisma.versionModele.findUnique({ where: { id: versionId }, select: VERSION_SELECT });
    if (!v) throw new NotFoundException('Version de modèle introuvable.');
    return v;
  }

  private static controles(v: Pick<VersionLue, 'controles'>): ControleVersion[] {
    return Array.isArray(v.controles) ? (v.controles as unknown as ControleVersion[]) : [];
  }

  private static derogations(v: Pick<VersionLue, 'derogations'>): Derogation[] {
    return Array.isArray(v.derogations) ? (v.derogations as unknown as Derogation[]) : [];
  }

  /** Contrôles bloquants en échec qui n'ont pas de dérogation confirmée par l'administrateur. */
  private static bloquantsNonDeroges(v: VersionLue): ControleVersion[] {
    const deroges = new Set(ModelesService.derogations(v).filter((d) => d.confirmeeLe).map((d) => d.controleId));
    return ModelesService.controles(v).filter((c) => c.type === 'bloquant' && !c.ok && !deroges.has(c.id));
  }

  private static resume(v: Pick<VersionLue, 'controles'>) {
    const c = ModelesService.controles(v);
    return { reussis: c.filter((x) => x.ok).length, alertes: c.filter((x) => !x.ok && x.type === 'alerte').length, echecs: c.filter((x) => !x.ok && x.type === 'bloquant').length };
  }

  /** Colonne « Contrôles » de la liste : Sans version active, Avec dérogation (dérogation confirmée),
   * Alerte (au moins une alerte), Conforme. */
  private static etatControles(active: { avecDerogation: boolean; controles: Prisma.JsonValue } | undefined): { code: 'SANS_VERSION_ACTIVE' | 'AVEC_DEROGATION' | 'ALERTE' | 'CONFORME'; libelle: string } {
    if (!active) return { code: 'SANS_VERSION_ACTIVE', libelle: 'Sans version active' };
    if (active.avecDerogation) return { code: 'AVEC_DEROGATION', libelle: 'Avec dérogation' };
    if (ModelesService.controles(active).some((c) => !c.ok && c.type === 'alerte')) return { code: 'ALERTE', libelle: 'Alerte' };
    return { code: 'CONFORME', libelle: 'Conforme' };
  }

  private async administrateurs(sauf?: string): Promise<string[]> {
    return (await this.prisma.user.findMany({ where: { role: SystemRole.ADMIN_SYSTEME, status: UserStatus.ACTIF, ...(sauf ? { id: { not: sauf } } : {}) }, select: { id: true } })).map((u) => u.id);
  }

  private sousTitre(f: FicheModele): string {
    const t = f.taille ?? {};
    const parts = [f.famille_libelle ? null : f.famille, f.base, t.produits ? `${t.produits} produits${t.branches ? `, ${t.branches} branches` : ''}` : null, f.horizon ? `${f.horizon.debut}-${f.horizon.fin}` : null];
    return parts.filter(Boolean).join(' · ');
  }

  // -------------------------------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------------------------------

  async liste(actor: AuthenticatedUser) {
    const r = await this.roles(actor);
    const modeles = await this.prisma.modele.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        code: true,
        nom: true,
        famille: true,
        familleLibelle: true,
        versions: { orderBy: { numero: 'desc' }, select: { numero: true, statut: true, controleLe: true, createdAt: true, fiche: true, avecDerogation: true, controles: true } },
        affectations: { where: { fin: null }, select: { role: true, userId: true } },
      },
    });
    const noms = await this.noms(modeles.flatMap((m) => m.affectations.map((a) => a.userId)));
    return {
      droits: { peutDeposer: r.administrateur },
      modeles: modeles.map((m) => {
        const derniere = m.versions[0];
        const active = m.versions.find((v) => v.statut === StatutVersionModele.ACTIVE);
        const resp = m.affectations.find((a) => a.role === RoleModelisation.RESPONSABLE);
        const controlee = m.versions.find((v) => v.controleLe);
        return {
          id: m.id,
          code: m.code,
          nom: m.nom,
          famille: m.familleLibelle ? `${m.famille} — ${m.familleLibelle}` : m.famille,
          sousTitre: derniere ? this.sousTitre(derniere.fiche as unknown as FicheModele) : '',
          demonstration: m.code.startsWith('TEST_'),
          versionActive: active ? { numero: active.numero, avecDerogation: active.avecDerogation } : null,
          // Base de référence déclarée dans le paquet de la version active, et état de ses contrôles
          // (libellé seulement, jamais une valeur : l'administrateur ne voit aucun chiffre).
          baseReference: active ? ((active.fiche as unknown as FicheModele).base ?? null) : null,
          controles: ModelesService.etatControles(active),
          responsable: resp ? noms.get(resp.userId) ?? null : null,
          etat: derniere ? { code: derniere.statut, libelle: LIBELLE_ETAT[derniere.statut], ton: TON_ETAT[derniere.statut], numero: derniere.numero } : null,
          dernierControle: controlee ? { numero: controlee.numero, le: controlee.controleLe } : null,
        };
      }),
    };
  }

  /** Détail d'une version (assistant de dépôt et fiche) : contrôles, réglages, dérogations, travail, droits. */
  async detailVersion(actor: AuthenticatedUser, versionId: string, r?: RolesModelisation) {
    r = r ?? (await this.roles(actor));
    const v = await this.version(versionId);
    const modele = await this.prisma.modele.findUniqueOrThrow({ where: { id: v.modeleId }, select: { id: true, code: true, nom: true } });
    const g = await this.gouvernance(v.modeleId);
    const fiche = v.fiche as unknown as FicheModele;
    const reglages = new Map((v.manettes as unknown as ReglageManette[]).map((m) => [m.id, m]));
    const compteurs = new Map((v.compteurs as unknown as ReglageCompteur[]).map((c) => [c.id, c]));
    const travail = await this.prisma.travailCalcul.findFirst({
      where: { versionId: v.id, type: TypeTravailCalcul.VERIFICATION },
      orderBy: { enFileLe: 'desc' },
      select: { id: true, statut: true, etape: true, message: true, tentatives: true, enFileLe: true, termineLe: true, dureeMs: true },
    });
    const derogations = ModelesService.derogations(v);
    const noms = await this.noms([v.auteurId, v.approbateurId, v.refuseParId, g.responsableId, g.suppleantId, ...derogations.flatMap((d) => [d.demandeeParId, d.confirmeeParId])]);
    const controles = ModelesService.controles(v);
    const gouvernant = gouverne(r, v.modeleId);
    const auteur = actor.id === v.auteurId;
    const enAttente = v.statut === StatutVersionModele.EN_ATTENTE;
    const bloquants = ModelesService.bloquantsNonDeroges(v);
    const verificationEnCours = travail && (travail.statut === StatutTravailCalcul.EN_FILE || travail.statut === StatutTravailCalcul.EN_COURS);
    return {
      id: v.id,
      modele,
      numero: v.numero,
      statut: v.statut,
      etat: { libelle: LIBELLE_ETAT[v.statut] + (v.statut === StatutVersionModele.ACTIVE && v.avecDerogation ? ' (activée avec dérogation)' : ''), ton: TON_ETAT[v.statut] },
      nomFichier: v.nomFichier,
      tailleOctets: v.tailleOctets,
      empreinte: v.empreinte,
      deposeLe: v.createdAt,
      auteur: noms.get(v.auteurId) ?? null,
      approbateur: v.approbateurId ? noms.get(v.approbateurId) ?? null : null,
      approuveLe: v.approuveLe,
      refusePar: v.refuseParId ? noms.get(v.refuseParId) ?? null : null,
      refuseLe: v.refuseLe,
      motifRefus: v.motifRefus,
      avecDerogation: v.avecDerogation,
      lu: {
        famille: fiche.famille_libelle ? `${fiche.famille} — ${fiche.famille_libelle}` : fiche.famille,
        moteur: [fiche.moteur?.langage === 'python' ? 'Python' : fiche.moteur?.langage, fiche.moteur?.solveur && fiche.moteur.solveur !== 'aucun' ? fiche.moteur.solveur.toUpperCase() : null].filter(Boolean).join(' · ') || null,
        base: fiche.base ?? null,
        horizon: fiche.horizon ? `${fiche.horizon.debut}-${fiche.horizon.fin}` : null,
        manettes: fiche.manettes.length,
        compteurs: fiche.compteurs.length,
        description: fiche.description ?? null,
        aConfirmer: Array.isArray(fiche.a_confirmer) ? fiche.a_confirmer : [],
      },
      verification: travail ? { statut: travail.statut, etape: travail.etape, message: travail.message, tentatives: travail.tentatives, termineLe: travail.termineLe, dureeMs: travail.dureeMs } : null,
      controles,
      resume: ModelesService.resume(v),
      manettes: fiche.manettes.map((m) => {
        const rg = reglages.get(m.id);
        return {
          id: m.id,
          libelle: m.libelle,
          detail: m.detail ?? null,
          type: m.type,
          unite: m.unite ?? null,
          indices: Array.isArray(m.indices) ? m.indices.length : 0,
          minPaquet: m.min,
          maxPaquet: m.max,
          actif: rg?.actif ?? m.actif !== false,
          min: rg?.min ?? m.min,
          max: rg?.max ?? m.max,
        };
      }),
      compteurs: fiche.compteurs.map((c) => ({ id: c.id, libelle: c.libelle, unite: c.unite ?? null, actif: compteurs.get(c.id)?.actif ?? true })),
      derogations: derogations.map((d) => ({
        controleId: d.controleId,
        controle: controles.find((c) => c.id === d.controleId)?.libelle ?? d.controleId,
        motif: d.motif,
        demandeePar: noms.get(d.demandeeParId) ?? null,
        demandeeLe: d.demandeeLe,
        confirmeePar: d.confirmeeParId ? noms.get(d.confirmeeParId) ?? null : null,
        confirmeeLe: d.confirmeeLe,
      })),
      droits: {
        peutRegler: r.administrateur && v.statut === StatutVersionModele.CONTROLEE,
        peutEnvoyer: r.administrateur && v.statut === StatutVersionModele.CONTROLEE,
        peutRelancerVerification: r.administrateur && v.statut === StatutVersionModele.DEPOSEE && !verificationEnCours,
        peutAbandonner: r.administrateur && (v.statut === StatutVersionModele.DEPOSEE || v.statut === StatutVersionModele.CONTROLEE),
        peutApprouver: gouvernant && enAttente && !auteur && bloquants.length === 0,
        peutRefuser: gouvernant && enAttente && !auteur,
        approbationImpossible: !gouvernant || !enAttente
          ? null
          : auteur
            ? 'Vous avez déposé cette version : son approbation revient au suppléant du modèle.'
            : bloquants.length
              ? `Contrôle bloquant en échec sans dérogation confirmée : ${bloquants.map((c) => c.libelle).join(', ')}.`
              : null,
        derogationsDemandables: gouvernant && enAttente ? controles.filter((c) => c.type === 'bloquant' && !c.ok && !derogations.some((d) => d.controleId === c.id)).map((c) => c.id) : [],
        derogationsConfirmables: r.administrateur && enAttente ? derogations.filter((d) => !d.confirmeeLe && d.demandeeParId !== actor.id).map((d) => d.controleId) : [],
      },
    };
  }

  async fiche(actor: AuthenticatedUser, modeleId: string) {
    const r = await this.roles(actor);
    const m = await this.prisma.modele.findUnique({ where: { id: modeleId }, select: { id: true, code: true, nom: true, famille: true, familleLibelle: true, description: true } });
    if (!m) throw new NotFoundException('Modèle introuvable.');
    const versions = await this.prisma.versionModele.findMany({
      where: { modeleId },
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true, statut: true, nomFichier: true, auteurId: true, createdAt: true, controles: true, avecDerogation: true, fiche: true },
    });
    const g = await this.gouvernance(modeleId);
    const noms = await this.noms([g.responsableId, g.suppleantId, ...versions.map((v) => v.auteurId)]);
    const courante = versions.find((v) => v.statut === StatutVersionModele.EN_ATTENTE) ?? versions.find((v) => v.statut === StatutVersionModele.ACTIVE) ?? versions[0];
    const detail = courante ? await this.detailVersion(actor, courante.id, r) : null;
    const fiche = (courante?.fiche ?? {}) as unknown as FicheModele;
    const simulations = await this.prisma.travailCalcul.count({ where: { type: TypeTravailCalcul.EXECUTION, statut: StatutTravailCalcul.TERMINE, version: { modeleId } } });
    return {
      modele: { ...m, famille: m.familleLibelle ? `${m.famille} — ${m.familleLibelle}` : m.famille, sousTitre: courante ? this.sousTitre(fiche) : '', demonstration: m.code.startsWith('TEST_') },
      versions: versions.map((v) => ({
        id: v.id,
        numero: v.numero,
        statut: v.statut,
        etat: { libelle: LIBELLE_ETAT[v.statut] + (v.avecDerogation ? ' (avec dérogation)' : ''), ton: TON_ETAT[v.statut] },
        nomFichier: v.nomFichier,
        deposePar: noms.get(v.auteurId) ?? null,
        deposeLe: v.createdAt,
        resume: ModelesService.resume(v),
      })),
      version: detail,
      gouvernance: {
        responsable: g.responsableId ? { id: g.responsableId, nom: noms.get(g.responsableId) ?? null } : null,
        suppleant: g.suppleantId ? { id: g.suppleantId, nom: noms.get(g.suppleantId) ?? null } : null,
        administrateur: courante ? noms.get(courante.auteurId) ?? null : null,
      },
      donnees: {
        base: fiche.base ?? null,
        fichiers: Array.isArray(fiche.fichiers) ? fiche.fichiers.map((f) => ({ chemin: f.chemin, role: f.role ?? null })) : [],
        reference: fiche.reference ? { fichier: fiche.reference.fichier ?? null, logiciel: fiche.reference.logiciel ?? null, date: fiche.reference.date ?? null } : null,
      },
      utilisation: {
        manettesActives: detail ? detail.manettes.filter((x) => x.actif).length : 0,
        compteurs: detail ? detail.compteurs.filter((x) => x.actif).length : 0,
        simulations,
      },
      droits: { peutDeposer: r.administrateur, peutDesigner: peutDesigner(actor) },
    };
  }

  // -------------------------------------------------------------------------------------------
  // Dépôt et vérification
  // -------------------------------------------------------------------------------------------

  async deposer(actor: AuthenticatedUser, fichier: { buffer: Buffer; originalname: string; size: number } | undefined, donneesConfirmees?: string) {
    const r = await this.roles(actor);
    this.exigerAdministrateur(r, 'dépose une version');
    // Décision n° 6 : la case est obligatoire (contrôlée ici aussi : un formulaire sans aucun champ texte n'a pas de corps).
    if (!['true', 'oui', 'on'].includes(String(donneesConfirmees ?? ''))) {
      throw new BadRequestException('Cochez « Je confirme que les données de ce paquet sont publiées ou autorisées pour cet hébergement ».');
    }
    if (!fichier?.buffer?.length) throw new UnprocessableEntityException({ code: 'PAQUET_ABSENT', message: 'Choisissez le fichier .zip du paquet de modèle.' });
    let lu;
    try {
      lu = lirePaquet(fichier.buffer);
    } catch (e) {
      if (e instanceof PaquetRefuse) throw new UnprocessableEntityException({ code: 'PAQUET_REFUSE', message: e.message, details: e.details.length ? e.details : null });
      throw e;
    }
    const existant = await this.prisma.modele.findUnique({ where: { code: lu.fiche.code }, select: { id: true } });
    if (existant) {
      const enCours = await this.prisma.versionModele.findFirst({ where: { modeleId: existant.id, statut: { in: EN_COURS } }, select: { numero: true, statut: true } });
      if (enCours) throw new ConflictException({ code: 'VERSION_EN_COURS', message: `La version ${enCours.numero} de ce modèle est encore en cours (${LIBELLE_ETAT[enCours.statut].toLowerCase()}) : faites-la approuver, refuser ou abandonnez-la avant d’en déposer une autre.` });
      const meme = await this.prisma.versionModele.findFirst({ where: { modeleId: existant.id, empreinte: lu.empreinte }, select: { numero: true } });
      if (meme) throw new ConflictException({ code: 'PAQUET_DEJA_DEPOSE', message: `Ce paquet a déjà été déposé (version ${meme.numero}, même empreinte SHA-256).` });
    }
    const nomFichier = (fichier.originalname || 'paquet.zip').slice(0, 200);
    const fiche = lu.fiche;
    const manettes: ReglageManette[] = fiche.manettes.map((m) => ({ id: m.id, actif: m.actif !== false, min: m.min, max: m.max }));
    const compteurs: ReglageCompteur[] = fiche.compteurs.map((c) => ({ id: c.id, actif: true }));
    let versionId: string;
    try {
      versionId = await this.storage.saveThen(fichier.buffer, 'paquet.zip', async ({ fileKey, sizeBytes }) =>
        this.prisma.$transaction(async (tx) => {
          const modele =
            existant ??
            (await tx.modele.create({
              data: { code: fiche.code, nom: fiche.nom, famille: fiche.famille, familleLibelle: fiche.famille_libelle ?? null, description: fiche.description ?? null, creeParId: actor.id },
              select: { id: true },
            }));
          const numero = ((await tx.versionModele.aggregate({ where: { modeleId: modele.id }, _max: { numero: true } }))._max.numero ?? 0) + 1;
          const v = await tx.versionModele.create({
            data: {
              modeleId: modele.id,
              numero,
              empreinte: lu.empreinte,
              fileKey,
              nomFichier,
              tailleOctets: sizeBytes,
              fiche: fiche as unknown as Prisma.InputJsonValue,
              manettes: manettes as unknown as Prisma.InputJsonValue,
              compteurs: compteurs as unknown as Prisma.InputJsonValue,
              donneesConfirmees: true,
              auteurId: actor.id,
            },
            select: { id: true },
          });
          await this.travaux.creer(TypeTravailCalcul.VERIFICATION, v.id, actor.id, undefined, tx);
          if (!existant) await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Modele', entityId: modele.id, metadata: { event: 'modele_cree', code: fiche.code, nom: fiche.nom } }, tx);
          await this.audit.log(
            {
              actorId: actor.id,
              action: AuditAction.CREATION,
              entityType: 'VersionModele',
              entityId: v.id,
              metadata: {
                event: 'depot_version',
                code: fiche.code,
                numero,
                empreinte: lu.empreinte,
                nomFichier,
                tailleOctets: sizeBytes,
                // Décision n° 6 : données publiées ou fictives seulement tant que l'hébergement en Guinée n'est pas décidé.
                confirmationDonnees: 'Je confirme que les données de ce paquet sont publiées ou autorisées pour cet hébergement.',
              },
            },
            tx,
          );
          return v.id;
        }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'DEPOT_CONCURRENT', message: 'Un autre dépôt du même modèle vient d’avoir lieu : rechargez la liste.' });
      throw e;
    }
    this.travaux.declencher();
    return this.detailVersion(actor, versionId, r);
  }

  async relancerVerification(actor: AuthenticatedUser, versionId: string) {
    const r = await this.roles(actor);
    this.exigerAdministrateur(r, 'relance la vérification');
    const v = await this.version(versionId);
    if (v.statut !== StatutVersionModele.DEPOSEE) throw new ConflictException('Cette version est déjà vérifiée.');
    const enCours = await this.prisma.travailCalcul.count({ where: { versionId, type: TypeTravailCalcul.VERIFICATION, statut: { in: [StatutTravailCalcul.EN_FILE, StatutTravailCalcul.EN_COURS] } } });
    if (enCours) throw new ConflictException('La vérification de cette version est déjà en cours.');
    await this.travaux.creer(TypeTravailCalcul.VERIFICATION, versionId, actor.id);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'verification_relancee', numero: v.numero } });
    return this.detailVersion(actor, versionId, r);
  }

  async abandonner(actor: AuthenticatedUser, versionId: string, motif: string) {
    const r = await this.roles(actor);
    this.exigerAdministrateur(r, 'abandonne un dépôt');
    const v = await this.version(versionId);
    if (v.statut !== StatutVersionModele.DEPOSEE && v.statut !== StatutVersionModele.CONTROLEE) throw new ConflictException('Seul un dépôt pas encore envoyé au responsable peut être abandonné.');
    await this.prisma.$transaction(async (tx) => {
      await tx.travailCalcul.updateMany({ where: { versionId, statut: StatutTravailCalcul.EN_FILE }, data: { statut: StatutTravailCalcul.ECHEC, message: 'Dépôt abandonné.', termineLe: new Date() } });
      await tx.versionModele.update({ where: { id: versionId }, data: { statut: StatutVersionModele.REFUSEE, refuseParId: actor.id, refuseLe: new Date(), motifRefus: `Dépôt abandonné : ${motif.trim()}` } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'depot_abandonne', numero: v.numero, motif: motif.trim() } }, tx);
    });
    return this.detailVersion(actor, versionId, r);
  }

  // -------------------------------------------------------------------------------------------
  // Manettes et compteurs (étape 3), envoi au responsable
  // -------------------------------------------------------------------------------------------

  async regler(actor: AuthenticatedUser, versionId: string, dto: ReglagesDto) {
    const r = await this.roles(actor);
    this.exigerAdministrateur(r, 'règle les manettes');
    const v = await this.version(versionId);
    if (v.statut !== StatutVersionModele.CONTROLEE) throw new ConflictException('Les manettes se règlent après la vérification automatique et avant l’envoi au responsable.');
    const fiche = v.fiche as unknown as FicheModele;
    const erreurs: string[] = [];
    const parId = new Map(dto.manettes.map((m) => [m.id, m]));
    if (parId.size !== dto.manettes.length || dto.manettes.length !== fiche.manettes.length || fiche.manettes.some((m) => !parId.has(m.id))) erreurs.push('Le réglage doit reprendre chaque manette du paquet une fois.');
    for (const m of fiche.manettes) {
      const rg = parId.get(m.id);
      if (!rg) continue;
      if (!(rg.min < rg.max)) erreurs.push(`${m.libelle} : le minimum doit être inférieur au maximum.`);
      if (rg.min < m.min || rg.max > m.max) erreurs.push(`${m.libelle} : bornes comprises entre ${m.min} et ${m.max} (celles du paquet).`);
    }
    const cpt = new Map(dto.compteurs.map((c) => [c.id, c]));
    if (cpt.size !== dto.compteurs.length || dto.compteurs.length !== fiche.compteurs.length || fiche.compteurs.some((c) => !cpt.has(c.id))) erreurs.push('Le réglage doit reprendre chaque compteur du paquet une fois.');
    if (!dto.compteurs.some((c) => c.actif)) erreurs.push('Gardez au moins un compteur.');
    if (!dto.manettes.some((m) => m.actif)) erreurs.push('Gardez au moins une manette.');
    if (erreurs.length) throw new UnprocessableEntityException({ code: 'REGLAGE_INVALIDE', message: erreurs[0], details: erreurs });
    const avant = new Map((v.manettes as unknown as ReglageManette[]).map((m) => [m.id, m]));
    const manettes: ReglageManette[] = fiche.manettes.map((m) => {
      const rg = parId.get(m.id)!;
      return { id: m.id, actif: rg.actif, min: rg.min, max: rg.max };
    });
    const compteurs: ReglageCompteur[] = fiche.compteurs.map((c) => ({ id: c.id, actif: cpt.get(c.id)!.actif }));
    const changements = manettes.filter((m) => {
      const a = avant.get(m.id);
      return !a || a.actif !== m.actif || a.min !== m.min || a.max !== m.max;
    });
    const avantCompteurs = new Map((v.compteurs as unknown as ReglageCompteur[]).map((c) => [c.id, c.actif]));
    await this.prisma.$transaction(async (tx) => {
      await tx.versionModele.update({ where: { id: versionId }, data: { manettes: manettes as unknown as Prisma.InputJsonValue, compteurs: compteurs as unknown as Prisma.InputJsonValue } });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.MODIFICATION,
          entityType: 'VersionModele',
          entityId: versionId,
          metadata: {
            event: 'reglage_manettes',
            numero: v.numero,
            manettes: changements.map((m) => ({ id: m.id, avant: avant.get(m.id) ?? null, apres: m })),
            compteursRetires: compteurs.filter((c) => !c.actif).map((c) => c.id),
            compteursModifies: compteurs.filter((c) => avantCompteurs.get(c.id) !== c.actif).map((c) => c.id),
          } as unknown as Prisma.InputJsonValue,
        },
        tx,
      );
    });
    return this.detailVersion(actor, versionId, r);
  }

  async envoyer(actor: AuthenticatedUser, versionId: string) {
    const r = await this.roles(actor);
    this.exigerAdministrateur(r, 'envoie une version au responsable');
    const v = await this.version(versionId);
    if (v.statut !== StatutVersionModele.CONTROLEE) throw new ConflictException('Seule une version vérifiée et pas encore envoyée peut partir au responsable.');
    await this.prisma.$transaction(async (tx) => {
      await tx.versionModele.update({ where: { id: versionId }, data: { statut: StatutVersionModele.EN_ATTENTE, envoyeParId: actor.id, envoyeLe: new Date() } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'envoi_responsable', numero: v.numero, resume: ModelesService.resume(v) } }, tx);
    });
    await this.prevenirAApprouver(v.modeleId, versionId, actor.id);
    return this.detailVersion(actor, versionId, r);
  }

  /** Responsable et suppléant prévenus d'une version à approuver (sauf qui vient d'agir). */
  async prevenirAApprouver(modeleId: string, versionId: string, sauf?: string): Promise<void> {
    const v = await this.version(versionId);
    if (v.statut !== StatutVersionModele.EN_ATTENTE) return;
    const g = await this.gouvernance(modeleId);
    const m = await this.prisma.modele.findUniqueOrThrow({ where: { id: modeleId }, select: { nom: true } });
    const r = ModelesService.resume(v);
    const dest = [g.responsableId, g.suppleantId].filter((x): x is string => !!x && x !== sauf);
    await this.notifications.notifyMany(
      dest,
      NotificationType.TACHE_SOUMISE_VALIDATION,
      `Modèle « ${m.nom} » : version ${v.numero} à approuver`,
      `${r.reussis} contrôle(s) réussi(s), ${r.alertes} alerte(s), ${r.echecs} contrôle(s) bloquant(s) en échec. L’approbation revient au responsable du modèle (au suppléant si le responsable a déposé la version).`,
      LIEN_MODELE(modeleId),
      undefined,
      { libelleBouton: 'Voir la version' },
    );
  }

  // -------------------------------------------------------------------------------------------
  // Dérogation à deux, approbation, refus
  // -------------------------------------------------------------------------------------------

  private exigerGouvernant(r: RolesModelisation, modeleId: string, quoi: string): void {
    if (!gouverne(r, modeleId)) throw new ForbiddenException({ message: `Seul le responsable du modèle (ou son suppléant) ${quoi}.`, etape: 'ROLE', objetType: 'VersionModele' });
  }

  async demanderDerogation(actor: AuthenticatedUser, versionId: string, controleId: string, motif: string) {
    const r = await this.roles(actor);
    const v = await this.version(versionId);
    this.exigerGouvernant(r, v.modeleId, 'demande une dérogation');
    if (v.statut !== StatutVersionModele.EN_ATTENTE) throw new ConflictException('Une dérogation se demande sur une version en attente d’approbation.');
    const c = ModelesService.controles(v).find((x) => x.id === controleId);
    if (!c || c.type !== 'bloquant' || c.ok) throw new ConflictException('Une dérogation ne porte que sur un contrôle bloquant en échec.');
    const derogations = ModelesService.derogations(v);
    if (derogations.some((d) => d.controleId === controleId)) throw new ConflictException('Une dérogation a déjà été demandée pour ce contrôle.');
    const d: Derogation = { controleId, motif: motif.trim(), demandeeParId: actor.id, demandeeLe: new Date().toISOString(), confirmeeParId: null, confirmeeLe: null };
    await this.prisma.$transaction(async (tx) => {
      await tx.versionModele.update({ where: { id: versionId }, data: { derogations: [...derogations, d] as unknown as Prisma.InputJsonValue } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'derogation_demandee', numero: v.numero, controleId, valeur: c.valeur, motif: d.motif } }, tx);
    });
    const m = await this.prisma.modele.findUniqueOrThrow({ where: { id: v.modeleId }, select: { nom: true } });
    await this.notifications.notifyMany(
      await this.administrateurs(actor.id),
      NotificationType.DOSSIER_ERREUR_SIGNALEE,
      `Modèle « ${m.nom} » : dérogation à confirmer`,
      `Contrôle « ${c.libelle} » en échec (${c.valeur}), version ${v.numero}. Motif du responsable : ${d.motif}`,
      LIEN_MODELE(v.modeleId),
      undefined,
      { libelleBouton: 'Examiner la dérogation', urgent: true },
    );
    return this.detailVersion(actor, versionId, r);
  }

  async confirmerDerogation(actor: AuthenticatedUser, versionId: string, controleId: string) {
    const r = await this.roles(actor);
    this.exigerAdministrateur(r, 'confirme une dérogation');
    const v = await this.version(versionId);
    if (v.statut !== StatutVersionModele.EN_ATTENTE) throw new ConflictException('Une dérogation se confirme sur une version en attente d’approbation.');
    const derogations = ModelesService.derogations(v);
    const d = derogations.find((x) => x.controleId === controleId);
    if (!d) throw new NotFoundException('Aucune dérogation demandée pour ce contrôle.');
    if (d.confirmeeLe) throw new ConflictException('Cette dérogation est déjà confirmée.');
    if (d.demandeeParId === actor.id) throw new ForbiddenException({ message: 'Une dérogation se décide à deux : vous ne pouvez pas confirmer votre propre demande.', etape: 'ROLE', objetType: 'VersionModele' });
    d.confirmeeParId = actor.id;
    d.confirmeeLe = new Date().toISOString();
    const c = ModelesService.controles(v).find((x) => x.id === controleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.versionModele.update({ where: { id: versionId }, data: { derogations: derogations as unknown as Prisma.InputJsonValue } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'derogation_confirmee', numero: v.numero, controleId, valeur: c?.valeur ?? null, demandeeParId: d.demandeeParId } }, tx);
    });
    const g = await this.gouvernance(v.modeleId);
    const m = await this.prisma.modele.findUniqueOrThrow({ where: { id: v.modeleId }, select: { nom: true } });
    await this.notifications.notifyMany(
      [g.responsableId, g.suppleantId].filter((x): x is string => !!x && x !== actor.id),
      NotificationType.TACHE_VALIDEE,
      `Modèle « ${m.nom} » : dérogation confirmée`,
      `La dérogation sur le contrôle « ${c?.libelle ?? controleId} » (version ${v.numero}) est confirmée par l’administrateur. La version pourra être approuvée ; elle gardera la mention « activée avec dérogation ».`,
      LIEN_MODELE(v.modeleId),
      undefined,
      { libelleBouton: 'Voir la version' },
    );
    return this.detailVersion(actor, versionId, r);
  }

  async approuver(actor: AuthenticatedUser, versionId: string) {
    const r = await this.roles(actor);
    const v = await this.version(versionId);
    this.exigerGouvernant(r, v.modeleId, 'approuve une version');
    if (v.statut !== StatutVersionModele.EN_ATTENTE) throw new ConflictException('Seule une version en attente d’approbation peut être approuvée.');
    if (v.auteurId === actor.id) throw new ForbiddenException({ message: 'Vous avez déposé cette version : son approbation revient au suppléant du modèle (personne n’approuve son propre travail).', etape: 'ROLE', objetType: 'VersionModele', objetId: versionId });
    const bloquants = ModelesService.bloquantsNonDeroges(v);
    if (bloquants.length) {
      throw new ConflictException({ code: 'CONTROLE_BLOQUANT', message: `Contrôle bloquant en échec sans dérogation confirmée : ${bloquants.map((c) => c.libelle).join(', ')}.`, details: bloquants.map((c) => c.id) });
    }
    const avecDerogation = ModelesService.derogations(v).some((d) => d.confirmeeLe);
    const fiche = v.fiche as unknown as FicheModele;
    const maintenant = new Date();
    const ancienne = await this.prisma.$transaction(async (tx) => {
      const precedente = await tx.versionModele.findFirst({ where: { modeleId: v.modeleId, statut: StatutVersionModele.ACTIVE }, select: { id: true, numero: true } });
      if (precedente) await tx.versionModele.update({ where: { id: precedente.id }, data: { statut: StatutVersionModele.ARCHIVEE, archiveLe: maintenant } });
      await tx.versionModele.update({
        where: { id: versionId },
        data: { statut: StatutVersionModele.ACTIVE, approbateurId: actor.id, approuveLe: maintenant, activeLe: maintenant, avecDerogation },
      });
      await tx.modele.update({ where: { id: v.modeleId }, data: { nom: fiche.nom, famille: fiche.famille, familleLibelle: fiche.famille_libelle ?? null, description: fiche.description ?? null } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'approbation', numero: v.numero, avecDerogation } }, tx);
      await this.audit.log(
        { actorId: actor.id, action: AuditAction.PUBLICATION, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'activation', numero: v.numero, avecDerogation, versionArchivee: precedente?.numero ?? null } },
        tx,
      );
      return precedente;
    });
    const m = await this.prisma.modele.findUniqueOrThrow({ where: { id: v.modeleId }, select: { nom: true } });
    const g = await this.gouvernance(v.modeleId);
    await this.notifications.notifyMany(
      [v.auteurId, g.responsableId, g.suppleantId].filter((x, i, t): x is string => !!x && x !== actor.id && t.indexOf(x) === i),
      NotificationType.TACHE_VALIDEE,
      `Modèle « ${m.nom} » : version ${v.numero} active`,
      `Approuvée et activée${avecDerogation ? ' avec dérogation' : ''}. Elle est désormais la seule version qui fait foi${ancienne ? ` (la version ${ancienne.numero} est archivée et reste consultable)` : ''}.`,
      LIEN_MODELE(v.modeleId),
      undefined,
      { libelleBouton: 'Voir le modèle' },
    );
    return this.fiche(actor, v.modeleId);
  }

  async refuser(actor: AuthenticatedUser, versionId: string, motif: string) {
    const r = await this.roles(actor);
    const v = await this.version(versionId);
    this.exigerGouvernant(r, v.modeleId, 'refuse une version');
    if (v.statut !== StatutVersionModele.EN_ATTENTE) throw new ConflictException('Seule une version en attente d’approbation peut être refusée.');
    if (v.auteurId === actor.id) throw new ForbiddenException({ message: 'Vous avez déposé cette version : la décision revient au suppléant du modèle.', etape: 'ROLE', objetType: 'VersionModele', objetId: versionId });
    await this.prisma.$transaction(async (tx) => {
      await tx.versionModele.update({ where: { id: versionId }, data: { statut: StatutVersionModele.REFUSEE, refuseParId: actor.id, refuseLe: new Date(), motifRefus: motif.trim() } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'VersionModele', entityId: versionId, metadata: { event: 'refus', numero: v.numero, motif: motif.trim() } }, tx);
    });
    const m = await this.prisma.modele.findUniqueOrThrow({ where: { id: v.modeleId }, select: { nom: true } });
    await this.notifications.notify(v.auteurId, NotificationType.TACHE_REJETEE, `Modèle « ${m.nom} » : version ${v.numero} refusée`, `Motif : ${motif.trim()}`, LIEN_MODELE(v.modeleId), undefined, { libelleBouton: 'Voir le modèle' });
    return this.fiche(actor, v.modeleId);
  }

  // -------------------------------------------------------------------------------------------
  // Exécution interne (sans écran dans ce lot) : analystes et responsables, sur la version active
  // -------------------------------------------------------------------------------------------

  async executer(actor: AuthenticatedUser, modeleId: string, scenario: Record<string, unknown>) {
    const r = await this.roles(actor);
    if (r.administrateur || actor.role === SystemRole.ADMIN_SYSTEME) {
      throw new ForbiddenException({ message: 'L’administrateur ne lance pas de simulation : il ne voit jamais les chiffres d’une simulation.', etape: 'ROLE', objetType: 'Modele', objetId: modeleId });
    }
    if (!r.analyste && !gouverne(r, modeleId)) throw new ForbiddenException({ message: 'Une simulation se lance par un analyste ou par le responsable du modèle.', etape: 'ROLE', objetType: 'Modele', objetId: modeleId });
    const v = await this.prisma.versionModele.findFirst({ where: { modeleId, statut: StatutVersionModele.ACTIVE }, select: VERSION_SELECT });
    if (!v) throw new ConflictException({ code: 'MODELE_SANS_VERSION_ACTIVE', message: 'Ce modèle n’a pas de version active : aucune simulation possible.' });
    const erreurs = validerScenario(v.fiche as unknown as FicheModele, v.manettes as unknown as ReglageManette[], scenario);
    if (erreurs.length) throw new UnprocessableEntityException({ code: erreurs[0]!.code, message: erreurs[0]!.message, details: erreurs.map((e) => e.message) });
    const t = await this.travaux.creer(TypeTravailCalcul.EXECUTION, v.id, actor.id, scenario as Prisma.InputJsonValue);
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'TravailCalcul',
      entityId: t.id,
      metadata: { event: 'execution_demandee', modeleId, numero: v.numero, mode: String(scenario.mode ?? 'statique'), manettes: [...new Set([...(scenario.chocs as { manette: string }[] ?? []), ...(scenario.hypotheses as { manette: string }[] ?? [])].map((c) => c.manette))] },
    });
    return this.travail(actor, t.id);
  }

  /** État d'un travail : le demandeur voit le résultat ; l'administrateur, l'état technique seulement. */
  async travail(actor: AuthenticatedUser, id: string) {
    const t = await this.prisma.travailCalcul.findUnique({
      where: { id },
      select: { id: true, type: true, statut: true, etape: true, message: true, tentatives: true, enFileLe: true, debuteLe: true, termineLe: true, dureeMs: true, demandeurId: true, resultat: true, version: { select: { numero: true, modeleId: true } } },
    });
    if (!t) throw new NotFoundException('Travail introuvable.');
    const r = await rolesModelisation(this.prisma, actor);
    const demandeur = t.demandeurId === actor.id && actor.role !== SystemRole.ADMIN_SYSTEME;
    if (!demandeur && !r.administrateur) throw new ForbiddenException({ message: 'Ce calcul ne vous appartient pas.', etape: 'ROLE', objetType: 'TravailCalcul', objetId: id });
    const { resultat, demandeurId: _d, ...technique } = t;
    void _d;
    return { ...technique, modeleId: t.version.modeleId, numero: t.version.numero, ...(demandeur && t.type === TypeTravailCalcul.EXECUTION ? { resultat } : {}) };
  }
}

/** Scénario au contrat « dnpec-modele/1 », contrôlé contre la fiche et le réglage de la version active. */
export function validerScenario(fiche: FicheModele, reglages: ReglageManette[], s: Record<string, unknown>): { code: string; message: string }[] {
  const e: { code: string; message: string }[] = [];
  const modes = Array.isArray(fiche.modes) && fiche.modes.length ? fiche.modes : ['statique', 'dynamique'];
  const mode = s.mode ?? 'statique';
  if (typeof mode !== 'string' || !modes.includes(mode)) e.push({ code: 'SCENARIO_INVALIDE', message: `Mode « ${String(mode)} » inconnu de ce modèle (${modes.join(', ')}).` });
  const parId = new Map(fiche.manettes.map((m) => [m.id, m]));
  const rg = new Map(reglages.map((m) => [m.id, m]));
  const examiner = (liste: unknown, type: 'choc' | 'hypothese') => {
    if (liste === undefined) return;
    if (!Array.isArray(liste) || liste.length > 200) return e.push({ code: 'SCENARIO_INVALIDE', message: `${type === 'choc' ? 'chocs' : 'hypotheses'} : liste attendue (200 au plus).` });
    for (const x of liste as Record<string, unknown>[]) {
      const m = parId.get(String(x?.manette));
      const reg = rg.get(String(x?.manette));
      if (!m || m.type !== type || !reg?.actif) {
        e.push({ code: 'MANETTE_NON_AUTORISEE', message: `Manette « ${String(x?.manette)} » inconnue ou non proposée aux analystes.` });
        continue;
      }
      if (typeof x.valeur !== 'number' || !Number.isFinite(x.valeur)) e.push({ code: 'SCENARIO_INVALIDE', message: `${m.libelle} : valeur numérique attendue.` });
      else if (x.valeur < reg.min || x.valeur > reg.max) e.push({ code: 'BORNE_DEPASSEE', message: `${m.libelle} : ${x.valeur} hors des bornes [${reg.min} ; ${reg.max}].` });
      if (x.indices !== undefined) {
        const codes = new Set((m.indices ?? []).map((i) => i.code));
        if (!Array.isArray(x.indices) || x.indices.some((c) => !codes.has(String(c)))) e.push({ code: 'SCENARIO_INVALIDE', message: `${m.libelle} : indices inconnus.` });
      }
      if (x.annees !== undefined) {
        const h = fiche.horizon;
        if (!Array.isArray(x.annees) || x.annees.some((a) => !Number.isInteger(a) || (h && (a < h.debut || a > h.fin)))) e.push({ code: 'SCENARIO_INVALIDE', message: `${m.libelle} : années hors de l’horizon du modèle.` });
      }
    }
  };
  examiner(s.chocs, 'choc');
  examiner(s.hypotheses, 'hypothese');
  for (const cle of Object.keys(s)) if (!['mode', 'chocs', 'hypotheses'].includes(cle)) e.push({ code: 'SCENARIO_INVALIDE', message: `Champ inconnu dans le scénario : « ${cle} ».` });
  return e;
}

import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, StatutAgent, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { estDrh } from '../socle/roles-fonctionnels';
import { BASIC_FIELD_KEYS } from '../personnel/personnel-field-status.util';
import { CHAMPS_DOSSIER, EffectifsService } from './effectifs.service';

const J = 864e5;

/** Compte lu pour la synthèse : identité, niveau 1 du dossier, pièces requises fournies (identifiants seuls). */
const COMPTE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  jobTitle: true,
  status: true,
  division: { select: { name: true } },
  section: { select: { name: true } },
  cellule: { select: { name: true } },
  personnelFileBasic: {
    select: { employmentStatus: true, grade: true, echelon: true, categorie: true, serviceStartDate: true, jobDescriptionFileName: true, verifiedFields: true },
  },
  personnelDocuments: { where: { pieceRequiseId: { not: null } }, select: { pieceRequiseId: true } },
} satisfies Prisma.UserSelect;
type Compte = Prisma.UserGetPayload<{ select: typeof COMPTE_SELECT }>;
type Fichier = NonNullable<Compte['personnelFileBasic']>;

export type TypeAlerteDossier = 'FIN_STAGE' | 'FIN_CONTRAT' | 'AVANCEMENT_ECHELON' | 'DOSSIER_A_VERIFIER' | 'MATRICULE_PROVISOIRE';

export interface LigneDossier {
  /** Agent (personne physique) ; nul pour un compte qui n'en a pas (compte non actif ancien). */
  agentId: string | null;
  userId: string | null;
  prenom: string;
  nom: string;
  matricule: string | null;
  matriculeProvisoire: boolean;
  poste: string | null;
  role: SystemRole | null;
  unite: string | null;
  statut: StatutAgent;
  /** Fin prévue (stage, contrat) non encore confirmée, pour un agent qui n'est pas parti. */
  finPrevue: string | null;
  /** Pourcentage de complétude (0 à 100), calculé à chaque lecture. */
  completude: number;
  aVerifier: boolean;
  alertes: { type: TypeAlerteDossier; libelle: string }[];
  /** Dossier à ouvrir : celui du compte, sinon la fiche de l'agent. */
  lien: string;
  /** Situation administrative (niveau 1 du dossier) : « A / 3 », date de prise de service, ancienneté en
   * années révolues — calculées à la lecture, null si non renseignées. */
  categorieEchelon: string | null;
  priseDeService: string | null;
  ancienneteAnnees: number | null;
  /** Attestation de travail préremplie (Documents générés) : compte actif, hors stagiaire, hors soi-même ; null sinon. */
  attestation: string | null;
}

/**
 * Complétude d'un dossier : part des éléments renseignés parmi une liste FERMÉE —
 *   1. les champs du niveau 1 que l'alerte « Dossier incomplet » exige (`CHAMPS_DOSSIER` :
 *      statut d'emploi, grade, échelon, catégorie, date de prise de service) ;
 *   2. les pièces requises actives (liste tenue par le DRH), fournies par un document du dossier.
 * Un dossier est donc à 100 % exactement quand il ne porte pas l'alerte « Dossier incomplet ».
 * Jamais stockée ; aucune valeur du niveau 2 (informations personnelles, diplômes, contenu des
 * pièces) n'est lue au-delà de l'identifiant de la pièce requise fournie.
 */
export function completudeDossier(f: Pick<Fichier, 'employmentStatus' | 'grade' | 'echelon' | 'categorie' | 'serviceStartDate'> | null, piecesActives: string[], fournies: Set<string>): number {
  const total = CHAMPS_DOSSIER.length + piecesActives.length;
  const champs = CHAMPS_DOSSIER.filter(([cle]) => {
    const v = f ? (f as Record<string, unknown>)[cle] : null;
    return v !== null && v !== undefined && v !== '';
  }).length;
  const pieces = piecesActives.filter((id) => fournies.has(id)).length;
  return total === 0 ? 100 : Math.round(((champs + pieces) / total) * 100);
}

/** « À vérifier » : un champ du niveau 1 renseigné que la personne n'a pas encore confirmé (même règle que l'écran du dossier). */
function aVerifier(f: Fichier | null): boolean {
  if (!f) return false;
  const verifies = f.verifiedFields && typeof f.verifiedFields === 'object' && !Array.isArray(f.verifiedFields) ? (f.verifiedFields as Record<string, unknown>) : {};
  const valeurs: Record<(typeof BASIC_FIELD_KEYS)[number], unknown> = {
    employmentStatus: f.employmentStatus,
    grade: f.grade,
    echelon: f.echelon,
    serviceStartDate: f.serviceStartDate,
    jobDescription: f.jobDescriptionFileName,
  };
  return BASIC_FIELD_KEYS.some((k) => valeurs[k] != null && verifies[k] !== true);
}

/** Années révolues entre la prise de service et aujourd'hui (jamais négatif). */
function anneesRevolues(depuis: Date, maintenant: Date): number {
  let n = maintenant.getUTCFullYear() - depuis.getUTCFullYear();
  if (maintenant.getUTCMonth() < depuis.getUTCMonth() || (maintenant.getUTCMonth() === depuis.getUTCMonth() && maintenant.getUTCDate() < depuis.getUTCDate())) n--;
  return Math.max(0, n);
}

const STATUT_COMPTE: Record<UserStatus, StatutAgent> = {
  EN_ATTENTE: StatutAgent.EN_ACTIVITE,
  ACTIF: StatutAgent.EN_ACTIVITE,
  SUSPENDU: StatutAgent.SUSPENDU,
  SUPPRIME: StatutAgent.PARTI,
};

/**
 * Synthèse du dossier du personnel pour le DRH (refonte de l'interface, étape 7) : bande de
 * compteurs et une ligne par agent (complétude calculée, alertes). Lecture seule, DRH seul
 * (`estDrh`) : les alertes reprennent `EffectifsService.calculerAlertes` (fins prévues, avancement
 * d'échelon après `rh.avancementEchelonMois`), plus le matricule provisoire et le dossier « à vérifier ».
 */
@Injectable()
export class DossiersSyntheseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectifs: EffectifsService,
  ) {}

  async synthese(actor: AuthenticatedUser, maintenant = new Date()) {
    if (!estDrh(actor)) throw new ForbiddenException('La synthèse des dossiers du personnel est réservée au DRH.');

    const [agents, comptesSansAgent, pieces, alertesRh] = await Promise.all([
      this.prisma.agent.findMany({
        select: {
          id: true,
          matricule: true,
          matriculeProvisoire: true,
          nom: true,
          prenoms: true,
          fonction: true,
          statut: true,
          dateFinPrevue: true,
          finConfirmeeAt: true,
          unite: { select: { libelle: true } },
          compte: { select: COMPTE_SELECT },
        },
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
      }),
      this.prisma.user.findMany({ where: { agentId: null, status: { not: UserStatus.EN_ATTENTE } }, select: COMPTE_SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.prisma.pieceRequise.findMany({ where: { actif: true }, select: { id: true } }),
      this.effectifs.calculerAlertes(maintenant),
    ]);
    const piecesActives = pieces.map((p) => p.id);

    const alertesDe = (agentId: string | null, userId: string | null) => {
      const res: LigneDossier['alertes'] = [];
      for (const a of alertesRh) {
        if (!((agentId && a.agentId === agentId) || (userId && a.userId === userId))) continue;
        if (a.type === 'FIN_STAGE' || a.type === 'FIN_CONTRAT') {
          const jours = a.echeance ? Math.ceil((new Date(`${a.echeance}T00:00:00.000Z`).getTime() - maintenant.getTime()) / J) : 0;
          const quoi = a.type === 'FIN_STAGE' ? 'Fin de stage' : 'Fin de contrat';
          res.push({ type: a.type, libelle: jours < 0 ? `${quoi} dépassée` : `${quoi} J-${jours}` });
        } else if (a.type === 'AVANCEMENT_ECHELON') res.push({ type: a.type, libelle: 'Avancement d’échelon dû' });
      }
      return res;
    };

    const unite = (c: Compte) => c.cellule?.name ?? ([c.division?.name, c.section?.name].filter(Boolean).join(' · ') || null);
    const ligne = (c: Compte | null, a: (typeof agents)[number] | null): LigneDossier => {
      const f = c?.personnelFileBasic ?? null;
      const fournies = new Set((c?.personnelDocuments ?? []).map((d) => d.pieceRequiseId).filter((x): x is string => !!x));
      const verifier = aVerifier(f);
      const statut = a ? a.statut : STATUT_COMPTE[c!.status];
      const alertes = alertesDe(a?.id ?? null, c?.id ?? null);
      if (verifier) alertes.push({ type: 'DOSSIER_A_VERIFIER', libelle: 'Dossier à vérifier' });
      if (a?.matriculeProvisoire && statut !== StatutAgent.PARTI) alertes.push({ type: 'MATRICULE_PROVISOIRE', libelle: 'Matricule provisoire' });
      return {
        agentId: a?.id ?? null,
        userId: c?.id ?? null,
        prenom: a?.prenoms ?? c!.firstName,
        nom: a?.nom ?? c!.lastName,
        matricule: a?.matricule ?? null,
        matriculeProvisoire: !!a?.matriculeProvisoire,
        poste: a?.fonction ?? c?.jobTitle ?? null,
        role: c?.role ?? null,
        unite: a?.unite?.libelle ?? (c ? unite(c) : null),
        statut,
        finPrevue: a?.dateFinPrevue && !a.finConfirmeeAt && statut !== StatutAgent.PARTI ? a.dateFinPrevue.toISOString().slice(0, 10) : null,
        completude: completudeDossier(f, piecesActives, fournies),
        aVerifier: verifier,
        alertes,
        lien: c ? `/personnel/${c.id}` : `/agents?id=${a!.id}`,
        categorieEchelon: f?.categorie || f?.echelon ? `${f?.categorie ?? '—'} / ${f?.echelon ?? '—'}` : null,
        priseDeService: f?.serviceStartDate ? f.serviceStartDate.toISOString().slice(0, 10) : null,
        ancienneteAnnees: f?.serviceStartDate ? anneesRevolues(f.serviceStartDate, maintenant) : null,
        attestation: c && c.status === UserStatus.ACTIF && c.role !== SystemRole.STAGIAIRE && c.id !== actor.id ? `/documents-generes?onglet=attestations&nouvelle=1&agent=${c.id}` : null,
      };
    };

    const lignes = [...agents.map((a) => ligne(a.compte, a)), ...comptesSansAgent.map((c) => ligne(c, null))].sort(
      (x, y) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr'),
    );
    const presents = lignes.filter((l) => l.statut !== StatutAgent.PARTI);
    return {
      droits: { importer: true, creerAgent: true },
      synthese: {
        enActivite: lignes.filter((l) => l.statut === StatutAgent.EN_ACTIVITE).length,
        suspendus: lignes.filter((l) => l.statut === StatutAgent.SUSPENDU).length,
        partis: lignes.filter((l) => l.statut === StatutAgent.PARTI).length,
        aVerifier: presents.filter((l) => l.aVerifier).length,
        matriculesProvisoires: presents.filter((l) => l.matriculeProvisoire).length,
        completudeMoyenne: presents.length ? Math.round(presents.reduce((s, l) => s + l.completude, 0) / presents.length) : null,
      },
      /** Nombre d'éléments comptés dans la complétude (champs du niveau 1 + pièces requises actives). */
      elementsCompletude: CHAMPS_DOSSIER.length + piecesActives.length,
      lignes,
      calculeLe: maintenant.toISOString(),
    };
  }
}

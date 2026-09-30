/**
 * Données de DÉMONSTRATION — lancé par .github/workflows/db-demo.yml
 * (ou `DEMO_PASSWORD=… pnpm --filter @dnpec/api run db:demo -- creer|supprimer` sur une base locale).
 *
 * « creer » : unités, comptes et contenus de démonstration, par les VRAIS services de
 * l'application (mêmes règles, même numérotation, même journal d'audit qu'à l'écran).
 * « supprimer » : retire tout ce qui est marqué ; ce que les règles d'intégrité protègent
 * est annulé, réformé ou désactivé (liste exacte affichée).
 *
 * Marques : unités et contenus « TEST — … », comptes @demo.dnpec.test, registres TEST-ARR /
 * TEST-DEP, catégories TST / TSF, ressources et article d'identifiant « demo-… ».
 * Garde-fous : aucune notification vers un compte réel (filtrée ici), aucun email vers le
 * domaine de démonstration (bloqué dans EmailService), aucun fichier écrit dans le stockage
 * (les pièces pointent vers apps/api/assets/demo-document-dnpec.pdf, « integre: »).
 * Idempotent : chaque bloc vérifie s'il existe déjà. Refuse de tourner si les migrations
 * ne sont pas à jour.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  ActeStatut,
  AnnouncementScope,
  ArriveeStatut,
  AuditAction,
  CourrierConfidentialite,
  DocumentCategory,
  StatutDiffusion,
  TypeDocument,
  EtatBien,
  EvaluationFormat,
  ImputationNature,
  MeetingResponseStatus,
  ModeReservation,
  NatureCategorieLogistique,
  Prisma,
  PrismaClient,
  RegistreNature,
  RegistrePortee,
  StatutAgent,
  StatutReservation,
  SystemRole,
  TaskPriority,
  TypeDemandeLogistique,
  TypeMouvementBien,
  TypeMouvementStock,
  TypeRessource,
  UserStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/common/types/auth-user.type';
import { PasswordService } from '../src/common/security/password.service';
import { StorageService } from '../src/common/storage/storage.service';
import { PREFIXE_INTEGRE } from '../src/common/storage/fichiers-integres';
import { NotificationsService } from '../src/communication/notifications/notifications.service';
import { AnnouncementsService } from '../src/communication/announcements/announcements.service';
import { PollsService } from '../src/communication/polls/polls.service';
import { MessagesService } from '../src/communication/messages/messages.service';
import { TasksService } from '../src/tasks/tasks.service';
import { BroadcastMode } from '../src/tasks/dto/broadcast-task.dto';
import { MeetingsService } from '../src/meetings/meetings.service';
import { DecisionsService } from '../src/meetings/decisions.service';
import { LeaveRequestsService } from '../src/leaves/leave-requests/leave-requests.service';
import { SuggestionsService } from '../src/suggestions/suggestions.service';
import { DocumentsService } from '../src/documents/documents.service';
import { GenerateurService } from '../src/generateur/generateur.service';
import { SuppleancesService } from '../src/suppleances/suppleances.service';
import { PersonnelFilesService } from '../src/personnel/personnel-files.service';
import { ArriveesService } from '../src/courrier/arrivees.service';
import { ImputationsService } from '../src/courrier/imputations.service';
import { ActesService } from '../src/courrier/actes.service';
import { StagesService } from '../src/stages/stages.service';
import { StagesRotationService } from '../src/stages/stages-rotation.service';
import { GestionnairesLogistiqueService } from '../src/logistique/gestionnaires.service';
import { ReferentielLogistiqueService } from '../src/logistique/referentiel.service';
import { InventaireService } from '../src/logistique/inventaire.service';
import { DemandesLogistiqueService } from '../src/logistique/demandes.service';
import { ReservationsService } from '../src/logistique/reservations.service';
import { PlanTravailService } from '../src/plan-travail/plan-travail.service';
import { FilsService } from '../src/collaboration/fils.service';
import { DOMAINE_DEMO, DUREE_DEMO_JOURS, ENTITE_AUDIT_DEMO, PREFIXE_DEMO, estAdresseDemo } from '../src/demo/demo.constantes';
import { verifierMigrations } from './verifier-migrations';
import { rolesActifs } from '../src/socle/roles-fonctionnels';
import { ReprisesN1Service } from '../src/socle/reprise-n1.service';

const T = PREFIXE_DEMO; // « TEST — »
const FICHIER_DEMO = 'demo-document-dnpec.pdf';
const J = 24 * 3600 * 1000;

// ---------------------------------------------------------------------------
// Journal lisible
// ---------------------------------------------------------------------------
const journal: { etat: 'créé' | 'déjà présent' | 'supprimé' | 'conservé'; quoi: string; pourquoi?: string }[] = [];
const cree = (quoi: string) => journal.push({ etat: 'créé', quoi });
const present = (quoi: string) => journal.push({ etat: 'déjà présent', quoi });
const supprime = (quoi: string) => journal.push({ etat: 'supprimé', quoi });
const conserve = (quoi: string, pourquoi: string) => journal.push({ etat: 'conservé', quoi, pourquoi });

/** Date à `n` jours d'aujourd'hui, à l'heure donnée (heure locale du serveur). */
function jour(n: number, h = 9, m = 0): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Date(d.getTime() + n * J);
}
const iso = (n: number, h = 9, m = 0) => jour(n, h, m).toISOString();
const dateSeule = (n: number) => iso(n, 12).slice(0, 10);

// ---------------------------------------------------------------------------
// Comptes de démonstration
// ---------------------------------------------------------------------------
type Cle =
  | 'chefDivision'
  | 'chefSection1'
  | 'chefSection2'
  | 'chefCellule'
  | 'agent1'
  | 'agent2'
  | 'agent3'
  | 'agent4'
  | 'agent5'
  | 'assistant'
  | 'stagiaire'
  | 'secretariat'
  | 'logistique'
  | 'systeme'
  | 'dn';

interface DefCompte {
  cle: Cle;
  local: string;
  prenom: string;
  nom: string;
  role: SystemRole;
  unite: 'division' | 's1' | 's2' | 'cellule' | 'aucune';
  poste: string;
}

const COMPTES: DefCompte[] = [
  { cle: 'chefDivision', local: 'chef.division', prenom: 'Mamadou', nom: 'Diallo', role: SystemRole.CHEF_DIVISION, unite: 'division', poste: 'Chef de la Division Démo' },
  { cle: 'chefSection1', local: 'chef.section.analyses', prenom: 'Fatoumata', nom: 'Camara', role: SystemRole.CHEF_SECTION, unite: 's1', poste: 'Cheffe de la Section Analyses' },
  { cle: 'chefSection2', local: 'chef.section.syntheses', prenom: 'Ibrahima', nom: 'Sow', role: SystemRole.CHEF_SECTION, unite: 's2', poste: 'Chef de la Section Synthèses' },
  { cle: 'chefCellule', local: 'chef.cellule', prenom: 'Mariama', nom: 'Bah', role: SystemRole.CHEF_CELLULE, unite: 'cellule', poste: 'Cheffe de la Cellule Démo' },
  { cle: 'agent1', local: 'agent.conde', prenom: 'Alpha', nom: 'Condé', role: SystemRole.AGENT, unite: 's1', poste: 'Chargé d’études — prévisions' },
  { cle: 'agent2', local: 'agent.barry', prenom: 'Aïssatou', nom: 'Barry', role: SystemRole.AGENT, unite: 's1', poste: 'Chargée d’études — conjoncture' },
  { cle: 'agent3', local: 'agent.keita', prenom: 'Sékou', nom: 'Keïta', role: SystemRole.AGENT, unite: 's2', poste: 'Chargé d’études — finances publiques' },
  { cle: 'agent4', local: 'agent.toure', prenom: 'Kadiatou', nom: 'Touré', role: SystemRole.AGENT, unite: 's2', poste: 'Chargée d’études — secteur extérieur' },
  { cle: 'agent5', local: 'agent.sylla', prenom: 'Ousmane', nom: 'Sylla', role: SystemRole.AGENT, unite: 'cellule', poste: 'Chargé d’études — statistiques' },
  { cle: 'assistant', local: 'assistant', prenom: 'Hawa', nom: 'Soumah', role: SystemRole.ASSISTANT_DIRECTION, unite: 'aucune', poste: 'Assistante de la Cellule Démo' },
  { cle: 'stagiaire', local: 'stagiaire', prenom: 'Moussa', nom: 'Kourouma', role: SystemRole.STAGIAIRE, unite: 'aucune', poste: 'Stagiaire' },
  { cle: 'secretariat', local: 'secretariat', prenom: 'Djénabou', nom: 'Bangoura', role: SystemRole.AGENT, unite: 'division', poste: 'Secrétariat courrier de la Division Démo' },
  { cle: 'logistique', local: 'logistique', prenom: 'Lansana', nom: 'Cissé', role: SystemRole.AGENT, unite: 'cellule', poste: 'Gestionnaire logistique' },
];
/** Acteur technique (stage, dossiers du personnel : actions réservées au DRH) — jamais connectable. */
const COMPTE_SYSTEME: DefCompte = { cle: 'systeme', local: 'systeme', prenom: 'Système', nom: 'Démo', role: SystemRole.DRH, unite: 'aucune', poste: 'Compte technique de la démonstration (non connectable)' };
/** DN de démonstration, créé SEULEMENT si aucun DN ni DNA réel n'est actif. */
const COMPTE_DN: DefCompte = { cle: 'dn', local: 'dn', prenom: 'Directeur', nom: 'Démo', role: SystemRole.DN, unite: 'aucune', poste: 'Directeur National (démonstration)' };

const email = (local: string) => `${local}@${DOMAINE_DEMO}`;

// ---------------------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------------------
interface Ctx {
  prisma: PrismaClient;
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  u: Partial<Record<Cle, { id: string; email: string }>>;
  division: { id: string };
  s1: { id: string };
  s2: { id: string };
  cellule: { id: string };
  directionReelle: { email: string; role: SystemRole } | null;
}

async function acteur(prisma: PrismaClient, id: string): Promise<AuthenticatedUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, include: { supervisor: { select: { role: true, celluleId: true } } } });
  return {
    id: u.id,
    role: u.role,
    status: UserStatus.ACTIF,
    divisionId: u.divisionId,
    sectionId: u.sectionId,
    celluleId: u.celluleId,
    supervisorRole: u.role === SystemRole.ASSISTANT_DIRECTION ? (u.supervisor?.role ?? null) : null,
    supervisorCelluleId: u.role === SystemRole.ASSISTANT_DIRECTION ? (u.supervisor?.celluleId ?? null) : null,
    interimForId: null,
    agentId: u.agentId,
    rolesFonctionnels: await rolesActifs(prisma, u.id),
  };
}

/** Fichier « téléversé » : StorageService.save est redirigé vers le PDF de démonstration livré. */
function fichier(nom: string): Express.Multer.File {
  const buffer = Buffer.from('demo');
  return { fieldname: 'file', originalname: nom, encoding: '7bit', mimetype: 'application/pdf', size: buffer.length, buffer } as Express.Multer.File;
}

// ---------------------------------------------------------------------------
// Unités et comptes
// ---------------------------------------------------------------------------
async function unites(prisma: PrismaClient) {
  const upsertDivision = async () => {
    const d = await prisma.division.findUnique({ where: { code: 'TESTDEMO' } });
    if (d) {
      if (!d.isActive) await prisma.division.update({ where: { id: d.id }, data: { isActive: true } });
      present(`Unité « ${d.name} »`);
      return d;
    }
    const n = await prisma.division.create({ data: { code: 'TESTDEMO', name: `${T}Division Démo` } });
    cree(`Unité « ${n.name} »`);
    return n;
  };
  const division = await upsertDivision();
  const section = async (code: string, name: string) => {
    const s = await prisma.section.findFirst({ where: { code, divisionId: division.id } });
    if (s) {
      if (!s.isActive) await prisma.section.update({ where: { id: s.id }, data: { isActive: true } });
      present(`Unité « ${s.name} »`);
      return s;
    }
    const n = await prisma.section.create({ data: { code, name, divisionId: division.id } });
    cree(`Unité « ${n.name} »`);
    return n;
  };
  const s1 = await section('TESTANA', `${T}Section Analyses`);
  const s2 = await section('TESTSYN', `${T}Section Synthèses`);
  let cellule = await prisma.cellule.findUnique({ where: { code: 'TESTCEL' } });
  if (cellule) {
    if (!cellule.isActive) cellule = await prisma.cellule.update({ where: { id: cellule.id }, data: { isActive: true } });
    present(`Unité « ${cellule.name} »`);
  } else {
    cellule = await prisma.cellule.create({ data: { code: 'TESTCEL', name: `${T}Cellule Démo` } });
    cree(`Unité « ${cellule.name} »`);
  }
  return { division, s1, s2, cellule };
}

async function comptes(ctx: Omit<Ctx, 'u' | 'directionReelle'>, motDePasse: string) {
  const { prisma, app } = ctx;
  const hash = await app.get(PasswordService).hash(motDePasse);
  const u: Ctx['u'] = {};
  const rattachement = (d: DefCompte) =>
    d.unite === 'division'
      ? { divisionId: ctx.division.id, sectionId: null, celluleId: null }
      : d.unite === 's1'
        ? { divisionId: ctx.division.id, sectionId: ctx.s1.id, celluleId: null }
        : d.unite === 's2'
          ? { divisionId: ctx.division.id, sectionId: ctx.s2.id, celluleId: null }
          : d.unite === 'cellule'
            ? { divisionId: null, sectionId: null, celluleId: ctx.cellule.id }
            : { divisionId: null, sectionId: null, celluleId: null };

  // Direction : un DN ou une DNA réel(le) actif(ve) sert à la vue Direction ; sinon, DN de démonstration.
  const reel = await prisma.user.findFirst({
    where: { role: { in: [SystemRole.DN, SystemRole.DNA] }, status: UserStatus.ACTIF, NOT: { email: { endsWith: `@${DOMAINE_DEMO}` } } },
    orderBy: { role: 'asc' },
    select: { email: true, role: true },
  });
  const defs = [...COMPTES, COMPTE_SYSTEME, ...(reel ? [] : [COMPTE_DN])];

  for (const d of defs) {
    const adresse = email(d.local);
    const data = {
      firstName: `${T}${d.prenom}`,
      lastName: d.nom,
      role: d.role,
      jobTitle: d.poste,
      ...rattachement(d),
      supervisorId: null as string | null,
    };
    const existant = await prisma.user.findUnique({ where: { email: adresse } });
    const statut = d.cle === 'systeme' ? UserStatus.SUSPENDU : UserStatus.ACTIF;
    if (existant) {
      // Relance : même compte, mot de passe du lancement, rattachement et rôle rétablis (les unités ont
      // pu être supprimées puis recréées), réactivé (la démonstration repart pour 14 jours).
      await prisma.user.update({ where: { id: existant.id }, data: { ...data, passwordHash: hash, status: statut } });
      u[d.cle] = { id: existant.id, email: adresse };
      if (existant.status !== statut) cree(`Compte ${adresse} réactivé`);
      else present(`Compte ${adresse}`);
    } else {
      const n = await prisma.user.create({ data: { ...data, email: adresse, passwordHash: hash, status: statut } });
      u[d.cle] = { id: n.id, email: adresse };
      cree(`Compte ${adresse} (${d.role})`);
    }
  }
  // Chef de cellule (source de vérité : Cellule.chefId) et superviseur de l'assistante.
  await prisma.cellule.update({ where: { id: ctx.cellule.id }, data: { chefId: u.chefCellule!.id } });
  await prisma.user.update({ where: { id: u.assistant!.id }, data: { supervisorId: u.chefCellule!.id } });
  // Un DN de démonstration d'une démo précédente devient inutile si un DN/DNA réel existe.
  if (reel) {
    const ancienDn = await prisma.user.findUnique({ where: { email: email(COMPTE_DN.local) } });
    if (ancienDn && ancienDn.status !== UserStatus.SUPPRIME) {
      await prisma.user.update({ where: { id: ancienDn.id }, data: { status: UserStatus.SUPPRIME } });
      supprime(`Compte ${ancienDn.email} (un DN/DNA réel est actif)`);
    }
  }
  return { u, directionReelle: reel };
}

/**
 * Socle N1 : unités miroir et agents des comptes de démonstration, par la reprise du socle (vrai service).
 * Un compte de démonstration réactivé (relance après « supprimer ») retrouve un agent en activité.
 */
async function socle(prisma: PrismaClient, app: Ctx['app'], demoIds: string[]) {
  // Unités, responsables, agents et rôles de position (DRH, assistant).
  const r = await app.get(ReprisesN1Service).reconcilier();
  const repris = await prisma.agent.updateMany({
    where: { statut: StatutAgent.PARTI, compte: { is: { id: { in: demoIds }, status: UserStatus.ACTIF } } },
    data: { statut: StatutAgent.EN_ACTIVITE, dateDepart: null, motifDepart: null },
  });
  const agents = await prisma.agent.count({ where: { compte: { is: { id: { in: demoIds } } } } });
  const unites = await prisma.uniteOrganisationnelle.count({ where: { libelle: { startsWith: T } } });
  const quoi = `Socle : ${unites} unité(s) à l’organigramme, ${agents} agent(s)${repris.count ? ` (dont ${repris.count} remis en activité)` : ''}`;
  if (r.unitesCreees + r.agentsCrees + r.attributionsCreees + repris.count > 0) cree(quoi);
  else present(quoi);
}

// ---------------------------------------------------------------------------
// Contenus (un bloc = une vérification d'existence)
// ---------------------------------------------------------------------------
async function bloc(nom: string, existe: () => Promise<boolean>, creer: () => Promise<void>) {
  if (await existe()) return present(nom);
  await creer();
  cree(nom);
}

async function taches(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const svc = app.get(TasksService);
  await bloc(
    'Tâches (≈ 25, tous statuts, sous-tâches, commentaires, une rejetée, une diffusée à la division)',
    async () => (await prisma.task.count({ where: { createdById: { in: [u.chefDivision!.id, u.chefSection1!.id, u.chefSection2!.id, u.chefCellule!.id] }, title: { startsWith: T } } })) > 0,
    async () => {
      const chefD = await acteur(prisma, u.chefDivision!.id);
      const chefS1 = await acteur(prisma, u.chefSection1!.id);
      const chefS2 = await acteur(prisma, u.chefSection2!.id);
      const chefC = await acteur(prisma, u.chefCellule!.id);
      const qui = async (k: Cle) => acteur(prisma, u[k]!.id);
      const div = { divisionId: ctx.division.id };
      const s1 = { divisionId: ctx.division.id, sectionId: ctx.s1.id };
      const s2 = { divisionId: ctx.division.id, sectionId: ctx.s2.id };
      const cel = { celluleId: ctx.cellule.id };
      const creer = (a: AuthenticatedUser, titre: string, unite: object, k: Cle[], echeance: number, priorite: TaskPriority = TaskPriority.NORMAL, description?: string) =>
        svc.create(a, { title: `${T}${titre}`, description, priority: priorite, dueDate: iso(echeance, 17), ...unite, assignees: k.map((x, i) => ({ userId: u[x]!.id, roleOnTask: i === 0 ? 'RESPONSABLE' : 'COLLABORATEUR' })) } as never);

      // À faire
      await creer(chefS1, 'Mise à jour du cadrage macroéconomique 2027', s1, ['agent1', 'agent2'], 12, TaskPriority.URGENT, 'Actualiser les hypothèses de croissance, d’inflation et de change avec les dernières données.');
      await creer(chefS1, 'Note sur l’évolution des prix à la consommation', s1, ['agent2'], 9);
      await creer(chefS2, 'Tableau des opérations financières de l’État — trimestre 3', s2, ['agent3'], 15);
      await creer(chefS2, 'Suivi des exportations minières', s2, ['agent4'], 20, TaskPriority.FAIBLE);
      await creer(chefC, 'Nettoyage de la base des indicateurs mensuels', cel, ['agent5'], 7);
      // En cours (avec avancement)
      const enCours: [AuthenticatedUser, string, object, Cle[], number, number][] = [
        [chefS1, 'Projections du PIB par secteur', s1, ['agent1'], 6, 40],
        [chefS1, 'Revue des indicateurs avancés de conjoncture', s1, ['agent2', 'agent1'], 4, 70],
        [chefS2, 'Analyse de la soutenabilité de la dette', s2, ['agent3', 'agent4'], 10, 25],
        [chefC, 'Enquête de conjoncture auprès des entreprises', cel, ['agent5'], 14, 55],
      ];
      for (const [a, titre, unite, k, e, pct] of enCours) {
        const t = await creer(a, titre, unite, k, e);
        const resp = await qui(k[0]!);
        await svc.start(resp, t.id);
      }
      // En retard (échéance dépassée, encore en cours)
      const retard = await creer(chefS2, 'Balance des paiements — estimation provisoire', s2, ['agent4'], 5, TaskPriority.URGENT);
      await svc.start(await qui('agent4'), retard.id);
      await prisma.task.update({ where: { id: retard.id }, data: { dueDate: jour(-3, 17) } });
      const retard2 = await creer(chefS1, 'Rapport mensuel de conjoncture — août', s1, ['agent1'], 5);
      await prisma.task.update({ where: { id: retard2.id }, data: { dueDate: jour(-6, 17) } });
      // Soumises pour validation
      for (const [a, titre, unite, k] of [
        [chefS1, 'Synthèse des prévisions des partenaires techniques', s1, ['agent2']],
        [chefS2, 'Note sur l’exécution budgétaire à fin août', s2, ['agent3']],
        [chefC, 'Mise à jour du tableau de bord statistique', cel, ['agent5']],
      ] as [AuthenticatedUser, string, object, Cle[]][]) {
        const t = await creer(a, titre, unite, k, 3);
        const r = await qui(k[0]!);
        await svc.start(r, t.id);
        await svc.submit(r, t.id);
      }
      // Validées / terminées
      for (const [a, titre, unite, k] of [
        [chefS1, 'Note de conjoncture du deuxième trimestre', s1, ['agent1']],
        [chefS2, 'Calendrier budgétaire 2027', s2, ['agent4']],
        [chefC, 'Documentation des séries statistiques', cel, ['agent5']],
        [chefD, 'Contribution au rapport annuel de la DNPEC', div, ['chefSection1', 'chefSection2']],
      ] as [AuthenticatedUser, string, object, Cle[]][]) {
        const t = await creer(a, titre, unite, k, 2);
        const r = await qui(k[0]!);
        await svc.start(r, t.id);
        await svc.submit(r, t.id);
        await svc.validate(a, t.id, { comment: 'Travail de qualité, merci.' });
      }
      // Rejetée avec motif (retour au responsable)
      const rej = await creer(chefS2, 'Projection des recettes douanières', s2, ['agent3'], 8);
      const r3 = await qui('agent3');
      await svc.start(r3, rej.id);
      await svc.submit(r3, rej.id);
      await svc.reject(chefS2, rej.id, { comment: 'Les hypothèses de taux de change ne sont pas documentées : merci de compléter la section 2.' });
      // Sous-tâches et commentaires
      const parent = await creer(chefD, 'Préparation du séminaire de validation du cadrage', div, ['chefSection1', 'chefSection2'], 18, TaskPriority.URGENT, 'Organisation matérielle, documents et présentations pour le séminaire.');
      const sous = [
        ['Réserver la salle et le matériel', 'chefSection1'],
        ['Préparer la présentation des hypothèses', 'agent1'],
        ['Rédiger la note introductive', 'agent3'],
      ] as [string, Cle][];
      for (const [i, [titre, k]] of sous.entries()) {
        const st = await svc.createSubtask(chefD, parent.id, { title: `${T}${titre}`, dueDate: iso(10 + i, 17), assignees: [{ userId: u[k]!.id, roleOnTask: 'RESPONSABLE' }] } as never);
        if (i === 0) await svc.toggleSubtaskCompletion(await qui(k), st.id);
      }
      await svc.addComment(chefD, parent.id, { body: 'Pensez à inviter les partenaires techniques et financiers.' });
      await svc.addComment(await qui('chefSection1'), parent.id, { body: 'La salle principale est demandée pour le 10 ; je confirme dès réponse.', mentionedUserIds: [u.chefDivision!.id] });
      const t1 = await prisma.task.findFirstOrThrow({ where: { title: `${T}Projections du PIB par secteur` } });
      await svc.addComment(await qui('agent1'), t1.id, { body: 'Première version des projections déposée ; en attente des données du secteur minier.' });
      await svc.addComment(chefS1, t1.id, { body: 'Merci. Prévoir une variante basse pour le prix de la bauxite.', mentionedUserIds: [u.agent1!.id] });
      // Diffusée à toute la division (une tâche par membre)
      await svc.broadcastToDivision(chefD, { divisionId: ctx.division.id, mode: BroadcastMode.INDIVIDUAL, title: `${T}Mise à jour des fiches de poste`, description: 'Chaque agent relit et complète sa fiche de poste.', dueDate: iso(21, 17) } as never);
    },
  );
}

async function reunions(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const svc = app.get(MeetingsService);
  const dec = app.get(DecisionsService);
  const salle = await prisma.ressourceReservable.findUniqueOrThrow({ where: { id: 'demo-ressource-salle' } });
  await bloc(
    'Réunions (passée avec compte rendu et décisions, à venir, ouverte, avec salle réservée)',
    async () => (await prisma.meeting.count({ where: { createdById: u.chefDivision!.id, title: { startsWith: T } } })) > 0,
    async () => {
      const chefD = await acteur(prisma, u.chefDivision!.id);
      const tous = (['chefSection1', 'chefSection2', 'agent1', 'agent2', 'agent3', 'agent4'] as Cle[]).map((k) => u[k]!.id);
      // Passée : créée à venir puis ramenée dans le passé (le service n'accepte que l'avenir), compte rendu et décisions.
      const passee = await svc.create(chefD, { title: `${T}Réunion de coordination mensuelle`, agenda: '1. Point sur le cadrage\n2. Calendrier des publications\n3. Divers', location: 'Salle de la Division Démo', startAt: iso(30, 9), endAt: iso(30, 11), participantIds: tous });
      await prisma.meeting.update({ where: { id: passee.id }, data: { startAt: jour(-7, 9), endAt: jour(-7, 11) } });
      for (const k of ['chefSection1', 'chefSection2', 'agent1'] as Cle[]) await svc.respond(await acteur(prisma, u[k]!.id), passee.id, { status: MeetingResponseStatus.CONFIRME });
      await svc.update(chefD, passee.id, { minutesText: 'Le cadrage est validé dans ses grandes lignes. La note de conjoncture paraîtra le 15. Les sections transmettent leurs contributions au rapport annuel avant la fin du mois.' });
      const d1 = await dec.create(chefD, passee.id, { content: 'Publier la note de conjoncture le 15 du mois.' });
      await dec.create(chefD, passee.id, { content: 'Chaque section transmet sa contribution au rapport annuel avant la fin du mois.' });
      await dec.convertToAction(chefD, d1.id, { title: `${T}Publier la note de conjoncture`, assigneeId: u.chefSection1!.id, dueDate: iso(8, 17) } as never);
      // À venir, avec la salle de démonstration réservée.
      const aVenir = await svc.create(chefD, { title: `${T}Séminaire de validation du cadrage`, agenda: 'Présentation des hypothèses et échanges avec les partenaires.', startAt: iso(10, 9), endAt: iso(10, 13), participantIds: tous, ressourceId: salle.id });
      await svc.respond(await acteur(prisma, u.chefSection1!.id), aVenir.id, { status: MeetingResponseStatus.CONFIRME });
      await svc.respond(await acteur(prisma, u.agent4!.id), aVenir.id, { status: MeetingResponseStatus.DECLINE });
      // Ouverte (tout le monde peut s'y joindre).
      const chefC = await acteur(prisma, u.chefCellule!.id);
      await svc.create(chefC, { title: `${T}Atelier ouvert : bonnes pratiques de prévision`, agenda: 'Partage d’expériences, ouvert à tous.', startAt: iso(4, 15), endAt: iso(4, 16, 30), participantIds: [u.agent5!.id, u.agent1!.id], isOpen: true });
      // Cette semaine, par une cheffe de section.
      const chefS1 = await acteur(prisma, u.chefSection1!.id);
      await svc.create(chefS1, { title: `${T}Point hebdomadaire de la Section Analyses`, startAt: iso(1, 10), endAt: iso(1, 11), participantIds: [u.agent1!.id, u.agent2!.id] });
    },
  );
}

async function conges(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const svc = app.get(LeaveRequestsService);
  await bloc(
    'Congés (annuel approuvé, en attente, rejeté, maladie masqué pour la Direction)',
    async () => (await prisma.leaveRequest.count({ where: { userId: { in: [u.agent1!.id, u.agent2!.id, u.agent3!.id, u.agent4!.id, u.agent5!.id] } } })) > 0,
    async () => {
      const type = async (code: string, nom: string) => {
        const t = await prisma.leaveType.findUnique({ where: { code } });
        if (t) return t;
        const n = await prisma.leaveType.create({ data: { code, name: `${T}${nom}` } });
        cree(`Type de congé ${code} « ${n.name} » (absent de la base)`);
        return n;
      };
      const annuel = await type('CONGE_ANNUEL', 'Congé annuel');
      const maladie = await type('CONGE_MALADIE', 'Congé maladie');
      const a = async (k: Cle) => acteur(prisma, u[k]!.id);
      const l1 = await svc.create(await a('agent1'), { leaveTypeId: annuel.id, startDate: dateSeule(20), endDate: dateSeule(34), reason: 'Congé annuel' });
      // Circuit N3 : avis du chef d'unité, puis décision du DRH (compte technique de la démonstration).
      await svc.donnerAvis(await a('chefSection1'), l1.id, { avis: 'FAVORABLE' });
      await svc.approve(await a('systeme'), l1.id, { comment: 'Bon repos.' });
      await svc.create(await a('agent2'), { leaveTypeId: annuel.id, startDate: dateSeule(40), endDate: dateSeule(47), reason: 'Congé annuel' });
      const l3 = await svc.create(await a('agent3'), { leaveTypeId: annuel.id, startDate: dateSeule(6), endDate: dateSeule(9) });
      await svc.donnerAvis(await a('chefSection2'), l3.id, { avis: 'DEFAVORABLE', motif: 'Période de clôture du TOFE.' });
      await svc.reject(await a('systeme'), l3.id, { comment: 'Période de clôture du TOFE : merci de décaler d’une semaine.' });
      // En attente d'avis : le motif médical n'est visible que de l'agent et du DRH.
      await svc.create(await a('agent4'), { leaveTypeId: maladie.id, startDate: dateSeule(0), endDate: dateSeule(3), reason: 'Arrêt maladie' });
      await svc.create(await a('agent5'), { leaveTypeId: annuel.id, startDate: dateSeule(14), endDate: dateSeule(18) });
    },
  );
}

async function communication(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  await bloc(
    'Annonces (2), sondage avec votes, messages',
    async () => (await prisma.announcement.count({ where: { authorId: u.chefDivision!.id, title: { startsWith: T } } })) > 0,
    async () => {
      const ann = app.get(AnnouncementsService);
      const chefD = await acteur(prisma, u.chefDivision!.id);
      await ann.create(chefD, { title: `${T}Séminaire de validation du cadrage`, body: 'Le séminaire se tiendra dans dix jours en salle principale. Merci de confirmer votre présence dans le module Réunions.', scope: AnnouncementScope.DIVISION, divisionId: ctx.division.id });
      const chefC = await acteur(prisma, u.chefCellule!.id);
      await ann.create(chefC, { title: `${T}Nouvelle procédure de sauvegarde des données`, body: 'À partir de lundi, les fichiers de travail sont déposés dans l’espace documentaire de la cellule, et non plus sur les postes.', scope: AnnouncementScope.CELLULE, celluleId: ctx.cellule.id });
      const polls = app.get(PollsService);
      const p = await polls.create(chefD, { question: `${T}Quel créneau pour la formation aux outils de prévision ?`, options: ['Mardi matin', 'Jeudi après-midi', 'Vendredi matin'], scope: AnnouncementScope.DIVISION, divisionId: ctx.division.id, closesAt: iso(7, 18) });
      const options = await prisma.pollOption.findMany({ where: { pollId: p.id }, orderBy: { id: 'asc' } });
      const choix: [Cle, number][] = [['agent1', 0], ['agent2', 1], ['agent3', 0], ['agent4', 2], ['chefSection1', 0], ['chefSection2', 1]];
      for (const [k, i] of choix) await polls.vote(await acteur(prisma, u[k]!.id), p.id, { optionIds: [options[i]!.id] });
      const msg = app.get(MessagesService);
      const echanges: [Cle, Cle, string][] = [
        ['chefSection1', 'agent1', 'Bonjour Alpha, peux-tu m’envoyer la dernière version des projections avant jeudi ?'],
        ['agent1', 'chefSection1', 'Bonjour, oui, je la dépose demain matin dans l’espace documentaire.'],
        ['agent3', 'agent4', 'Tu as les chiffres des exportations de juillet ?'],
        ['agent4', 'agent3', 'Oui, je te les transmets cet après-midi.'],
        ['chefDivision', 'chefCellule', 'Pouvons-nous caler un point sur l’enquête de conjoncture la semaine prochaine ?'],
      ];
      for (const [de, a, texte] of echanges) await msg.send(await acteur(prisma, u[de]!.id), { recipientId: u[a]!.id, body: texte });
    },
  );
  await bloc(
    'Suggestions (2, dont une anonyme)',
    async () => (await prisma.suggestion.count({ where: { content: { startsWith: T } } })) > 0,
    async () => {
      const sug = app.get(SuggestionsService);
      await sug.create(await acteur(prisma, u.agent2!.id), { content: `${T}Mettre en place une bibliothèque partagée des séries statistiques de référence.` });
      await sug.create(await acteur(prisma, u.agent5!.id), { content: `${T}Organiser une formation trimestrielle aux logiciels d’économétrie.`, isAnonymous: true });
    },
  );
}

async function documents(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const svc = app.get(DocumentsService);
  // Métadonnées obligatoires (N4) : type, période couverte ; la note de conjoncture publiée est validée.
  const meta = (typeDocument: TypeDocument, debut: number, fin: number) => ({ typeDocument, periodeDebut: dateSeule(debut), periodeFin: dateSeule(fin) });
  await bloc(
    'Documents GED (privé, final, publié et validé)',
    async () => (await prisma.document.count({ where: { divisionId: ctx.division.id, title: { startsWith: T } } })) > 0,
    async () => {
      const a1 = await acteur(prisma, u.agent1!.id);
      await svc.create(a1, { title: `${T}Projections du PIB — version de travail`, category: DocumentCategory.ETUDE, divisionId: ctx.division.id, ...meta(TypeDocument.ETUDE, -90, 0) }, fichier('projections.pdf'));
      const d2 = await svc.create(await acteur(prisma, u.agent3!.id), { title: `${T}Note sur l’exécution budgétaire`, category: DocumentCategory.NOTE_TECHNIQUE, divisionId: ctx.division.id, ...meta(TypeDocument.NOTE_TECHNIQUE, -60, -30) }, fichier('execution.pdf'));
      await svc.markFinal(await acteur(prisma, u.agent3!.id), d2.id);
      const d3 = await svc.create(await acteur(prisma, u.chefSection1!.id), { title: `${T}Note de conjoncture — deuxième trimestre`, category: DocumentCategory.RAPPORT, divisionId: ctx.division.id, ...meta(TypeDocument.NOTE_CONJONCTURE, -180, -90) }, fichier('conjoncture.pdf'));
      await svc.markFinal(await acteur(prisma, u.chefSection1!.id), d3.id);
      const chef = await acteur(prisma, u.chefDivision!.id);
      await svc.publish(chef, d3.id);
      await svc.changerStatut(chef, d3.id, { vers: StatutDiffusion.VALIDE });
    },
  );
  await bloc(
    'Document de la cellule (N4 : validé par la cheffe de cellule)',
    async () => (await prisma.document.count({ where: { celluleId: ctx.cellule.id, title: { startsWith: T } } })) > 0,
    async () => {
      const chefC = await acteur(prisma, u.chefCellule!.id);
      const d = await svc.create(chefC, { title: `${T}Procédure de sauvegarde des données de la cellule`, category: DocumentCategory.NOTE_TECHNIQUE, celluleId: ctx.cellule.id, ...meta(TypeDocument.NOTE_TECHNIQUE, -30, 0) }, fichier('procedure.pdf'));
      await svc.markFinal(chefC, d.id);
      await svc.changerStatut(chefC, d.id, { vers: StatutDiffusion.VALIDE });
    },
  );
  await bloc(
    'Ordre de mission (N4 : à préparer en acte par le chef de division)',
    async () => (await prisma.ordreMission.count({ where: { agentId: u.agent1!.id } })) > 0,
    async () => {
      await app.get(GenerateurService).creerOrdre(await acteur(prisma, u.chefDivision!.id), {
        agentId: u.agent1!.id,
        objet: `${T}Collecte des données de conjoncture auprès des services régionaux`,
        destination: 'Kankan',
        dateDepart: dateSeule(10),
        dateRetour: dateSeule(14),
        transport: 'Véhicule de service',
        fraisMontant: 1500000,
      });
    },
  );
}

async function pilotage(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  await bloc(
    'Plan de travail (N5 : objectif de la division, 2 activités, tâches rattachées) et fil de discussion',
    async () => (await prisma.objectif.count({ where: { creeParId: u.chefDivision!.id, libelle: { startsWith: T } } })) > 0,
    async () => {
      const plan = app.get(PlanTravailService);
      const tasks = app.get(TasksService);
      const unite = await prisma.uniteOrganisationnelle.findFirstOrThrow({ where: { divisionId: ctx.division.id, sectionId: null, celluleId: null } });
      const chefD = await acteur(prisma, u.chefDivision!.id);
      const annee = new Date().getUTCFullYear();
      const o = await plan.creerObjectif(chefD, { annee, uniteId: unite.id, libelle: `${T}Produire les notes de conjoncture de l’année`, description: 'Une note par trimestre, validée par la Direction.' });
      const a1 = await plan.creerActivite(chefD, o.id, { libelle: `${T}Note de conjoncture du troisième trimestre`, responsableId: u.chefSection1!.id, dateDebut: dateSeule(-20), dateFin: dateSeule(15), indicateur: 'Note validée', cible: '1 note' });
      await plan.creerActivite(chefD, o.id, { libelle: `${T}Enquête auprès des entreprises`, responsableId: u.agent3!.id, dateDebut: dateSeule(5), dateFin: dateSeule(60), indicateur: 'Questionnaires collectés', cible: '120' });
      const chefS1 = await acteur(prisma, u.chefSection1!.id);
      const t1 = await tasks.create(chefS1, { title: `${T}Collecte des indicateurs du trimestre`, priority: TaskPriority.NORMAL, dueDate: iso(6, 17), divisionId: ctx.division.id, sectionId: ctx.s1.id, activiteId: a1.id, assignees: [{ userId: u.agent1!.id }] } as never);
      await tasks.create(chefS1, { title: `${T}Rédaction de la note de conjoncture`, priority: TaskPriority.NORMAL, dueDate: iso(12, 17), divisionId: ctx.division.id, sectionId: ctx.s1.id, activiteId: a1.id, assignees: [{ userId: u.agent2!.id }] } as never);
      const fils = app.get(FilsService);
      const fil = await fils.creer(chefS1, { objet: `${T}Préparation de la note de conjoncture`, destinataires: [u.agent1!.id, u.agent2!.id], corps: 'Bonjour à tous, voici la tâche de collecte : merci de compléter les indicateurs avant vendredi.', lien: { type: 'TACHE', id: t1.id } });
      await fils.repondre(await acteur(prisma, u.agent1!.id), fil.id, { corps: 'Bien reçu, je m’en occupe dès aujourd’hui.' });
    },
  );
}

async function suppleance(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  await bloc(
    'Suppléance en cours (Cheffe de la Section Analyses suppléée par le Chef de la Section Synthèses)',
    async () => (await prisma.suppleance.count({ where: { titulaireId: u.chefSection1!.id, revokedAt: null } })) > 0,
    async () => {
      await app.get(SuppleancesService).create(await acteur(prisma, u.chefDivision!.id), { titulaireId: u.chefSection1!.id, suppleantId: u.chefSection2!.id, startDate: dateSeule(0), endDate: dateSeule(5) });
    },
  );
}

async function dossiers(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const svc = app.get(PersonnelFilesService);
  await bloc(
    'Dossiers du personnel (partiels)',
    async () => (await prisma.personnelFileBasic.count({ where: { userId: { in: [u.agent1!.id, u.agent3!.id] } } })) > 0,
    async () => {
      const drh = await acteur(prisma, u.systeme!.id);
      const fiches: [Cle, string, string, number][] = [
        ['agent1', 'A2', '3', 6],
        ['agent2', 'A1', '5', 11],
        ['agent3', 'A2', '1', 3],
        ['chefSection1', 'A1', '7', 14],
      ];
      for (const [k, grade, echelon, ans] of fiches) {
        await svc.updateBasic(drh, u[k]!.id, { employmentStatus: 'FONCTIONNAIRE', grade, echelon, serviceStartDate: dateSeule(-ans * 365) } as never);
      }
      await svc.addDiploma(drh, u.agent1!.id, { title: 'Master en économie appliquée', institution: 'Université Gamal Abdel Nasser de Conakry', obtainedYear: 2018 });
      await svc.updateSensitive(drh, u.agent1!.id, { emergencyContactName: 'Contact fictif', emergencyContactRelation: 'Famille', emergencyContactPhone: '+224 600 00 00 00' });
    },
  );
}

async function courrier(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const chefD = await acteur(prisma, u.chefDivision!.id);
  const uniteDiv = `DIV:${ctx.division.id}`;
  const registre = async (code: string, libelle: string, nature: RegistreNature) => {
    const r = await prisma.registreCourrier.findUnique({ where: { code } });
    if (r) {
      if (!r.isActive) await prisma.registreCourrier.update({ where: { id: r.id }, data: { isActive: true } });
      present(`Registre ${code}`);
      return r;
    }
    const n = await prisma.registreCourrier.create({ data: { code, libelle: `${T}${libelle}`, nature, portee: RegistrePortee.UNITE, gabaritNumero: '{seq:4}/TEST/{annee}' } });
    cree(`Registre ${code} « ${n.libelle} » (portée unité)`);
    return n;
  };
  const arr = await registre('TEST-ARR', 'Courrier arrivée', RegistreNature.ARRIVEE);
  const dep = await registre('TEST-DEP', 'Courrier départ et actes', RegistreNature.DEPART);
  for (const r of [arr, dep]) {
    const h = await prisma.habilitationCourrier.findFirst({ where: { userId: u.secretariat!.id, registreId: r.id, revoqueeAt: null } });
    if (h) present(`Habilitation du secrétariat au registre ${r.code}`);
    else {
      await prisma.habilitationCourrier.create({ data: { userId: u.secretariat!.id, registreId: r.id, uniteKey: uniteDiv, accordeeParId: u.chefDivision!.id } });
      cree(`Habilitation du secrétariat au registre ${r.code}`);
    }
  }
  await bloc(
    'Courrier : arrivées imputées, un acte en visa, un acte signé',
    async () => (await prisma.courrierArrivee.count({ where: { registreId: arr.id, statut: { not: ArriveeStatut.ANNULE } } })) > 0,
    async () => {
      const arrivees = app.get(ArriveesService);
      const imp = app.get(ImputationsService);
      const sec = await acteur(prisma, u.secretariat!.id);
      const entrees: [string, string, number][] = [
        ['Banque centrale — note de politique monétaire', 'Transmission de la note trimestrielle de politique monétaire.', -4],
        ['Ministère du Plan — demande de contribution', 'Demande de contribution au rapport sur les objectifs de développement.', -2],
        ['Institut national de la statistique — indices des prix', 'Envoi des indices des prix à la consommation du mois.', -1],
        ['Partenaire technique — invitation à un atelier', 'Invitation à un atelier régional sur la modélisation.', 0],
      ];
      const creees = [];
      for (const [exp, objet, n] of entrees) {
        const r = await arrivees.enregistrer(sec, { registreId: arr.id, uniteKey: uniteDiv, dateReception: iso(n, 10), expediteur: `${T}${exp}`, objet, confidentialite: CourrierConfidentialite.ORDINAIRE } as never, []);
        creees.push(r as { id: string });
      }
      await imp.imputer(chefD, creees[0]!.id, { imputeAId: u.chefSection1!.id, nature: ImputationNature.ATTRIBUTION, instructions: 'Préparer une réponse.', echeance: iso(6, 17) });
      await imp.imputer(chefD, creees[1]!.id, { imputeAId: u.chefSection2!.id, nature: ImputationNature.ATTRIBUTION, instructions: 'Rassembler les contributions des sections.', echeance: iso(10, 17) });
      await imp.imputer(chefD, creees[2]!.id, { imputeAId: u.agent2!.id, nature: ImputationNature.INFORMATION });
      // Acte en visa : rédigé par un agent, soumis (circuit : sa cheffe de section).
      const actes = app.get(ActesService);
      const a2 = await acteur(prisma, u.agent2!.id);
      const enVisa = await actes.creer(a2, { registreId: dep.id, objet: `${T}Réponse à la Banque centrale`, destinataires: 'Banque centrale', corps: 'Nous accusons réception de votre note…', confidentialite: CourrierConfidentialite.ORDINAIRE } as never);
      await actes.soumettre(a2, (enVisa as { id: string }).id);
      // Acte signé : rédigé par une cheffe de section, visé, signé par le chef de division (numéroté), expédié.
      const cs2 = await acteur(prisma, u.chefSection2!.id);
      const signe = (await actes.creer(cs2, { registreId: dep.id, objet: `${T}Transmission de la contribution au Ministère du Plan`, destinataires: 'Ministère du Plan', confidentialite: CourrierConfidentialite.ORDINAIRE } as never)) as { id: string };
      await actes.soumettre(cs2, signe.id);
      await actes.signer(chefD, signe.id);
      await actes.expedier(await acteur(prisma, u.secretariat!.id), signe.id, { modeExpedition: 'Porteur' });
    },
  );
}

async function stage(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const svc = app.get(StagesService);
  await bloc(
    'Stage avec plan de rotation (2 périodes), évaluation visée et encadreur principal',
    async () => (await prisma.stage.count({ where: { stagiaireId: u.stagiaire!.id } })) > 0,
    async () => {
      const drh = await acteur(prisma, u.systeme!.id);
      const s = (await svc.creer(drh, { stagiaireId: u.stagiaire!.id, etablissement: `${T}Université de Conakry`, diplomePrepare: 'Master en économie', encadrantAcademique: 'Pr Fictif', dateDebut: dateSeule(1), dateFin: dateSeule(60) })) as { id: string };
      await svc.ajouterPeriode(drh, s.id, { divisionId: ctx.division.id, sectionId: ctx.s1.id, dateDebut: dateSeule(1), dateFin: dateSeule(30), formatEvaluation: EvaluationFormat.GRILLE, objectifs: 'Découvrir la chaîne de prévision macroéconomique.' });
      await svc.ajouterPeriode(drh, s.id, { celluleId: ctx.cellule.id, dateDebut: dateSeule(31), dateFin: dateSeule(60), formatEvaluation: EvaluationFormat.TEXTE, objectifs: 'Participer à l’enquête de conjoncture.' });
      const toutes = await prisma.periodeStage.findMany({ where: { stageId: s.id }, orderBy: { dateDebut: 'asc' } });
      await svc.accepter(await acteur(prisma, u.chefSection1!.id), s.id, toutes[0]!.id, u.agent1!.id);
      await svc.accepter(await acteur(prisma, u.chefCellule!.id), s.id, toutes[1]!.id, u.agent5!.id);
      // Le stage a commencé il y a trois semaines : dates ramenées dans le passé puis rotation du jour.
      await prisma.stage.update({ where: { id: s.id }, data: { dateDebut: jour(-21, 0), dateFin: jour(38, 0) } });
      await prisma.periodeStage.update({ where: { id: toutes[0]!.id }, data: { dateDebut: jour(-21, 0), dateFin: jour(8, 0) } });
      await prisma.periodeStage.update({ where: { id: toutes[1]!.id }, data: { dateDebut: jour(9, 0), dateFin: jour(38, 0) } });
      await app.get(StagesRotationService).executer(new Date());
      // Évaluation de la première période : rédigée par le tuteur, visée par la cheffe de section.
      const tuteur = await acteur(prisma, u.agent1!.id);
      await svc.enregistrerEvaluation(tuteur, s.id, toutes[0]!.id, { criteres: { assiduite: 'TRES_SATISFAISANT', qualite: 'SATISFAISANT', autonomie: 'SATISFAISANT', integration: 'TRES_SATISFAISANT' }, appreciation: 'Stagiaire rigoureux et curieux, bonne maîtrise des outils.' });
      await svc.soumettreEvaluation(tuteur, s.id, toutes[0]!.id);
      await svc.viserEvaluation(await acteur(prisma, u.chefSection1!.id), s.id, toutes[0]!.id);
      // Encadreur principal (N3) : le premier tuteur ; aucun rapport déposé (la démonstration n'écrit jamais dans le stockage).
      await svc.designerEncadrant(drh, s.id, u.agent1!.id);
    },
  );
}

async function logistique(ctx: Ctx) {
  const { prisma, app, u } = ctx;
  const gest = app.get(GestionnairesLogistiqueService);
  if (await gest.estGestionnaire({ id: u.logistique!.id })) present('Habilitation « gestionnaire logistique »');
  else {
    await prisma.habilitationLogistique.create({ data: { userId: u.logistique!.id, accordeeParId: u.chefCellule!.id } });
    cree('Habilitation « gestionnaire logistique »');
  }
  const categorie = async (code: string, libelle: string, nature: NatureCategorieLogistique, validationChefRequise: boolean) => {
    const c = await prisma.categorieLogistique.findUnique({ where: { code } });
    if (c) {
      if (!c.actif) await prisma.categorieLogistique.update({ where: { id: c.id }, data: { actif: true } });
      present(`Catégorie ${code}`);
      return c;
    }
    const n = await prisma.categorieLogistique.create({ data: { code, libelle: `${T}${libelle}`, nature, validationChefRequise } });
    cree(`Catégorie ${code} « ${n.libelle} »`);
    return n;
  };
  const tst = await categorie('TST', 'Matériel de démonstration', NatureCategorieLogistique.BIEN, true);
  const tsf = await categorie('TSF', 'Fournitures de démonstration', NatureCategorieLogistique.FOURNITURE, false);
  const ressource = async (id: string, nom: string, type: TypeRessource, mode: ModeReservation) => {
    const r = await prisma.ressourceReservable.findUnique({ where: { id } });
    if (r) {
      if (!r.actif) await prisma.ressourceReservable.update({ where: { id }, data: { actif: true } });
      present(`Ressource « ${r.nom} »`);
      return r;
    }
    const n = await prisma.ressourceReservable.create({ data: { id, nom: `${T}${nom}`, type, mode, capacite: type === TypeRessource.SALLE ? 20 : null, description: 'Ressource de démonstration.' } });
    cree(`Ressource « ${n.nom} »`);
    return n;
  };
  await ressource('demo-ressource-salle', 'Salle de réunion démo', TypeRessource.SALLE, ModeReservation.IMMEDIATE);
  const projecteur = await ressource('demo-ressource-projecteur', 'Vidéoprojecteur démo', TypeRessource.MATERIEL_PRESENTATION, ModeReservation.VALIDATION);
  const art = async (id: string, libelle: string, suiviStock: boolean) => {
    const a = await prisma.articleFourniture.findUnique({ where: { id } });
    if (a) {
      if (!a.actif) await prisma.articleFourniture.update({ where: { id }, data: { actif: true } });
      present(`Article « ${a.libelle} »`);
      return a;
    }
    const n = await prisma.articleFourniture.create({ data: { id, categorieId: tsf.id, libelle: `${T}${libelle}`, unite: 'unité', suiviStock, stock: 0, seuilAlerte: suiviStock ? 3 : null } });
    cree(`Article « ${n.libelle} »`);
    return n;
  };
  const ramette = await art('demo-article-ramette', 'Ramette de papier', true);
  const classeur = await art('demo-article-classeur', 'Classeurs', false);
  const gestionnaire = await acteur(prisma, u.logistique!.id);
  await bloc(
    'Logistique : biens inventoriés et affectés, demandes, stock, réservations',
    async () => (await prisma.bien.count({ where: { categorieId: tst.id, etat: { not: EtatBien.REFORME } } })) > 0,
    async () => {
      const inv = app.get(InventaireService);
      const biens: [string, string, Cle | null][] = [
        ['Ordinateur portable', 'Dell Latitude', 'agent1'],
        ['Ordinateur portable', 'HP ProBook', 'agent3'],
        ['Imprimante multifonction', 'Canon', 'secretariat'],
      ];
      for (const [designation, marque, k] of biens) {
        const b = (await inv.creer(gestionnaire, { categorieId: tst.id, designation: `${T}${designation}`, marque, emplacement: 'Bureau de la Division Démo' } as never)) as { id: string };
        await inv.affecter(gestionnaire, b.id, k ? { userId: u[k]!.id } : { divisionId: ctx.division.id });
      }
      const ref = app.get(ReferentielLogistiqueService);
      await ref.mouvement(gestionnaire, ramette.id, { type: TypeMouvementStock.ENTREE, quantite: 20, motif: 'Approvisionnement initial' } as never);
      const dem = app.get(DemandesLogistiqueService);
      const a2 = await acteur(prisma, u.agent2!.id);
      await dem.creer(a2, { type: TypeDemandeLogistique.FOURNITURE, articleId: classeur.id, quantite: 5, objet: `${T}Classeurs pour l’archivage des notes` } as never);
      await dem.creer(await acteur(prisma, u.agent4!.id), { type: TypeDemandeLogistique.MATERIEL, categorieId: tst.id, objet: `${T}Écran supplémentaire`, justification: 'Travail sur plusieurs séries en parallèle.' } as never);
      const d3 = (await dem.creer(await acteur(prisma, u.agent5!.id), { type: TypeDemandeLogistique.FOURNITURE, articleId: classeur.id, quantite: 2, objet: `${T}Classeurs pour l’enquête` } as never)) as { id: string };
      await dem.prendreEnCharge(gestionnaire, d3.id);
      await dem.traiter(gestionnaire, d3.id, { compteRendu: 'Remis en main propre.' });
      const res = app.get(ReservationsService);
      await res.reserver(await acteur(prisma, u.agent3!.id), { ressourceId: projecteur.id, debut: iso(3, 14), fin: iso(3, 16), objet: `${T}Présentation au comité budgétaire` });
      await res.reserver(await acteur(prisma, u.chefSection2!.id), { ressourceId: 'demo-ressource-salle', debut: iso(2, 9), fin: iso(2, 10), objet: `${T}Réunion de section` });
    },
  );
}

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------
async function supprimer(prisma: PrismaClient) {
  const demo = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAINE_DEMO}` } }, select: { id: true, email: true, status: true } });
  const U = demo.map((d) => d.id);
  const systeme = demo.find((d) => d.email === email(COMPTE_SYSTEME.local))?.id ?? U[0] ?? '';
  const division = await prisma.division.findUnique({ where: { code: 'TESTDEMO' } });
  const cellule = await prisma.cellule.findUnique({ where: { code: 'TESTCEL' } });
  const n = (quoi: string, c: { count: number }) => c.count > 0 && supprime(`${quoi} : ${c.count}`);

  // Réservations (jamais supprimées : règle de la base) → annulées.
  const resa = await prisma.reservation.updateMany({
    where: { OR: [{ titulaireId: { in: U } }, { ressourceId: { in: ['demo-ressource-salle', 'demo-ressource-projecteur'] } }], statut: { in: [StatutReservation.CONFIRMEE, StatutReservation.EN_ATTENTE] } },
    data: { statut: StatutReservation.ANNULEE, annuleeAt: new Date(), motifAnnulation: 'Fin de la démonstration' },
  });
  if (resa.count) conserve(`Réservations de démonstration : ${resa.count}`, 'annulées (une réservation ne se supprime jamais)');

  // Tâches (sous-tâches, assignations, commentaires, pièces : suppression en cascade).
  n('Sous-tâches', await prisma.task.deleteMany({ where: { createdById: { in: U }, parentTaskId: { not: null } } }));
  n('Tâches', await prisma.task.deleteMany({ where: { createdById: { in: U } } }));
  // Socle N5 : plan de travail (activités : cascade), fils de discussion, préférences, instructions.
  n('Objectifs du plan de travail', await prisma.objectif.deleteMany({ where: { OR: [{ creeParId: { in: U } }, ...(division ? [{ unite: { divisionId: division.id } }] : [])] } }));
  n('Activités (responsable de démonstration)', await prisma.activite.deleteMany({ where: { responsableId: { in: U } } }));
  // Fils ouverts par un compte de démonstration (messages, participants, lectures : cascade).
  n('Fils de discussion', await prisma.filMessages.deleteMany({ where: { creeParId: { in: U } } }));
  await prisma.preferenceNotification.deleteMany({ where: { userId: { in: U } } });
  n('Instructions', await prisma.instruction.deleteMany({ where: { OR: [{ emetteurId: { in: U } }, { destinataireId: { in: U } }, { agentConcerneId: { in: U } }] } }));
  // Réunions (participants, décisions : cascade).
  n('Réunions', await prisma.meeting.deleteMany({ where: { createdById: { in: U } } }));
  // Congés et soldes.
  n('Demandes de congé', await prisma.leaveRequest.deleteMany({ where: { userId: { in: U } } }));
  await prisma.leaveBalance.deleteMany({ where: { userId: { in: U } } });
  for (const code of ['CONGE_ANNUEL', 'CONGE_MALADIE']) {
    const t = await prisma.leaveType.findUnique({ where: { code } });
    if (t && t.name.startsWith(T)) {
      const utilise = (await prisma.leaveRequest.count({ where: { leaveTypeId: t.id } })) + (await prisma.leaveBalance.count({ where: { leaveTypeId: t.id } }));
      if (utilise === 0) {
        await prisma.leaveType.delete({ where: { id: t.id } });
        supprime(`Type de congé ${code} créé pour la démonstration`);
      } else conserve(`Type de congé ${code}`, `utilisé par ${utilise} demande(s) réelle(s)`);
    }
  }
  // Communication.
  n('Annonces', await prisma.announcement.deleteMany({ where: { authorId: { in: U } } }));
  n('Sondages', await prisma.poll.deleteMany({ where: { authorId: { in: U } } }));
  n('Suggestions', await prisma.suggestion.deleteMany({ where: { OR: [{ authorId: { in: U } }, { content: { startsWith: T } }] } }));
  n('Messages', await prisma.directMessage.deleteMany({ where: { OR: [{ senderId: { in: U } }, { recipientId: { in: U } }] } }));
  n('Notifications', await prisma.notification.deleteMany({ where: { userId: { in: U } } }));
  // GED.
  const docs = await prisma.document.findMany({ where: { OR: [{ createdById: { in: U } }, ...(division ? [{ divisionId: division.id }] : [])] }, select: { id: true } });
  await prisma.document.updateMany({ where: { id: { in: docs.map((d) => d.id) } }, data: { currentVersionId: null } });
  await prisma.documentVersion.deleteMany({ where: { documentId: { in: docs.map((d) => d.id) } } });
  await prisma.changementStatut.deleteMany({ where: { objetType: 'Document', objetId: { in: docs.map((d) => d.id) } } });
  n('Documents', await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } }));
  // Documents générés (N4) : ordres de mission et attestations de travail des comptes de démonstration.
  const ordres = await prisma.ordreMission.findMany({ where: { OR: [{ agentId: { in: U } }, { creeParId: { in: U } }] }, select: { id: true } });
  const attestations = await prisma.attestationTravail.findMany({ where: { OR: [{ agentId: { in: U } }, { creeParId: { in: U } }] }, select: { id: true } });
  await prisma.documentGenere.deleteMany({ where: { objetId: { in: [...ordres, ...attestations].map((o) => o.id) } } });
  n('Ordres de mission', await prisma.ordreMission.deleteMany({ where: { id: { in: ordres.map((o) => o.id) } } }));
  n('Attestations de travail', await prisma.attestationTravail.deleteMany({ where: { id: { in: attestations.map((o) => o.id) } } }));
  await prisma.folder.deleteMany({ where: { createdById: { in: U } } });
  // Suppléances (les accès délégués qui y renvoient perdent ce lien).
  n('Suppléances', await prisma.suppleance.deleteMany({ where: { OR: [{ titulaireId: { in: U } }, { suppleantId: { in: U } }, { createdById: { in: U } }] } }));
  // Dossiers du personnel.
  await prisma.personnelDiploma.deleteMany({ where: { userId: { in: U } } });
  await prisma.personnelDocument.deleteMany({ where: { userId: { in: U } } });
  await prisma.personnelCareerEvent.deleteMany({ where: { userId: { in: U } } });
  await prisma.personnelFileSensitive.deleteMany({ where: { userId: { in: U } } });
  n('Dossiers du personnel', await prisma.personnelFileBasic.deleteMany({ where: { userId: { in: U } } }));
  // Stages.
  const stages = await prisma.stage.findMany({ where: { stagiaireId: { in: U } }, select: { id: true } });
  const periodes = await prisma.periodeStage.findMany({ where: { stageId: { in: stages.map((s) => s.id) } }, select: { id: true } });
  await prisma.evaluationStage.deleteMany({ where: { periodeId: { in: periodes.map((p) => p.id) } } });
  await prisma.periodeStage.deleteMany({ where: { id: { in: periodes.map((p) => p.id) } } });
  n('Stages', await prisma.stage.deleteMany({ where: { id: { in: stages.map((s) => s.id) } } }));
  // Logistique : demandes supprimées ; biens réformés (jamais supprimés) ; stock et catégories désactivés.
  n('Demandes logistiques', await prisma.demandeLogistique.deleteMany({ where: { demandeurId: { in: U } } }));
  const tst = await prisma.categorieLogistique.findUnique({ where: { code: 'TST' } });
  if (tst) {
    const biens = await prisma.bien.findMany({ where: { categorieId: tst.id, etat: { not: EtatBien.REFORME } }, select: { id: true } });
    for (const b of biens) {
      const ouverte = await prisma.affectationBien.findFirst({ where: { bienId: b.id, fin: null } });
      if (ouverte) {
        await prisma.affectationBien.update({ where: { id: ouverte.id }, data: { fin: new Date() } });
        await prisma.mouvementBien.create({ data: { bienId: b.id, type: TypeMouvementBien.RETOUR, parId: systeme, detail: { motif: 'Fin de la démonstration' } } });
      }
      await prisma.bien.update({ where: { id: b.id }, data: { etat: EtatBien.REFORME } });
      await prisma.mouvementBien.create({ data: { bienId: b.id, type: TypeMouvementBien.CHANGEMENT_ETAT, parId: systeme, detail: { etat: EtatBien.REFORME, motif: 'Fin de la démonstration' } } });
    }
    const total = await prisma.bien.count({ where: { categorieId: tst.id } });
    if (total) conserve(`Biens inventoriés de démonstration (catégorie TST) : ${total}`, 'réformés (un bien inventorié ne se supprime jamais)');
  }
  const articles = await prisma.articleFourniture.updateMany({ where: { id: { in: ['demo-article-ramette', 'demo-article-classeur'] }, actif: true }, data: { actif: false } });
  if (articles.count) conserve(`Articles de démonstration : ${articles.count}`, 'désactivés (leurs mouvements de stock sont en ajout seul)');
  const cats = await prisma.categorieLogistique.updateMany({ where: { code: { in: ['TST', 'TSF'] }, actif: true }, data: { actif: false } });
  if (cats.count) conserve(`Catégories TST, TSF`, 'désactivées (biens réformés et articles y restent rattachés)');
  const ress = await prisma.ressourceReservable.updateMany({ where: { id: { in: ['demo-ressource-salle', 'demo-ressource-projecteur'] }, actif: true }, data: { actif: false } });
  if (ress.count) conserve(`Ressources de démonstration : ${ress.count}`, 'désactivées (leurs réservations annulées y restent rattachées)');
  n('Habilitations logistiques', await prisma.habilitationLogistique.deleteMany({ where: { userId: { in: U } } }));
  // Courrier : numéroté → annulé ; brouillons supprimés ; registres désactivés.
  const regs = await prisma.registreCourrier.findMany({ where: { code: { in: ['TEST-ARR', 'TEST-DEP'] } }, select: { id: true } });
  const R = regs.map((r) => r.id);
  if (R.length) {
    const brouillons = await prisma.acteCourrier.findMany({ where: { registreId: { in: R }, numero: null }, select: { id: true } });
    await prisma.imputationCourrier.updateMany({ where: { reponseActeId: { in: brouillons.map((b) => b.id) } }, data: { reponseActeId: null } });
    await prisma.visaActe.deleteMany({ where: { acteId: { in: brouillons.map((b) => b.id) } } });
    await prisma.pieceCourrier.deleteMany({ where: { acteId: { in: brouillons.map((b) => b.id) } } });
    n('Actes non numérotés (brouillons, en visa)', await prisma.acteCourrier.deleteMany({ where: { id: { in: brouillons.map((b) => b.id) } } }));
    await prisma.acteCourrier.updateMany({ where: { registreId: { in: R }, statut: { not: ActeStatut.ANNULE } }, data: { statut: ActeStatut.ANNULE, annuleAt: new Date(), motifAnnulation: 'Fin de la démonstration' } });
    await prisma.courrierArrivee.updateMany({ where: { registreId: { in: R }, statut: { not: ArriveeStatut.ANNULE } }, data: { statut: ArriveeStatut.ANNULE, annuleAt: new Date(), motifAnnulation: 'Fin de la démonstration' } });
    const totA = await prisma.courrierArrivee.count({ where: { registreId: { in: R } } });
    const totB = await prisma.acteCourrier.count({ where: { registreId: { in: R } } });
    if (totA) conserve(`Courriers arrivés TEST-ARR : ${totA}`, 'annulés (un courrier numéroté ne se supprime jamais)');
    if (totB) conserve(`Actes numérotés TEST-DEP : ${totB}`, 'annulés (un acte numéroté ne se supprime jamais)');
    await prisma.habilitationCourrier.deleteMany({ where: { registreId: { in: R } } });
    await prisma.registreCourrier.updateMany({ where: { id: { in: R } }, data: { isActive: false } });
    conserve('Registres TEST-ARR, TEST-DEP', 'désactivés (les courriers annulés y restent rattachés)');
  }
  n('Habilitations courrier', await prisma.habilitationCourrier.deleteMany({ where: { userId: { in: U } } }));
  // Socle N1 : rôles fonctionnels retirés (recréés par la reprise à la relance) ; agents « Parti »,
  // conservés comme les comptes (la reprise recrée un agent pour tout compte non en attente).
  n('Rôles fonctionnels', await prisma.attributionRole.deleteMany({ where: { userId: { in: U } } }));
  const partis = await prisma.agent.updateMany({
    where: { compte: { is: { id: { in: U } } }, statut: { not: StatutAgent.PARTI } },
    data: { statut: StatutAgent.PARTI, dateDepart: new Date(), motifDepart: 'Démonstration supprimée' },
  });
  if (partis.count) conserve(`Agents de démonstration : ${partis.count}`, 'passés « Parti » (dossier conservé, comme le compte)');
  // Comptes : SUPPRIME, sessions fermées, jetons retirés.
  await prisma.userSession.updateMany({ where: { userId: { in: U }, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: U } } });
  if (cellule) await prisma.cellule.update({ where: { id: cellule.id }, data: { chefId: null } });
  const c = await prisma.user.updateMany({ where: { id: { in: U }, status: { not: UserStatus.SUPPRIME } }, data: { status: UserStatus.SUPPRIME } });
  if (U.length) conserve(`Comptes de démonstration : ${U.length}${c.count < U.length ? ` (dont ${U.length - c.count} déjà supprimés)` : ''}`, 'passés en SUPPRIME (un compte ne se supprime jamais : journal d’audit, courrier et inventaire y renvoient)');
  // Unités : supprimées (sections comprises) si aucun compte réel n'y a été rattaché entre-temps ;
  // sinon désactivées. Le courrier annulé ne garde que la clé d'unité (texte), jamais un lien.
  if (division || cellule) {
    const cles = [division && `DIV:${division.id}`, cellule && `CEL:${cellule.id}`].filter((c): c is string => !!c);
    const sections = division ? await prisma.section.findMany({ where: { divisionId: division.id }, select: { id: true } }) : [];
    const surUnites = [...(division ? [{ divisionId: division.id }] : []), ...(cellule ? [{ celluleId: cellule.id }] : [])];
    const rattachesReels = await prisma.user.count({ where: { NOT: { email: { endsWith: `@${DOMAINE_DEMO}` } }, OR: surUnites } });
    // L'historique d'affectation d'un bien est figé (règle de la base) : une unité qui y figure ne peut pas disparaître.
    const affectations = await prisma.affectationBien.count({
      where: { OR: [...surUnites, ...(sections.length ? [{ sectionId: { in: sections.map((x) => x.id) } }] : [])] },
    });
    await prisma.capaciteAccueil.deleteMany({ where: { uniteKey: { in: [...cles, ...sections.map((x) => `SEC:${x.id}`)] } } });
    if (rattachesReels === 0 && affectations === 0) {
      // Socle N1 : unités miroir (et leur historique) retirées avant leurs unités d'origine.
      const miroirs = await prisma.uniteOrganisationnelle.findMany({
        where: { OR: [...(division ? [{ divisionId: division.id }] : []), ...(sections.length ? [{ sectionId: { in: sections.map((x) => x.id) } }] : []), ...(cellule ? [{ celluleId: cellule.id }] : [])] },
        select: { id: true },
      });
      await prisma.historiqueUnite.deleteMany({ where: { uniteId: { in: miroirs.map((m) => m.id) } } });
      await prisma.uniteOrganisationnelle.deleteMany({ where: { id: { in: miroirs.map((m) => m.id) } } });
      if (division) await prisma.division.delete({ where: { id: division.id } });
      if (cellule) await prisma.cellule.delete({ where: { id: cellule.id } });
      supprime('Unités « TEST — Division Démo » (2 sections) et « TEST — Cellule Démo »');
    } else {
      if (division) {
        await prisma.division.update({ where: { id: division.id }, data: { isActive: false } });
        await prisma.section.updateMany({ where: { divisionId: division.id }, data: { isActive: false } });
      }
      if (cellule) await prisma.cellule.update({ where: { id: cellule.id }, data: { isActive: false } });
      conserve(
        'Unités de démonstration',
        `désactivées : ${[rattachesReels ? `${rattachesReels} compte(s) réel(s) y sont rattaché(s) — à déplacer dans Organisation` : '', affectations ? `${affectations} affectation(s) de bien y renvoient (historique figé)` : ''].filter(Boolean).join(' ; ')}`,
      );
    }
  }
  conserve('Journal d’audit des actions de démonstration', 'conservé (traçabilité)');
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------
async function main() {
  const mode = (process.argv[2] || '').trim();
  if (mode !== 'creer' && mode !== 'supprimer') throw new Error('Mode attendu : « creer » ou « supprimer ».');
  const prisma = new PrismaClient();
  try {
    await verifierMigrations(prisma);
    if (mode === 'supprimer') {
      console.log('Suppression des données de démonstration.');
      await supprimer(prisma);
      await prisma.auditLog.create({ data: { actorId: null, action: AuditAction.SUPPRESSION, entityType: ENTITE_AUDIT_DEMO, entityId: 'suppression', metadata: { event: 'demo_supprimee', par: 'Système (script de démonstration)' } } });
    } else {
      const motDePasse = process.env.DEMO_PASSWORD || '';
      if (motDePasse.length < 10) throw new Error('Mot de passe de démonstration absent ou trop court (10 caractères au moins) : variable DEMO_PASSWORD.');
      console.log('Création des données de démonstration.');
      // Sans SMTP de production dans ce processus : les services n'envoient rien (garde supplémentaire).
      process.env.SMTP_HOST = '';
      const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
      try {
        // Garde-fous : notifications seulement vers les comptes de démonstration ; fichiers → PDF livré.
        const notif = app.get(NotificationsService);
        const original = notif.notify.bind(notif);
        const demoIds = new Set<string>();
        (notif as { notify: typeof notif.notify }).notify = async (userId, ...reste) => {
          if (demoIds.has(userId)) return original(userId, ...reste);
        };
        const storage = app.get(StorageService);
        (storage as { save: StorageService['save'] }).save = async (buffer: Buffer) => ({ fileKey: `${PREFIXE_INTEGRE}${FICHIER_DEMO}`, sizeBytes: buffer.length });

        await prisma.auditLog.create({ data: { actorId: null, action: AuditAction.CREATION, entityType: ENTITE_AUDIT_DEMO, entityId: 'creation', metadata: { event: 'demo_creee', par: 'Système (script de démonstration)', expireDansJours: DUREE_DEMO_JOURS } } });
        const base = { prisma, app, ...(await unites(prisma)) };
        const { u, directionReelle } = await comptes(base, motDePasse);
        for (const v of Object.values(u)) if (v && estAdresseDemo(v.email)) demoIds.add(v.id);
        await socle(prisma, app, [...demoIds]);
        const ctx: Ctx = { ...base, u, directionReelle };
        await logistique(ctx); // la salle de démonstration sert aux réunions
        await taches(ctx);
        await reunions(ctx);
        await conges(ctx);
        await communication(ctx);
        await documents(ctx);
        await pilotage(ctx);
        await suppleance(ctx);
        await dossiers(ctx);
        await courrier(ctx);
        await stage(ctx);
        console.log(
          directionReelle
            ? `\nVue Direction : compte RÉEL ${directionReelle.email} (${directionReelle.role}) — aucun DN de démonstration créé.`
            : `\nVue Direction : aucun DN/DNA réel actif — DN de démonstration ${email(COMPTE_DN.local)}.`,
        );
        console.log(`Les comptes de démonstration seront suspendus automatiquement dans ${DUREE_DEMO_JOURS} jours.`);
      } finally {
        await app.close();
      }
    }
    const etats = ['créé', 'déjà présent', 'supprimé', 'conservé'] as const;
    const titres: Record<(typeof etats)[number], string> = { créé: 'CRÉÉ', 'déjà présent': 'DÉJÀ PRÉSENT (non dupliqué)', supprimé: 'SUPPRIMÉ', conservé: 'CONSERVÉ (annulé, réformé ou désactivé)' };
    for (const e of etats) {
      const lignes = journal.filter((l) => l.etat === e);
      if (!lignes.length) continue;
      console.log(`\n${titres[e]} :`);
      for (const l of lignes) console.log(`  - ${l.quoi}${l.pourquoi ? ` — ${l.pourquoi}` : ''}`);
    }
    console.log(`\nBilan : ${journal.filter((l) => l.etat === 'créé').length} créé(s), ${journal.filter((l) => l.etat === 'déjà présent').length} déjà présent(s), ${journal.filter((l) => l.etat === 'supprimé').length} suppression(s), ${journal.filter((l) => l.etat === 'conservé').length} conservé(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`\nÉCHEC : ${e instanceof Error ? `${e.message}${(e as { response?: unknown }).response ? ` ${JSON.stringify((e as { response?: unknown }).response)}` : ''}` : String(e)}`);
  if (e instanceof Error && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exitCode = 1;
});

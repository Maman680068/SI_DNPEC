import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Journal d'audit en français (S9a) : chaque entrée devient une phrase « auteur + verbe + objet nommé ».
 * Table des libellés par `entityType` (objet générique, domaine, sensibilité) et résolution du nom de l'objet
 * côté API. BESOIN D'EN CONNAÎTRE : pour un objet protégé (courrier confidentiel, dossier ou certificat
 * médical, motif de congé, résultats de simulation…), libellé générique sans titre ni contenu, même pour
 * l'administrateur. Rien n'est jamais écrit dans le journal (lecture seule).
 */
export type Domaine = 'TACHES' | 'CONGES' | 'COURRIER' | 'DOCUMENTS' | 'REUNIONS' | 'RH' | 'STAGES' | 'LOGISTIQUE' | 'COMPTES' | 'SYSTEME' | 'MODELISATION' | 'ECHANGES' | 'DIRECTION';
export const LIBELLE_DOMAINE: Record<Domaine, string> = {
  TACHES: 'Tâches et plan de travail',
  CONGES: 'Congés',
  COURRIER: 'Courrier',
  DOCUMENTS: 'Documents',
  REUNIONS: 'Réunions',
  RH: 'Ressources humaines',
  STAGES: 'Stages',
  LOGISTIQUE: 'Logistique',
  COMPTES: 'Comptes et organisation',
  SYSTEME: 'Système',
  MODELISATION: 'Modélisation',
  ECHANGES: 'Échanges',
  DIRECTION: 'Direction',
};

/** objet : article + nom générique ; protege : jamais de titre (besoin d'en connaître). */
type Type = { objet: string; domaine: Domaine; protege?: boolean; sensible?: boolean; lien?: (id: string) => string | null };
export const TYPES: Record<string, Type> = {
  Task: { objet: 'la tâche', domaine: 'TACHES', lien: (id) => `/tasks/${id}` },
  TaskAttachment: { objet: 'une pièce jointe de tâche', domaine: 'TACHES' },
  Objectif: { objet: 'l’objectif', domaine: 'TACHES', lien: () => '/plan-travail' },
  Activite: { objet: 'l’activité', domaine: 'TACHES', lien: () => '/plan-travail' },
  FilMessages: { objet: 'le fil de discussion', domaine: 'ECHANGES' },
  LeaveRequest: { objet: 'une demande de congé', domaine: 'CONGES', protege: true },
  LeaveType: { objet: 'le type de congé', domaine: 'CONGES' },
  JourFerie: { objet: 'le jour férié', domaine: 'CONGES', lien: () => '/leaves?onglet=feries' },
  CourrierArrivee: { objet: 'le courrier', domaine: 'COURRIER' },
  ActeCourrier: { objet: 'l’acte', domaine: 'COURRIER' },
  ImputationCourrier: { objet: 'une imputation de courrier', domaine: 'COURRIER', protege: true },
  PieceCourrier: { objet: 'une pièce de courrier', domaine: 'COURRIER', protege: true },
  AccesDelegueCourrier: { objet: 'un accès délégué à un courrier', domaine: 'COURRIER', protege: true, sensible: true },
  RegistreCourrier: { objet: 'le registre', domaine: 'COURRIER', lien: () => '/courrier/administration' },
  HabilitationCourrier: { objet: 'une habilitation du secrétariat', domaine: 'COURRIER', sensible: true },
  CompteurRegistre: { objet: 'un compteur de registre', domaine: 'COURRIER', sensible: true },
  Document: { objet: 'le document', domaine: 'DOCUMENTS', lien: (id) => `/documents?id=${id}` },
  Folder: { objet: 'le dossier', domaine: 'DOCUMENTS' },
  DocumentGenere: { objet: 'un document généré', domaine: 'DOCUMENTS' },
  AttestationTravail: { objet: 'une attestation de travail', domaine: 'DOCUMENTS' },
  Announcement: { objet: 'l’annonce', domaine: 'ECHANGES' },
  Poll: { objet: 'le sondage', domaine: 'ECHANGES' },
  DirectMessage: { objet: 'une pièce jointe de message', domaine: 'ECHANGES', protege: true },
  Suggestion: { objet: 'une suggestion', domaine: 'ECHANGES' },
  Meeting: { objet: 'la réunion', domaine: 'REUNIONS', lien: (id) => `/reunions?id=${id}` },
  Decision: { objet: 'une décision de réunion', domaine: 'REUNIONS' },
  DemandeReunion: { objet: 'la demande de réunion', domaine: 'REUNIONS', lien: (id) => `/reunions?demande=${id}` },
  Instruction: { objet: 'une instruction de la Direction', domaine: 'DIRECTION', protege: true },
  Agent: { objet: 'l’agent', domaine: 'RH', lien: (id) => `/agents?id=${id}` },
  PersonnelFile: { objet: 'un dossier du personnel', domaine: 'RH', protege: true },
  DossierPersonnel: { objet: 'un dossier du personnel', domaine: 'RH', protege: true },
  PersonnelFileBasic: { objet: 'un dossier du personnel', domaine: 'RH', protege: true },
  PersonnelFileSensitive: { objet: 'la partie protégée d’un dossier du personnel', domaine: 'RH', protege: true, sensible: true },
  PersonnelDocument: { objet: 'une pièce d’un dossier du personnel', domaine: 'RH', protege: true, sensible: true },
  PersonnelDiploma: { objet: 'un diplôme d’un dossier du personnel', domaine: 'RH', protege: true },
  PersonnelFileErrorReport: { objet: 'un signalement d’erreur de dossier', domaine: 'RH', protege: true },
  PersonnelImport: { objet: 'un import du personnel', domaine: 'RH', sensible: true },
  CertificatMedical: { objet: 'un certificat médical', domaine: 'RH', protege: true, sensible: true },
  MouvementCarriere: { objet: 'un mouvement de carrière', domaine: 'RH', protege: true },
  FamilleActeRh: { objet: 'la famille d’actes', domaine: 'RH', lien: () => '/rh?onglet=carriere' },
  FichePoste: { objet: 'une fiche de poste', domaine: 'RH' },
  BesoinFormation: { objet: 'un besoin de formation', domaine: 'RH' },
  SessionFormation: { objet: 'une session de formation', domaine: 'RH' },
  PieceRequise: { objet: 'une pièce requise', domaine: 'RH' },
  Effectifs: { objet: 'les effectifs', domaine: 'RH' },
  ChangementRoleNomination: { objet: 'une nomination à appliquer', domaine: 'COMPTES', sensible: true },
  Stage: { objet: 'un stage', domaine: 'STAGES' },
  PeriodeStage: { objet: 'une période de stage', domaine: 'STAGES' },
  EvaluationStage: { objet: 'une évaluation de stage', domaine: 'STAGES', protege: true },
  CapaciteAccueil: { objet: 'une capacité d’accueil', domaine: 'STAGES' },
  ModeleAttestation: { objet: 'le modèle d’attestation de stage', domaine: 'STAGES' },
  DemandeLogistique: { objet: 'une demande logistique', domaine: 'LOGISTIQUE' },
  Reservation: { objet: 'une réservation', domaine: 'LOGISTIQUE' },
  Bien: { objet: 'un bien de l’inventaire', domaine: 'LOGISTIQUE' },
  ArticleFourniture: { objet: 'un article de fourniture', domaine: 'LOGISTIQUE' },
  Inventaire: { objet: 'l’inventaire', domaine: 'LOGISTIQUE' },
  Vehicule: { objet: 'un véhicule', domaine: 'LOGISTIQUE' },
  PleinCarburant: { objet: 'un plein de carburant', domaine: 'LOGISTIQUE' },
  RessourceReservable: { objet: 'une ressource réservable', domaine: 'LOGISTIQUE' },
  CategorieLogistique: { objet: 'une catégorie logistique', domaine: 'LOGISTIQUE' },
  HabilitationLogistique: { objet: 'une habilitation logistique', domaine: 'LOGISTIQUE', sensible: true },
  OrdreMission: { objet: 'un ordre de mission', domaine: 'LOGISTIQUE' },
  User: { objet: 'le compte', domaine: 'COMPTES', sensible: true },
  AttributionRole: { objet: 'un rôle fonctionnel', domaine: 'COMPTES', sensible: true },
  Suppleance: { objet: 'une suppléance', domaine: 'COMPTES', sensible: true },
  Division: { objet: 'la division', domaine: 'COMPTES', lien: () => '/organisation?onglet=divisions' },
  Section: { objet: 'la section', domaine: 'COMPTES', lien: () => '/organisation?onglet=divisions' },
  Cellule: { objet: 'la cellule', domaine: 'COMPTES', lien: () => '/organisation?onglet=cellules' },
  UniteOrganisationnelle: { objet: 'l’unité', domaine: 'COMPTES', lien: () => '/organisation' },
  Parametre: { objet: 'un paramètre', domaine: 'SYSTEME', sensible: true },
  Parametrage: { objet: 'le paramétrage initial', domaine: 'SYSTEME', sensible: true },
  SauvegardeFichiers: { objet: 'la sauvegarde des fichiers', domaine: 'SYSTEME', sensible: true },
  JournalAudit: { objet: 'le journal d’audit', domaine: 'SYSTEME', sensible: true },
  SocleN1: { objet: 'la reprise du socle', domaine: 'SYSTEME' },
  Modele: { objet: 'le modèle', domaine: 'MODELISATION', lien: (id) => `/modelisation/${id}` },
  VersionModele: { objet: 'une version de modèle', domaine: 'MODELISATION' },
  TravailCalcul: { objet: 'un calcul de simulation', domaine: 'MODELISATION', protege: true },
  AffectationModelisation: { objet: 'un rôle de modélisation', domaine: 'MODELISATION', sensible: true },
};
export const typeDe = (t: string): Type => TYPES[t] ?? { objet: `un élément (${t})`, domaine: 'SYSTEME' };

const VERBE: Record<AuditAction, string> = {
  CREATION: 'a créé',
  MODIFICATION: 'a modifié',
  SUPPRESSION: 'a supprimé',
  VALIDATION: 'a validé',
  REJET: 'a rejeté',
  PUBLICATION: 'a publié',
  CONNEXION: 's’est connecté(e)',
  DECONNEXION: 's’est déconnecté(e)',
};
/** Événements (metadata.event) au verbe propre. */
const VERBE_EVENEMENT: Record<string, string> = {
  acces_objet_protege: 'a consulté',
  telechargement_piece_jointe: 'a téléchargé',
  export: 'a exporté',
  duplicata: 'a édité un duplicata de',
  recalcul_jours_feries: 'a recalculé',
  transmise: 'a transmis',
  acceptee: 'a accepté',
  refusee: 'a refusé',
  demandee: 'a demandé',
  registre_attendu: 'a configuré le registre de',
  rattachement: 'a modifié le rattachement de',
  verification_audit: 'a vérifié',
  rappel_double_authentification: 'a envoyé un rappel de double authentification pour',
  invitation_renvoyee: 'a renvoyé l’invitation pour',
};
/** Événements toujours sensibles. */
export const EVENEMENTS_SENSIBLES = ['acces_objet_protege', 'export', 'duplicata', 'recalcul_jours_feries'];
export const verbe = (action: AuditAction, event: string | null) => (event && VERBE_EVENEMENT[event]) || VERBE[action];

/** Nom lisible de chaque objet non protégé (lecture groupée par type : une requête par type). */
export async function nommer(prisma: PrismaService, objets: { type: string; id: string }[]): Promise<Map<string, { nom: string | null; protege: boolean }>> {
  const res = new Map<string, { nom: string | null; protege: boolean }>();
  const parType = new Map<string, string[]>();
  for (const o of objets) parType.set(o.type, [...(parType.get(o.type) ?? []), o.id]);
  const poser = (type: string, l: { id: string; nom: string | null; protege?: boolean }[]) => l.forEach((x) => res.set(`${type}:${x.id}`, { nom: x.nom, protege: !!x.protege }));
  const charger: Record<string, (ids: string[]) => Promise<{ id: string; nom: string | null; protege?: boolean }[]>> = {
    Task: async (ids) => (await prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, confidentiality: true } })).map((x) => ({ id: x.id, nom: x.title, protege: x.confidentiality !== 'PUBLIC_INTERNE' })),
    Meeting: async (ids) => (await prisma.meeting.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })).map((x) => ({ id: x.id, nom: x.title })),
    Document: async (ids) => (await prisma.document.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })).map((x) => ({ id: x.id, nom: x.title })),
    User: async (ids) => (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((x) => ({ id: x.id, nom: `${x.firstName} ${x.lastName}` })),
    Agent: async (ids) => (await prisma.agent.findMany({ where: { id: { in: ids } }, select: { id: true, prenoms: true, nom: true } })).map((x) => ({ id: x.id, nom: `${x.prenoms} ${x.nom}` })),
    Division: async (ids) => (await prisma.division.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((x) => ({ id: x.id, nom: x.code })),
    Section: async (ids) => (await prisma.section.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((x) => ({ id: x.id, nom: x.code })),
    Cellule: async (ids) => (await prisma.cellule.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((x) => ({ id: x.id, nom: x.code })),
    UniteOrganisationnelle: async (ids) => (await prisma.uniteOrganisationnelle.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((x) => ({ id: x.id, nom: x.code })),
    RegistreCourrier: async (ids) => (await prisma.registreCourrier.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((x) => ({ id: x.id, nom: x.code })),
    JourFerie: async (ids) => (await prisma.jourFerie.findMany({ where: { id: { in: ids } }, select: { id: true, libelle: true } })).map((x) => ({ id: x.id, nom: x.libelle })),
    DemandeReunion: async (ids) => (await prisma.demandeReunion.findMany({ where: { id: { in: ids } }, select: { id: true, objet: true } })).map((x) => ({ id: x.id, nom: x.objet })),
    Objectif: async (ids) => (await prisma.objectif.findMany({ where: { id: { in: ids } }, select: { id: true, libelle: true } })).map((x) => ({ id: x.id, nom: x.libelle })),
    Activite: async (ids) => (await prisma.activite.findMany({ where: { id: { in: ids } }, select: { id: true, libelle: true } })).map((x) => ({ id: x.id, nom: x.libelle })),
    Modele: async (ids) => (await prisma.modele.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true } })).map((x) => ({ id: x.id, nom: x.nom })),
    // Courrier : le titre n'apparaît que pour un courrier ordinaire.
    CourrierArrivee: async (ids) => (await prisma.courrierArrivee.findMany({ where: { id: { in: ids } }, select: { id: true, objet: true, confidentialite: true, numero: true } })).map((x) => ({ id: x.id, nom: x.confidentialite === 'ORDINAIRE' ? x.numero ?? x.objet : null, protege: x.confidentialite !== 'ORDINAIRE' })),
    ActeCourrier: async (ids) => (await prisma.acteCourrier.findMany({ where: { id: { in: ids } }, select: { id: true, objet: true, confidentialite: true, numero: true } })).map((x) => ({ id: x.id, nom: x.confidentialite === 'ORDINAIRE' ? x.numero ?? x.objet : null, protege: x.confidentialite !== 'ORDINAIRE' })),
    Parametre: async (ids) => ids.map((id) => ({ id, nom: id })),
    FamilleActeRh: async (ids) => (await prisma.familleActeRh.findMany({ where: { code: { in: ids } }, select: { code: true, libelle: true } })).map((x) => ({ id: x.code, nom: x.libelle })),
  };
  for (const [type, ids] of parType) {
    const t = typeDe(type);
    if (t.protege) {
      ids.forEach((id) => res.set(`${type}:${id}`, { nom: null, protege: true }));
      continue;
    }
    const f = charger[type];
    if (!f) continue;
    poser(type, await f([...new Set(ids)]).catch(() => []));
  }
  return res;
}

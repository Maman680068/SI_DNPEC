import { apiFetch, telechargerFichier } from './client';
import type {
  Article,
  Bien,
  Categorie,
  Demande,
  Disponibilite,
  EtatBien,
  FicheBien,
  Habilitation,
  ModeReservation,
  MouvementStock,
  NatureCategorie,
  Nom,
  Reservation,
  Ressource,
  TableauLogistique,
  TypeDemande,
  TypeRessource,
} from '../logistique/types';

const j = (body: unknown) => ({ body: JSON.stringify(body) });
const qs = (o: Record<string, string | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v);
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')}` : '';
};
const post = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', ...(body !== undefined ? j(body) : {}) });

export const getTableauLogistique = () => apiFetch<TableauLogistique>('/logistique/tableau-de-bord');

// Paramétrage (administrateur)
export const getCategories = () => apiFetch<Categorie[]>('/logistique/categories');
export const getToutesCategories = () => apiFetch<Categorie[]>('/logistique/categories/toutes');
export const creerCategorie = (input: { code: string; libelle: string; nature: NatureCategorie; validationChefRequise: boolean }) => post<Categorie>('/logistique/categories', input);
export const modifierCategorie = (id: string, input: Partial<{ libelle: string; validationChefRequise: boolean; actif: boolean }>) =>
  apiFetch<Categorie>(`/logistique/categories/${id}`, { method: 'PATCH', ...j(input) });
export const getHabilitations = () => apiFetch<Habilitation[]>('/logistique/habilitations');
export const getCandidatsGestionnaire = () => apiFetch<(Nom & { role: string })[]>('/logistique/habilitations/candidats');
export const accorderHabilitation = (userId: string) => post('/logistique/habilitations', { userId });
export const revoquerHabilitation = (id: string) => post(`/logistique/habilitations/${id}/revoquer`);

// Fournitures
export const getArticles = () => apiFetch<Article[]>('/logistique/articles');
export const creerArticle = (input: { categorieId: string; libelle: string; unite?: string; suiviStock: boolean; seuilAlerte?: number | null }) => post<Article>('/logistique/articles', input);
export const modifierArticle = (id: string, input: Partial<{ libelle: string; unite: string; suiviStock: boolean; seuilAlerte: number | null; actif: boolean }>) =>
  apiFetch<Article>(`/logistique/articles/${id}`, { method: 'PATCH', ...j(input) });
export const getMouvementsStock = (id: string) => apiFetch<MouvementStock[]>(`/logistique/articles/${id}/mouvements`);
export const mouvementStock = (id: string, input: { type: 'ENTREE' | 'SORTIE'; quantite: number; motif?: string }) => post<Article>(`/logistique/articles/${id}/mouvements`, input);

// Inventaire
export const getBiens = (f: { categorieId?: string; etat?: string; q?: string } = {}) => apiFetch<Bien[]>(`/logistique/biens${qs(f)}`);
export const getBien = (id: string) => apiFetch<FicheBien>(`/logistique/biens/${id}`);
export const creerBien = (input: { categorieId: string; designation: string; marque?: string; numeroSerie?: string; emplacement?: string; dateAcquisition?: string }) =>
  post<FicheBien>('/logistique/biens', input);
export const modifierBien = (id: string, input: Record<string, string | null>) => apiFetch<FicheBien>(`/logistique/biens/${id}`, { method: 'PATCH', ...j(input) });
export const affecterBien = (id: string, input: { userId?: string; divisionId?: string; sectionId?: string; celluleId?: string }) => post<FicheBien>(`/logistique/biens/${id}/affecter`, input);
export const retourBien = (id: string, motif?: string) => post<FicheBien>(`/logistique/biens/${id}/retour`, { motif: motif || undefined });
export const changerEtatBien = (id: string, etat: EtatBien, motif?: string) => post<FicheBien>(`/logistique/biens/${id}/etat`, { etat, motif: motif || undefined });
export const exporterInventaire = (f: { categorieId?: string; etat?: string; q?: string } = {}) => telechargerFichier(`/logistique/biens/export.xlsx${qs(f)}`, null);

// Demandes
export const getDemandes = (vue?: 'miennes' | 'a_valider' | 'a_traiter') => apiFetch<Demande[]>(`/logistique/demandes${qs({ vue })}`);
export const getDemande = (id: string) => apiFetch<Demande>(`/logistique/demandes/${id}`);
export const creerDemande = (input: { type: TypeDemande; categorieId?: string; articleId?: string; bienId?: string; quantite?: number; objet: string; justification?: string }) =>
  post<Demande>('/logistique/demandes', input);
export const validerDemande = (id: string) => post<Demande>(`/logistique/demandes/${id}/valider`);
export const refuserDemande = (id: string, motif: string) => post<Demande>(`/logistique/demandes/${id}/refuser`, { motif });
export const prendreEnCharge = (id: string) => post<Demande>(`/logistique/demandes/${id}/prendre-en-charge`);
export const traiterDemande = (id: string, input: { quantiteLivree?: number; compteRendu?: string }) => post<Demande>(`/logistique/demandes/${id}/traiter`, input);
export const annulerDemande = (id: string) => post<Demande>(`/logistique/demandes/${id}/annuler`);
export const exporterDemandes = (vue?: string) => telechargerFichier(`/logistique/demandes/export.xlsx${qs({ vue })}`, null);

// Réservations
export const getRessources = () => apiFetch<Ressource[]>('/logistique/ressources');
export const getDisponibilite = (debut: string, fin: string, type?: TypeRessource) =>
  apiFetch<Disponibilite[]>(`/logistique/ressources/disponibilite${qs({ debut, fin, type })}`);
export const creerRessource = (input: { nom: string; type: TypeRessource; description?: string; capacite?: number; mode: ModeReservation }) => post<Ressource>('/logistique/ressources', input);
export const modifierRessource = (id: string, input: Partial<{ nom: string; description: string | null; capacite: number | null; mode: ModeReservation; actif: boolean }>) =>
  apiFetch<Ressource>(`/logistique/ressources/${id}`, { method: 'PATCH', ...j(input) });
export const getReservations = (f: { ressourceId?: string; du?: string; au?: string; vue?: 'miennes' | 'a_valider' } = {}) => apiFetch<Reservation[]>(`/logistique/reservations${qs(f)}`);
export const getReservation = (id: string) => apiFetch<Reservation>(`/logistique/reservations/${id}`);
export const reserver = (input: { ressourceId: string; debut: string; fin: string; objet: string; prioritaire?: boolean }) => post<Reservation>('/logistique/reservations', input);
export const validerReservation = (id: string) => post<Reservation>(`/logistique/reservations/${id}/valider`);
export const refuserReservation = (id: string, motif: string) => post<Reservation>(`/logistique/reservations/${id}/refuser`, { motif });
export const annulerReservation = (id: string, motif?: string) => post<Reservation>(`/logistique/reservations/${id}/annuler`, { motif: motif || undefined });

/** Administration de la logistique en une lecture (S9d) — administrateur. */
export interface AdministrationLogistique {
  gestionnaires: { actifs: number; inactifs: number; conseilDeux: boolean; liste: { habilitationId: string; userId: string; nom: string; role: string; actif: boolean; depuis: string }[] };
  alerteAucun: boolean;
  circuit: { avecValidation: number; sansValidation: number; gestionnaireDisponible: boolean };
  categories: (Categorie & { demonstration: boolean; contenu: { biens: number; demandesEnCours: number; articlesSousSeuil: number } })[];
  vehicules: { total: number; enMission: number };
}
export const getAdministrationLogistique = () => apiFetch<AdministrationLogistique>('/logistique/administration');

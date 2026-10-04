import { apiFetch, telechargerFichier } from './client';
import type {
  ActiviteDetail,
  ActiviteDisponible,
  Fil,
  FilResume,
  Instruction,
  ListeInstructions,
  Plan,
  PreferencesNotification,
  Recherche,
  TypeObjet,
} from '../pilotage/types';

const j = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// Plan de travail
export const getPlan = (annee: number, uniteId?: string) =>
  apiFetch<Plan>(
    `/api/v1/plan-travail?annee=${annee}${uniteId ? `&uniteId=${encodeURIComponent(uniteId)}` : ''}`,
  );
export const getActivite = (id: string) =>
  apiFetch<ActiviteDetail>(`/api/v1/plan-travail/activites/${id}`);
export const getActivitesDisponibles = () =>
  apiFetch<ActiviteDisponible[]>('/api/v1/plan-travail/activites-disponibles');
export const getResponsablesPossibles = (uniteId: string) =>
  apiFetch<{ id: string; firstName: string; lastName: string }[]>(
    `/api/v1/plan-travail/unites/${uniteId}/responsables-possibles`,
  );
export const creerObjectif = (input: {
  annee: number;
  uniteId: string;
  libelle: string;
  description?: string;
}) => apiFetch('/api/v1/plan-travail/objectifs', j('POST', input));
export const modifierObjectif = (id: string, input: { libelle?: string; description?: string }) =>
  apiFetch(`/api/v1/plan-travail/objectifs/${id}`, j('PATCH', input));
export const supprimerObjectif = (id: string) =>
  apiFetch(`/api/v1/plan-travail/objectifs/${id}`, j('DELETE'));
export interface ActiviteSaisie {
  libelle: string;
  responsableId: string;
  dateDebut: string;
  dateFin: string;
  indicateur: string;
  cible?: string;
}
export const creerActivite = (objectifId: string, input: ActiviteSaisie) =>
  apiFetch(`/api/v1/plan-travail/objectifs/${objectifId}/activites`, j('POST', input));
export const modifierActivite = (id: string, input: Partial<ActiviteSaisie>) =>
  apiFetch(`/api/v1/plan-travail/activites/${id}`, j('PATCH', input));
export const supprimerActivite = (id: string) =>
  apiFetch(`/api/v1/plan-travail/activites/${id}`, j('DELETE'));

// Instructions de la Direction
export const getInstructions = () => apiFetch<ListeInstructions>('/api/v1/instructions');
export const getInstruction = (id: string) => apiFetch<Instruction>(`/api/v1/instructions/${id}`);
/** Export Excel de la liste (même périmètre que l'écran). */
export const exporterInstructions = () => telechargerFichier('/api/v1/instructions/export.xlsx', null);
export const emettreInstruction = (input: {
  objet: string;
  texte: string;
  destinataireId: string;
  agentConcerneId?: string;
  echeance?: string;
}) => apiFetch<Instruction>('/api/v1/instructions', j('POST', input));
export const prendreEnCompte = (id: string) =>
  apiFetch<Instruction>(`/api/v1/instructions/${id}/prise-en-compte`, j('POST'));
export const executerInstruction = (id: string, input: { compteRendu: string; acteId?: string }) =>
  apiFetch<Instruction>(`/api/v1/instructions/${id}/execution`, j('POST', input));
export const rejeterInstruction = (id: string, motif: string) =>
  apiFetch<Instruction>(`/api/v1/instructions/${id}/rejet`, j('POST', { motif }));

// Fils de discussion
export const getFils = () => apiFetch<FilResume[]>('/api/v1/fils');
export const getFil = (id: string) => apiFetch<Fil>(`/api/v1/fils/${id}`);
export const getDestinatairesFil = () =>
  apiFetch<{ id: string; firstName: string; lastName: string }[]>(
    '/api/v1/fils/destinataires-possibles',
  );
export const creerFil = (input: {
  objet: string;
  destinataires: string[];
  corps: string;
  lien?: { type: TypeObjet; id: string };
}) => apiFetch<Fil>('/api/v1/fils', j('POST', input));
export const repondreFil = (
  id: string,
  input: { corps: string; lien?: { type: TypeObjet; id: string } },
) => apiFetch<Fil>(`/api/v1/fils/${id}/messages`, j('POST', input));

// Recherche transverse
export const rechercher = (q: string) =>
  apiFetch<Recherche>(`/api/v1/recherche?q=${encodeURIComponent(q)}`);

// Préférences de notification
export const getPreferences = () =>
  apiFetch<PreferencesNotification>('/api/v1/notifications/preferences');
export const modifierPreferences = (input: { resumeQuotidien?: boolean; heureResume?: number }) =>
  apiFetch<PreferencesNotification>('/api/v1/notifications/preferences', j('PATCH', input));

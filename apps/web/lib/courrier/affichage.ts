import type { TonPastille } from '../../components/ui/Charte';
import type { Acte, ActeStatut, Arrivee, ArriveeStatut, Imputation } from './types';
import { NIVEAU_VISA_LABEL, nomPersonne } from './types';

// Mise en forme du registre (refonte de l'interface, étape 5) : libellés et tons des pastilles,
// dates courtes, étape du circuit d'un acte. Aucun droit ici : tout vient de l'API.

/** Statut d'une arrivée en pastille : un courrier enregistré attend son imputation (sauf pli personnel). */
export function pastilleArrivee(a: Pick<Arrivee, 'statut' | 'confidentialite'>): { label: string; ton: TonPastille } {
  const t: Record<ArriveeStatut, { label: string; ton: TonPastille }> = {
    ENREGISTRE: a.confidentialite === 'PERSONNEL' ? { label: 'Enregistré', ton: 'gris' } : { label: 'À imputer', ton: 'ambre' },
    IMPUTE: { label: 'Imputé', ton: 'encre' },
    TRAITE: { label: 'Traité', ton: 'vert' },
    CLASSE: { label: 'Classé', ton: 'gris' },
    ANNULE: { label: 'Annulé', ton: 'gris' },
  };
  return t[a.statut];
}

export const TON_ACTE: Record<ActeStatut, TonPastille> = {
  BROUILLON: 'gris',
  EN_VISA: 'encre',
  RENVOYE: 'rouge',
  A_SIGNER: 'ambre',
  SIGNE: 'vert',
  EXPEDIE: 'vert',
  ANNULE: 'gris',
};

const ANNEE = () => new Date().getFullYear();

/** « 3 oct. » (année courante) ou « 22 déc. 2025 ». */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', d.getFullYear() === ANNEE() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** « 3 oct., 09:12 » — événements de l'historique. */
export function dateHeureCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const jour = dateCourte(iso);
  return `${jour}, ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** « 2025 et 2026 », « 2024, 2025 et 2026 ». */
export function listeAnnees(annees: number[]): string {
  const a = [...new Set(annees)].sort();
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`;
}

export function enRetard(i: Pick<Imputation, 'echeance' | 'statut'>): boolean {
  return i.statut === 'EN_COURS' && !!i.echeance && new Date(i.echeance) < new Date();
}

export function objetArrivee(a: Arrivee): string {
  if (a.niveau === 'EXISTENCE') return `Pli personnel pour ${nomPersonne(a.personnes, a.destinataireId)} — contenu protégé`;
  return a.objet ?? (a.confidentialite === 'PERSONNEL' ? 'Pli personnel (objet non renseigné)' : '—');
}

/** Imputations de premier niveau (le « service imputé » du registre). */
export const imputationsRacines = (a: Arrivee) => a.imputations.filter((i) => !i.parentId);

/** Échéance la plus proche parmi les imputations en cours. */
export function echeanceArrivee(a: Arrivee): Imputation | null {
  const enCours = a.imputations.filter((i) => i.statut === 'EN_COURS' && i.echeance);
  enCours.sort((x, y) => x.echeance!.localeCompare(y.echeance!));
  return enCours[0] ?? null;
}

/** Étape du circuit d'un départ ou d'un acte, en clair (colonne du registre). */
export function etapeActe(a: Acte): string {
  switch (a.statut) {
    case 'BROUILLON':
      return 'Rédaction';
    case 'RENVOYE':
      return 'Correction par le rédacteur';
    case 'EN_VISA': {
      const v = a.visaCourant;
      return v ? `Visa ${NIVEAU_VISA_LABEL[v.niveau] ?? v.niveau} — ${nomPersonne(a.personnes, v.viseurAttenduId)}` : 'Visa';
    }
    case 'A_SIGNER':
      return 'Signature';
    case 'SIGNE':
      return a.enAttentePriseConnaissance ? 'Prise de connaissance' : 'Expédition';
    case 'EXPEDIE':
      return `Expédié${a.modeExpedition ? ` (${a.modeExpedition})` : ''}`;
    default:
      return '—';
  }
}

/** Date affichée d'un acte : signature, sinon dernière modification. */
export const dateActe = (a: Acte) => a.signeAt ?? a.updatedAt;
export const anneeActe = (a: Acte) => a.annee ?? new Date(a.createdAt).getFullYear();

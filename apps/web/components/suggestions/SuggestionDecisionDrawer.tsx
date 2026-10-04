'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { updateSuggestionStatus } from '../../lib/api/suggestions';
import type { Suggestion, SuggestionStatus } from '../../lib/suggestions/types';
import { STATUS_LABEL } from '../../lib/suggestions/types';
import { BTN_PRINCIPAL, CleValeur, Etapes, Pastille, SectionFenetre, type EtatEtape } from '../ui/Charte';
import { STATUS_TON } from './MySuggestionList';
import { FenetreDetail } from '../ui/FenetreDetail';
import { ChoixSegment, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const TITRE_TOAST: Record<SuggestionStatus, string> = {
  RECUE: 'Suggestion remise à « Reçue »',
  EN_ETUDE: 'Suggestion mise en étude',
  RETENUE: 'Suggestion retenue',
  NON_RETENUE: 'Suggestion non retenue',
};

const STATUS_OPTIONS: SuggestionStatus[] = ['RECUE', 'EN_ETUDE', 'RETENUE', 'NON_RETENUE'];

/** Circuit d'une suggestion : Reçue → En étude → Retenue ou Non retenue. */
function etapes(s: SuggestionStatus): { label: string; etat: EtatEtape }[] {
  const rang = { RECUE: 0, EN_ETUDE: 1, RETENUE: 2, NON_RETENUE: 2 }[s];
  return ['Reçue', 'En étude', s === 'NON_RETENUE' ? 'Non retenue' : 'Retenue'].map((label, n) => ({
    label,
    etat: n < rang || (n === 2 && rang === 2) ? 'fait' : n === rang ? 'courant' : 'avenir',
  }));
}

/**
 * Fenêtre d'une suggestion (deux colonnes) : texte et réponse à gauche ; à droite, pour la Direction
 * (boîte de réception), le statut et la réponse à enregistrer, puis les informations. Sans `onUpdated`
 * (« Mes suggestions »), lecture seule.
 */
export function SuggestionDecisionDrawer({
  suggestion,
  onClose,
  onUpdated,
}: {
  suggestion: Suggestion;
  onClose: () => void;
  onUpdated?: (suggestion: Suggestion) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const [status, setStatus] = useState<SuggestionStatus>(suggestion.status);
  const [response, setResponse] = useState(suggestion.response ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const authorLabel = suggestion.isAnonymous
    ? 'Anonyme'
    : suggestion.authorId === currentUser?.id
      ? 'Vous'
      : getUserLabel(suggestion.authorId ?? '');

  async function handleSave() {
    if (!onUpdated) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateSuggestionStatus(suggestion.id, { status, response: response.trim() || undefined });
      // Pas d'« Annuler » : remettre l'ancien statut notifierait l'auteur une seconde fois.
      toast.succes(updated.status === suggestion.status ? 'Suggestion enregistrée' : TITRE_TOAST[updated.status], {
        detail: suggestion.isAnonymous ? 'Suggestion anonyme : personne n’est notifié.' : 'L’auteur est notifié et voit la réponse.',
      });
      onUpdated(updated);
    } catch (err) {
      setError(messageErreur(err, 'Impossible d’enregistrer.'));
    } finally {
      setSubmitting(false);
    }
  }

  const informations = (
    <div className={onUpdated ? 'mt-4 border-t border-line pt-4' : ''}>
      <CleValeur
        largeur={96}
        lignes={[
          ['Statut', <Pastille key="s" ton={STATUS_TON[suggestion.status]}>{STATUS_LABEL[suggestion.status]}</Pastille>],
          ['Auteur', authorLabel],
          [onUpdated ? 'Reçue le' : 'Envoyée le', formatDate(suggestion.createdAt)],
          ...(suggestion.respondedAt ? ([['Réponse le', formatDate(suggestion.respondedAt)]] as [string, string][]) : []),
        ]}
      />
    </div>
  );

  return (
    <FenetreDetail
      titre={`Suggestion du ${formatDate(suggestion.createdAt)}`}
      filAriane={['Boîte à suggestions', onUpdated ? 'Boîte de réception' : 'Mes suggestions']}
      entete={<Etapes etapes={etapes(suggestion.status)} label="Suivi de la suggestion" />}
      onClose={onClose}
      largeur={880}
      testid="fiche-suggestion"
      cote={
        onUpdated ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <ChoixSegment<SuggestionStatus>
              id="suggestion-statut"
              label="Statut"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
            <ZoneTexte
              id="suggestion-reponse"
              label={`Réponse${suggestion.isAnonymous ? '' : ' (visible par l’auteur)'}`}
              facultatif
              value={response}
              onChange={setResponse}
              lignes={4}
            />
            {error && (
              <div role="alert" className="mb-3 rounded-[9px] bg-clay-50 px-3 py-2 text-[13px] text-clay">
                {error}
              </div>
            )}
            <button type="submit" className={`${BTN_PRINCIPAL} w-full`} disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <p className="mt-2 text-[12px] text-text-muted">
              {suggestion.isAnonymous ? 'Suggestion anonyme : personne n’est notifié de la réponse.' : 'L’auteur est notifié du changement de statut et voit la réponse dans « Mes suggestions ».'}
            </p>
            {informations}
          </form>
        ) : (
          informations
        )
      }
    >
      <SectionFenetre titre="Suggestion">
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">{suggestion.content}</p>
      </SectionFenetre>
      {suggestion.isAnonymous && <Pastille ton="gris">Auteur non enregistré — soumission anonyme</Pastille>}
      <SectionFenetre titre="Réponse de la Direction" className="mt-[18px]">
        <p className="whitespace-pre-wrap text-[13.5px] text-text-muted">{suggestion.response ?? 'Pas encore de réponse.'}</p>
      </SectionFenetre>
    </FenetreDetail>
  );
}

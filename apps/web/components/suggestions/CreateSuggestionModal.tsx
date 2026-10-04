'use client';

import { useState } from 'react';
import { createSuggestion } from '../../lib/api/suggestions';
import type { Suggestion } from '../../lib/suggestions/types';
import { Case, FenetreFormulaire, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

/** Nouvelle suggestion (fenêtre de formulaire) : texte libre, soumission anonyme possible. */
export function CreateSuggestionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (suggestion: Suggestion | null) => void;
}) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const suggestion = await createSuggestion({ content: content.trim(), isAnonymous });
      toast.succes('Suggestion envoyée', {
        detail: isAnonymous ? 'Envoyée anonymement à la Direction : elle n’apparaît pas dans « Mes suggestions ».' : 'La Direction est prévenue ; vous serez notifié·e de son suivi.',
      });
      // Une suggestion anonyme n'a pas d'authorId : elle n'apparaîtra jamais dans
      // "Mes suggestions" (voir SuggestionsService) — inutile de l'ajouter à la liste locale.
      onCreated(isAnonymous ? null : suggestion);
    } catch (err) {
      setError(messageErreur(err, 'Impossible d’envoyer la suggestion.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Nouvelle suggestion"
      onClose={onClose}
      onSubmit={handleSubmit}
      libelleValider="Envoyer la suggestion"
      enCours={submitting}
      erreur={error}
      largeur={600}
      testid="fenetre-nouvelle-suggestion"
      pied={isAnonymous ? 'Envoi anonyme : personne ne pourra savoir qu’elle vient de vous.' : 'Le DN et le DNA sont prévenus dès l’envoi.'}
      valider={() => (content.trim() ? {} : { 'suggestion-texte': 'Écrivez votre suggestion.' })}
    >
      <ZoneTexte
        id="suggestion-texte"
        label="Votre suggestion, à destination de la Direction"
        value={content}
        onChange={setContent}
        lignes={6}
        required
        messageObligatoire="Écrivez votre suggestion."
      />
      <Case
        id="suggestion-anonyme"
        checked={isAnonymous}
        onChange={setIsAnonymous}
        label={
          <>
            Soumettre anonymement
            <span className="block text-[12px] text-text-muted">
              Ni la Direction ni personne d’autre ne pourra savoir que la suggestion vient de vous — en contrepartie, elle
              n’apparaîtra pas dans « Mes suggestions » et vous ne serez pas notifié·e de son suivi.
            </span>
          </>
        }
      />
    </FenetreFormulaire>
  );
}

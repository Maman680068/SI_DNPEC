'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createPoll } from '../../lib/api/polls';
import type { Poll } from '../../lib/polls/types';
import type { AudienceScopeValue } from '../../lib/communication/types';
import { getAvailableAudienceScopes, SCOPE_LABEL } from '../../lib/communication/types';
import { AudienceScopeFields } from './AudienceScopeFields';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Saisie } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

const EMPTY_OPTIONS = ['', ''];
const pad = (n: number) => String(n).padStart(2, '0');
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Nouveau sondage (refonte, étape 9) : question, choix (deux au moins), un ou plusieurs choix par
 * personne, clôture automatique facultative (date en français, heure), portée. Validation dans la fenêtre.
 */
export function CreatePollModal({ onClose, onCreated }: { onClose: () => void; onCreated: (poll: Poll) => void }) {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const availableScopes = useMemo(() => getAvailableAudienceScopes(currentUser?.role ?? ''), [currentUser?.role]);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [allowMultiple, setAllowMultiple] = useState<'un' | 'plusieurs'>('un');
  const [dateCloture, setDateCloture] = useState('');
  const [heureCloture, setHeureCloture] = useState('');
  const [audience, setAudience] = useState<AudienceScopeValue>({
    scope: availableScopes[0] ?? 'GROUPE_PERSONNALISE',
    divisionId: currentUser?.divisionId ?? '',
    sectionId: currentUser?.sectionId ?? '',
    celluleId: currentUser?.celluleId ?? '',
    recipientUserIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  // Heure locale de clôture (23 h 59 si seule la date est donnée), comme l'ancien champ date et heure.
  const cloture = dateCloture ? new Date(`${dateCloture}T${heureCloture || '23:59'}`) : null;

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function valider(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!question.trim()) e['sondage-question'] = 'Saisissez la question posée.';
    if (validOptions.length < 2) {
      const vides = options.map((o, i) => (o.trim() ? -1 : i)).filter((i) => i >= 0);
      for (const i of vides.slice(0, 2 - validOptions.length)) e[`sondage-option-${i}`] = 'Proposez au moins deux choix.';
    }
    if (heureCloture && !dateCloture) e['sondage-cloture'] = 'Choisissez la date de clôture.';
    else if (cloture && cloture.getTime() <= Date.now()) e['sondage-heure'] = 'La clôture doit être dans le futur.';
    return e;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const poll = await createPoll({
        question: question.trim(),
        options: validOptions,
        allowMultiple: allowMultiple === 'plusieurs',
        closesAt: cloture ? cloture.toISOString() : undefined,
        scope: audience.scope,
        divisionId: audience.scope === 'DIVISION' || audience.scope === 'SECTION' ? audience.divisionId : undefined,
        sectionId: audience.scope === 'SECTION' ? audience.sectionId : undefined,
        celluleId: audience.scope === 'CELLULE' ? audience.celluleId : undefined,
        recipientUserIds: audience.scope === 'GROUPE_PERSONNALISE' ? audience.recipientUserIds : undefined,
      });
      toast.succes('Sondage publié', {
        detail: audience.scope === 'GROUPE_PERSONNALISE' ? `${audience.recipientUserIds.length} destinataire${audience.recipientUserIds.length > 1 ? 's' : ''} prévenu${audience.recipientUserIds.length > 1 ? 's' : ''}.` : `Portée : ${SCOPE_LABEL[audience.scope].toLowerCase()}. Les destinataires sont prévenus.`,
      });
      onCreated(poll);
    } catch (err) {
      setError(messageErreur(err, 'Impossible de publier le sondage.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (availableScopes.length === 0) return null;

  return (
    <FenetreFormulaire
      titre="Nouveau sondage"
      onClose={onClose}
      onSubmit={handleSubmit}
      libelleValider="Publier le sondage"
      enCours={submitting}
      erreur={error}
      largeur={760}
      valider={valider}
      testid="fenetre-nouveau-sondage"
      pied="Les destinataires sont prévenus et votent depuis l’onglet Sondages ; vous pouvez le clôturer à tout moment."
    >
      <Saisie id="sondage-question" label="Question" value={question} onChange={setQuestion} required messageObligatoire="Saisissez la question posée." />

      <div className="min-w-0" data-testid="choix-sondage">
        {options.map((option, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Saisie id={`sondage-option-${index}`} label={`Choix ${index + 1}`} value={option} onChange={(v) => updateOption(index, v)} placeholder={index === 0 ? 'Par exemple : mardi 10 h' : undefined} />
            </div>
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`Retirer le choix ${index + 1}`}
                className="mt-[26px] grid h-10 w-10 flex-none place-items-center rounded-[10px] border border-line text-text-muted hover:bg-bg"
              >
                <X aria-hidden size={16} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setOptions((prev) => [...prev, ''])} className="-mt-1 mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink hover:underline">
          <Plus aria-hidden size={15} /> Ajouter un choix
        </button>
      </div>

      <ChoixSegment<'un' | 'plusieurs'>
        id="sondage-reponses"
        label="Réponses par personne"
        value={allowMultiple}
        onChange={setAllowMultiple}
        options={[
          { value: 'un', label: 'Un seul choix' },
          { value: 'plusieurs', label: 'Plusieurs choix' },
        ]}
      />
      <Grille2>
        <ChampDate id="sondage-cloture" label="Clôture automatique" facultatif value={dateCloture} onChange={setDateCloture} min={aujourdhui()} />
        <Saisie id="sondage-heure" label="Heure de clôture" facultatif type="time" value={heureCloture} onChange={setHeureCloture} aide={dateCloture && !heureCloture ? 'À défaut : 23 h 59.' : undefined} />
      </Grille2>

      <AudienceScopeFields prefixe="sondage" availableScopes={availableScopes} value={audience} onChange={setAudience} />
    </FenetreFormulaire>
  );
}

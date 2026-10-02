'use client';

import { useEffect, useState } from 'react';
import { getPreferences, modifierPreferences } from '../../../../lib/api/pilotage';
import type { PreferencesNotification } from '../../../../lib/pilotage/types';
import { Button } from '../../../../components/ui/Button';
import {
  Chargement,
  ErreurChargement,
  messageChargement,
} from '../../../../components/ui/ErreurChargement';

const HEURES = Array.from({ length: 24 }, (_, h) => h);

/** Préférences de notification (socle N5, §9) : résumé quotidien ou tout immédiatement. */
export default function PreferencesNotificationPage() {
  const [p, setP] = useState<PreferencesNotification | null>(null);
  const [mode, setMode] = useState<'resume' | 'immediat'>('resume');
  const [heure, setHeure] = useState(7);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const appliquer = (x: PreferencesNotification) => {
    setP(x);
    setMode(x.resumeQuotidien ? 'resume' : 'immediat');
    setHeure(x.heureResume);
  };
  useEffect(() => {
    getPreferences()
      .then(appliquer)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  if (!p) {
    return (
      <div>
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} />
      </div>
    );
  }
  return (
    <div className="max-w-[640px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">
        Mon compte
      </div>
      <h1 className="mb-1 text-[22px] font-extrabold">Préférences de notification</h1>
      <p className="mb-5 text-[13px] text-text-muted">
        Les notifications s’affichent toujours immédiatement dans l’application (cloche). Vous
        choisissez ici comment recevoir les emails.
      </p>
      <ErreurChargement message={erreur} />
      <form
        className="rounded-lg border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setEnCours(true);
          setInfo(null);
          modifierPreferences({ resumeQuotidien: mode === 'resume', heureResume: heure })
            .then((x) => (appliquer(x), setInfo('Préférences enregistrées.')))
            .catch((err) => setErreur(messageChargement(err)))
            .finally(() => setEnCours(false));
        }}
      >
        <fieldset className="mb-4">
          <legend className="mb-2 text-[13px] font-semibold">Emails</legend>
          <label className="mb-2 flex items-start gap-2 text-[13px]">
            <input
              type="radio"
              name="mode"
              checked={mode === 'resume'}
              onChange={() => setMode('resume')}
              className="mt-1"
            />
            <span>
              <strong>Résumé quotidien</strong> (recommandé) — un seul email par jour regroupant les
              notifications ordinaires.
            </span>
          </label>
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="radio"
              name="mode"
              checked={mode === 'immediat'}
              onChange={() => setMode('immediat')}
              className="mt-1"
            />
            <span>
              <strong>Tout immédiatement</strong> — un email par notification.
            </span>
          </label>
        </fieldset>
        {mode === 'resume' && (
          <label className="mb-4 block text-[13px] font-semibold">
            Heure du résumé (heure de Conakry)
            <select
              className="mt-1 block rounded-md border border-line bg-surface px-3 py-2 text-[13px]"
              value={heure}
              onChange={(e) => setHeure(Number(e.target.value))}
            >
              {HEURES.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')} h 00
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mb-4 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px]">
          Toujours envoyés immédiatement, quel que soit votre choix : sécurité du compte, décision
          sur une de vos demandes, acte à signer, instruction de la Direction, tâche en retard,
          rappel ou annulation de réunion, alerte de supervision.
        </div>
        {p.enAttente > 0 && (
          <p className="mb-3 text-[12.5px] text-text-muted" data-testid="en-attente">
            {p.enAttente} email(s) en attente du prochain résumé.
          </p>
        )}
        {info && (
          <p role="status" className="mb-3 text-[12.5px] text-sage">
            {info}
          </p>
        )}
        <Button variant="solid" type="submit" disabled={enCours}>
          Enregistrer mes préférences
        </Button>
      </form>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { Personne as PersonneCourrier } from '../../lib/courrier/types';
import { ROLE_LABEL } from '../../lib/users/types';
import type { Personne } from '../ui/Formulaire';
import { Barre } from '../ui/Squelette';
import { messageErreur } from '../ui/Toast';

/**
 * Outils communs des formulaires du Courrier, des Archives et de la Logistique (refonte, étape 9) :
 * envoi avec erreur de l'API en français (jamais un message technique), personnes proposées au
 * format du sélecteur, squelette de champs pendant la lecture des listes de choix.
 */

/** Messages de validation de l'API restés en anglais (class-validator) : jamais montrés tels quels. */
const MESSAGE_VALIDATION_ANGLAIS = /\b(must be|must not be|should not|should be|is not a valid|must contain|must match|must be a|each value in)\b/i;

/** Message d'un refus de l'API en français : les messages techniques sont remplacés. */
export function messageRefus(e: unknown, defaut = 'L’action n’a pas abouti. Réessayez dans un instant.'): string {
  const m = messageErreur(e, defaut);
  return MESSAGE_VALIDATION_ANGLAIS.test(m) ? 'Certaines informations ne sont pas acceptées. Vérifiez la saisie, puis réessayez.' : m;
}

/** Envoi d'un formulaire : `erreur` = refus de l'API (affiché en bas de la fenêtre). */
export function useEnvoi() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function envoyer<T>(action: () => Promise<T>, defaut = 'L’action n’a pas abouti. Réessayez dans un instant.'): Promise<{ ok: true; valeur: T } | { ok: false }> {
    setEnCours(true);
    setErreur(null);
    try {
      return { ok: true, valeur: await action() };
    } catch (e) {
      setErreur(messageRefus(e, defaut));
      return { ok: false };
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, setErreur, envoyer };
}

/** « Prénom Nom », fonction (ou rôle) en détail : format du `SelecteurPersonnes`. */
export const versPersonne = (p: Pick<PersonneCourrier, 'id' | 'firstName' | 'lastName'> & { jobTitle?: string | null; role?: string | null }, detail?: string | null): Personne => ({
  id: p.id,
  nom: `${p.firstName} ${p.lastName}`,
  detail: detail ?? p.jobTitle ?? (p.role ? (ROLE_LABEL as Record<string, string>)[p.role] ?? null : null),
});

export const nomDe = (options: Personne[], id: string) => options.find((o) => o.id === id)?.nom ?? '';

/** Champs d'une fenêtre en cours de préparation (listes de choix pas encore reçues). */
export function SqueletteChamps({ champs = 3 }: { champs?: number }) {
  return (
    <div role="status" aria-label="Chargement en cours" data-testid="squelette" className="mb-3.5 space-y-4">
      <span className="sr-only">Chargement en cours</span>
      {Array.from({ length: champs }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2">
          <Barre className="h-2.5 w-[120px]" />
          <Barre className="h-10 w-full rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}

/** Jour local au format AAAA-MM-JJ (décalé de `jours`). */
export function jourLocal(jours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Message d'erreur sous un champ placé HORS d'une `FenetreFormulaire` (formulaire « Imputer ce
 * courrier » de la fenêtre d'un courrier) : même apparence que celui des fenêtres, relié au champ
 * pour les lecteurs d'écran (aria-invalid, aria-describedby).
 */
export function ErreurSousChamp({ id, message }: { id: string; message: string | null }) {
  useEffect(() => {
    const champ = document.getElementById(id);
    if (!champ) return;
    if (message) {
      champ.setAttribute('aria-invalid', 'true');
      champ.setAttribute('aria-describedby', `${id}-erreur`);
    } else {
      champ.removeAttribute('aria-invalid');
      champ.removeAttribute('aria-describedby');
    }
  }, [id, message]);
  if (!message) return null;
  return (
    <p id={`${id}-erreur`} role="alert" className="-mt-2.5 mb-3 text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
      {message}
    </p>
  );
}

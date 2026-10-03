'use client';

import { useEffect, useRef } from 'react';
import type { Navigation } from '../api/navigation';

export type CleCreation = keyof Navigation['creer'];

/** Adresse de chaque entrée du menu « Créer » : la page lit le paramètre et ouvre sa fenêtre de création. */
export const LIENS_CREATION: Record<CleCreation, string> = {
  tache: '/tasks?nouvelle=1',
  reunion: '/reunions?nouvelle=1',
  conge: '/leaves?nouvelle=1',
  message: '/communication?nouveau=message',
  document: '/documents?nouveau=1',
};

/** Menu « Créer » utilisé alors que la page visée est déjà ouverte : pas de rechargement, un événement. */
export const EVENEMENT_CREER = 'dnpec:creer';

/**
 * Ouvre la fenêtre de création d'une page quand le menu « Créer » la demande : au montage (paramètre
 * de l'adresse, retiré ensuite pour qu'un rechargement ne la rouvre pas) ou par l'événement.
 * `pret` : attendre que la page puisse l'ouvrir (données chargées).
 */
export function useDemandeCreation(cle: CleCreation, ouvrir: () => void, pret = true) {
  const rappel = useRef(ouvrir);
  rappel.current = ouvrir;
  const traite = useRef(false);
  useEffect(() => {
    if (!pret || traite.current) return;
    traite.current = true;
    const attendu = new URL(LIENS_CREATION[cle], window.location.origin).searchParams;
    const [nom, valeur] = [...attendu.entries()][0] ?? ['', ''];
    const url = new URL(window.location.href);
    if (!nom || url.searchParams.get(nom) !== valeur) return;
    url.searchParams.delete(nom);
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
    rappel.current();
  }, [cle, pret]);
  useEffect(() => {
    const ecouter = (e: Event) => (e as CustomEvent<CleCreation>).detail === cle && rappel.current();
    window.addEventListener(EVENEMENT_CREER, ecouter);
    return () => window.removeEventListener(EVENEMENT_CREER, ecouter);
  }, [cle]);
}

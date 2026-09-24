'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { SystemRole } from '../auth/types';
import { registerInterimHooks } from '../api/client';
import { getMySuppleances } from '../api/suppleances';
import { suppleanceStatus, type Suppleance } from '../suppleances/types';

/** Intérim actif dans cet onglet — ce qu'il faut pour l'en-tête X-Interim-For
 * et pour le bandeau, sans recharger la suppléance à chaque rendu. */
export interface ActiveInterim {
  suppleanceId: string;
  titulaireId: string;
  titulaireName: string;
  titulaireRole: SystemRole;
  endDate: string;
}

interface InterimContextValue {
  /** Intérim en cours dans cet onglet, ou null (on agit en son nom propre). */
  interim: ActiveInterim | null;
  /** Suppléances que la personne peut exercer MAINTENANT : elle en est le
   * suppléant, en cours (ni à venir, ni terminée, ni révoquée) ET conformes
   * à la règle du rang comparable. Les non conformes n'apparaissent que sur
   * la page /suppleances, avec leur statut. */
  available: Suppleance[];
  /** Rôle à utiliser pour les affichages conditionnés par le rôle (boutons,
   * menus) : celui du titulaire pendant un intérim. Le serveur reste seul juge. */
  effectiveRole: SystemRole | undefined;
  /** Motif de la dernière sortie automatique d'intérim (refus de l'API,
   * suppléance expirée ou révoquée), à afficher une fois. */
  notice: string | null;
  startInterim: (suppleance: Suppleance) => void;
  stopInterim: () => void;
  dismissNotice: () => void;
  refresh: () => Promise<void>;
}

const InterimContext = createContext<InterimContextValue | null>(null);

// sessionStorage (par onglet, effacé à sa fermeture) et non localStorage :
// l'intérim est un choix explicite, jamais un état ambiant qui survivrait à
// la session de travail ni se propagerait à d'autres onglets.
const STORAGE_KEY = 'dnpec.interim';

function readStored(): ActiveInterim | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveInterim) : null;
  } catch {
    return null;
  }
}

function writeStored(value: ActiveInterim | null): void {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée stricte) : l'intérim reste
    // actif en mémoire pour cet affichage, simplement pas après rechargement.
  }
}

function toActive(s: Suppleance): ActiveInterim {
  return {
    suppleanceId: s.id,
    titulaireId: s.titulaireId,
    titulaireName: `${s.titulaire.firstName} ${s.titulaire.lastName}`,
    titulaireRole: s.titulaire.role,
    endDate: s.endDate,
  };
}

export function InterimProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const [interim, setInterim] = useState<ActiveInterim | null>(null);
  const [available, setAvailable] = useState<Suppleance[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Ref : lue par lib/api/client à chaque requête — toujours la valeur courante.
  const interimRef = useRef<ActiveInterim | null>(null);

  const applyInterim = useCallback((value: ActiveInterim | null) => {
    interimRef.current = value;
    writeStored(value);
    setInterim(value);
  }, []);

  const exitWithNotice = useCallback(
    (message: string) => {
      if (!interimRef.current) return;
      const name = interimRef.current.titulaireName;
      applyInterim(null);
      setNotice(`Intérim pour ${name} interrompu : ${message}`);
    },
    [applyInterim],
  );

  useEffect(() => {
    registerInterimHooks(() => interimRef.current?.titulaireId ?? null, exitWithNotice);
  }, [exitWithNotice]);

  // Lecture de l'intérim mémorisé par l'onglet au montage seulement (jamais au
  // rendu serveur, où sessionStorage n'existe pas) — avant que la page ne
  // charge ses données, le layout n'affichant rien tant que l'authentification
  // n'est pas établie.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      interimRef.current = stored;
      setInterim(stored);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const mine = await getMySuppleances();
    const usable = mine.filter((s) => s.suppleantId === user.id && suppleanceStatus(s) === 'EN_COURS');
    setAvailable(usable);
    // Intérim mémorisé dans l'onglet mais plus exerçable (révoqué, expiré,
    // devenu non conforme) : on le quitte avant toute autre requête.
    const current = interimRef.current;
    if (current && !usable.some((s) => s.id === current.suppleanceId)) {
      exitWithNotice('cette suppléance n’est plus en cours ou n’est plus conforme.');
    }
  }, [user, exitWithNotice]);

  useEffect(() => {
    // Déconnexion réelle uniquement — pas l'état 'loading' du montage, pendant
    // lequel user vaut aussi null et où l'intérim mémorisé doit survivre.
    if (status === 'unauthenticated') {
      applyInterim(null);
      setAvailable([]);
      return;
    }
    if (user) refresh().catch(() => setAvailable([]));
  }, [status, user, refresh, applyInterim]);

  const startInterim = useCallback(
    (s: Suppleance) => {
      setNotice(null);
      applyInterim(toActive(s));
    },
    [applyInterim],
  );

  const stopInterim = useCallback(() => applyInterim(null), [applyInterim]);

  return (
    <InterimContext.Provider
      value={{
        interim,
        available,
        effectiveRole: interim?.titulaireRole ?? user?.role,
        notice,
        startInterim,
        stopInterim,
        dismissNotice: () => setNotice(null),
        refresh,
      }}
    >
      {children}
    </InterimContext.Provider>
  );
}

export function useInterim(): InterimContextValue {
  const ctx = useContext(InterimContext);
  if (!ctx) throw new Error('useInterim doit être utilisé sous InterimProvider.');
  return ctx;
}

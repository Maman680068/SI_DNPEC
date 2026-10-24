'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { effacerPreuve, registerAuthHooks } from '../api/client';
import { loginRequest, loginTwoFaRequest, enableTwoFaRequest, refreshRequest, logoutRequest } from '../api/auth';
import type { AuthUser, LoginProxyResult } from './types';
import { consommerSuite, marquerDeconnexionVolontaire } from './suite';

type PendingChallenge =
  | { type: 'two_fa_challenge_required'; token: string }
  | { type: 'two_fa_setup_required'; token: string }
  | null;

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  pendingChallenge: PendingChallenge;
  login: (email: string, password: string) => Promise<LoginProxyResult>;
  submitTwoFaCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge>(null);
  // Ref plutôt que state : getAccessToken() (appelé par lib/api/client à chaque requête)
  // doit toujours lire la valeur la plus récente, pas une closure figée au montage.
  const accessTokenRef = useRef<string | null>(null);

  const applySession = useCallback((accessToken: string, authUser: AuthUser) => {
    accessTokenRef.current = accessToken;
    setUser(authUser);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    effacerPreuve();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Un seul renouvellement à la fois : plusieurs requêtes qui expirent ensemble attendent
  // le même renouvellement, au lieu d'envoyer chacune l'ancien jeton (le second envoi était
  // refusé et déconnectait la personne).
  const renouvellementEnCours = useRef<Promise<string | null> | null>(null);
  const silentRefresh = useCallback((): Promise<string | null> => {
    if (renouvellementEnCours.current) return renouvellementEnCours.current;
    const enCours = (async () => {
      try {
        const result = await refreshRequest();
        if (!result) {
          clearSession();
          return null;
        }
        applySession(result.accessToken, result.user);
        return result.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        renouvellementEnCours.current = null;
      }
    })();
    renouvellementEnCours.current = enCours;
    return enCours;
  }, [applySession, clearSession]);

  useEffect(() => {
    registerAuthHooks(() => accessTokenRef.current, silentRefresh);
    void silentRefresh();
    // Rafraîchissement silencieux uniquement au montage — les 401 en cours de session
    // sont gérés par lib/api/client (apiFetch), pas ici.
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginProxyResult> => {
    const result = await loginRequest(email, password);
    if (result.status === 'authenticated') {
      applySession(result.accessToken, result.user);
      router.push(consommerSuite());
    } else {
      setPendingChallenge({ type: result.status, token: result.status === 'two_fa_challenge_required' ? result.challengeToken : result.setupToken });
      router.push('/login/2fa');
    }
    return result;
  }, [applySession, router]);

  const submitTwoFaCode = useCallback(async (code: string): Promise<void> => {
    if (!pendingChallenge) throw new Error('Aucune vérification en attente.');
    const result =
      pendingChallenge.type === 'two_fa_challenge_required'
        ? await loginTwoFaRequest(pendingChallenge.token, code)
        : await enableTwoFaRequest(pendingChallenge.token, code);
    setPendingChallenge(null);
    applySession(result.accessToken, result.user);
    router.push(consommerSuite());
  }, [pendingChallenge, applySession, router]);

  const logout = useCallback(async (): Promise<void> => {
    marquerDeconnexionVolontaire();
    await logoutRequest();
    clearSession();
    router.push('/');
  }, [clearSession, router]);

  return (
    <AuthContext.Provider value={{ status, user, pendingChallenge, login, submitTwoFaCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider.');
  return ctx;
}

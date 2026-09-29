'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, definirPreuve, registerReauthHook } from '../api/client';
import { Fenetre } from '../../components/ui/Fenetre';
import { Field } from '../../components/ui/Input';

/**
 * Fenêtre « Confirmez votre identité » (socle N2, §4.4) : ouverte par apiFetch quand l'API
 * demande une réauthentification avant un objet protégé, ou par un bouton « Afficher les données
 * protégées ». Mot de passe, et code de l'application si la double authentification est active.
 */
export function ReauthProvider({ children }: { children: React.ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [codeDemande, setCodeDemande] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const attente = useRef<((ok: boolean) => void)[]>([]);

  const terminer = useCallback((ok: boolean) => {
    attente.current.splice(0).forEach((r) => r(ok));
    setOuverte(false);
    setMotDePasse('');
    setCode('');
    setErreur(null);
    setEnCours(false);
  }, []);

  useEffect(() => {
    registerReauthHook(
      () =>
        new Promise<boolean>((resolve) => {
          attente.current.push(resolve);
          setOuverte(true);
        }),
    );
  }, []);

  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await apiFetch<{ preuve: string; expireLe: string }>('/api/v1/reauthentification', {
        method: 'POST',
        body: JSON.stringify({ motDePasse, ...(code.trim() ? { code: code.trim() } : {}) }),
      });
      definirPreuve(r.preuve, r.expireLe);
      terminer(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CODE_2FA_REQUIS') setCodeDemande(true);
      setErreur(e instanceof Error ? e.message : 'Vérification impossible');
      setEnCours(false);
    }
  };

  return (
    <>
      {children}
      {ouverte && (
        <Fenetre titre="Confirmez votre identité" onClose={() => terminer(false)} onSubmit={envoyer} enCours={enCours} erreur={erreur} libelleValider="Confirmer">
          <p className="mb-4 text-[13px] text-text-muted">
            Cet élément est protégé. Saisissez votre mot de passe pour l’ouvrir ; la confirmation reste valable 10 minutes.
          </p>
          <Field label="Votre mot de passe" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
          {codeDemande && (
            <Field label="Code de l’application d’authentification" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          )}
        </Fenetre>
      )}
    </>
  );
}

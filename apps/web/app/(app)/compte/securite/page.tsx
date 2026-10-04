'use client';

import { useCallback, useEffect, useState } from 'react';
import { activerDoubleAuth, configurerDoubleAuth, desactiverDoubleAuth, getStatutDoubleAuth } from '../../../../lib/api/auth';
import { Erreur, SELECT_CLASS, messageErreur } from '../../../../components/courrier/ui';
import { Chargement, ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { Bandeau, BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage, Pastille } from '../../../../components/ui/Charte';

/**
 * Sécurité du compte (§3.3) : la double authentification est facultative pour
 * tous ; chacun l'active (QR code + premier code) ou la désactive (code
 * courant exigé). En cas de téléphone perdu, l'administrateur la réinitialise.
 */
export default function SecuritePage() {
  const [statut, setStatut] = useState<{ enabled: boolean } | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [qr, setQr] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    getStatutDoubleAuth()
      .then(setStatut)
      .catch((e) => setErreurChargement(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  async function agir(fn: () => Promise<unknown>, ok: string) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      setInfo(ok);
      setCode('');
      setQr(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Action impossible'));
    } finally {
      setEnCours(false);
    }
  }

  async function commencer() {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      setQr(await configurerDoubleAuth());
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de générer le QR code'));
    } finally {
      setEnCours(false);
    }
  }

  const champCode = (
    <div className="mb-3">
      <label htmlFor="code-2fa" className="mb-1.5 block text-[12.5px] font-semibold">
        Code à 6 chiffres affiché par l’application
      </label>
      <input
        id="code-2fa"
        className={`${SELECT_CLASS} !w-40 tracking-[0.3em]`}
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
      />
    </div>
  );

  return (
    <div className="max-w-[640px]">
      <EnTetePage titre="Sécurité du compte" />
      <ErreurChargement message={erreurChargement} />
      {!statut ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <section className="rounded-xl border border-line bg-surface p-5" data-testid="double-auth">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[15.5px] font-bold text-ink-900">Double authentification</h2>
            <Pastille ton={statut.enabled ? 'vert' : 'gris'}>{statut.enabled ? 'Activée' : 'Désactivée'}</Pastille>
          </div>
          <p className="mb-4 text-[13px] text-text-muted">
            En plus du mot de passe, un code à 6 chiffres donné par une application de votre téléphone (Google Authenticator, Microsoft
            Authenticator, FreeOTP…) est demandé à chaque connexion. Facultative, mais conseillée pour les comptes de direction.
          </p>
          <Erreur message={erreur} />
          {info && <Bandeau ton="vert">{info}</Bandeau>}

          {!statut.enabled && !qr && (
            <button type="button" className={BTN_PRINCIPAL} disabled={enCours} onClick={commencer}>
              Activer la double authentification
            </button>
          )}

          {!statut.enabled && qr && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void agir(() => activerDoubleAuth(code), 'Double authentification activée : le code sera demandé à votre prochaine connexion.');
              }}
            >
              <ol className="mb-3 list-decimal pl-5 text-[13px]">
                <li>Ouvrez l’application d’authentification de votre téléphone et ajoutez un compte.</li>
                <li>Scannez ce QR code (ou saisissez la clé affichée dessous).</li>
                <li>Saisissez le code à 6 chiffres qu’elle affiche.</li>
              </ol>
              <div className="mb-3 inline-block rounded-[10px] border border-line bg-[#FAFBFD] p-3 text-center">
                <img src={qr.qrCodeDataUrl} alt="QR code de la double authentification" className="mx-auto h-40 w-40" />
                <p className="mt-2 break-all font-mono text-[11px]" data-testid="cle-manuelle">
                  {qr.secret}
                </p>
              </div>
              {champCode}
              <button type="submit" className={BTN_PRINCIPAL} disabled={enCours || code.length !== 6}>
                Confirmer l’activation
              </button>
            </form>
          )}

          {statut.enabled && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void agir(() => desactiverDoubleAuth(code), 'Double authentification désactivée.');
              }}
            >
              <p className="mb-3 text-[13px]">Pour la désactiver, saisissez un code actuel de votre application.</p>
              {champCode}
              <button type="submit" className={BTN_SECONDAIRE} disabled={enCours || code.length !== 6}>
                Désactiver
              </button>
              <p className="mt-3 text-[12px] text-text-muted">Téléphone perdu ou changé ? Demandez à l’administrateur système de réinitialiser votre double authentification.</p>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

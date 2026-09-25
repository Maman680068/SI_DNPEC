'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { setupTwoFaRequest } from '../../lib/api/auth';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function TwoFactorForm() {
  const router = useRouter();
  const { status, pendingChallenge, submitTwoFaCode } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  // POST /auth/2fa/setup n'est pas idempotent (il régénère et écrase le secret TOTP à
  // chaque appel) : un ref évite un double appel concurrent sous StrictMode (dev), qui
  // écraserait en base le secret correspondant au QR code déjà affiché à l'écran.
  const setupCalledRef = useRef(false);

  const isFirstTimeSetup = pendingChallenge?.type === 'two_fa_setup_required';

  useEffect(() => {
    // Sans vérification en attente, retour à la connexion — sauf si le code
    // vient d'être accepté : AuthProvider conduit alors à la page visée
    // (sinon cette redirection l'écraserait et on retomberait sur /login).
    if (!pendingChallenge) {
      if (status !== 'authenticated') router.replace('/login');
      return;
    }
    if (pendingChallenge.type === 'two_fa_setup_required' && !setupCalledRef.current) {
      setupCalledRef.current = true;
      setupTwoFaRequest(pendingChallenge.token)
        .then((res) => {
          setQrCodeDataUrl(res.qrCodeDataUrl);
          setSecret(res.secret);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de démarrer la configuration 2FA'));
    }
    // pendingChallenge.token ne change jamais pour un même challenge : un seul appel voulu.
  }, [pendingChallenge?.type, status]);

  if (!pendingChallenge) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitTwoFaCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code de vérification invalide');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1.5 text-[23px] font-semibold">Vérification en deux étapes</h2>
      <p className="mb-8 text-sm text-text-muted">
        {isFirstTimeSetup
          ? 'Scannez ce QR code avec votre application d’authentification, puis saisissez le code généré.'
          : 'Saisissez le code affiché par votre application d’authentification.'}
      </p>

      {isFirstTimeSetup && (
        <div className="mb-6 rounded-md bg-gold-soft px-3.5 py-3.5 text-center">
          {qrCodeDataUrl ? (
            <img src={qrCodeDataUrl} alt="QR code d'authentification à deux facteurs" className="mx-auto h-40 w-40" />
          ) : (
            <p className="text-[12.5px] text-ink">Génération du QR code…</p>
          )}
          {secret && (
            <p className="mt-2 break-all text-[11px] text-ink/80">Clé manuelle : {secret}</p>
          )}
        </div>
      )}

      <Field
        label="Code de vérification"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoComplete="one-time-code"
      />

      {error && (
        <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>
      )}

      <Button type="submit" variant="solid" className="w-full" disabled={submitting}>
        {submitting ? 'Vérification…' : 'Valider'}
      </Button>
    </form>
  );
}

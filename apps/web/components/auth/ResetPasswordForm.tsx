'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPasswordRequest } from '../../lib/api/auth';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!token) {
    return (
      <div>
        <h2 className="mb-1.5 text-[23px] font-semibold">Lien invalide</h2>
        <p className="mb-6 text-sm text-text-muted">
          Ce lien de réinitialisation est incomplet. Demandez-en un nouveau depuis l’écran de
          connexion.
        </p>
        <Link href="/forgot-password" className="text-[13px] font-semibold text-accent hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div>
        <h2 className="mb-1.5 text-[23px] font-semibold">Mot de passe mis à jour</h2>
        <p className="mb-6 text-sm text-text-muted">
          Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter avec votre
          nouveau mot de passe.
        </p>
        <Button variant="solid" className="w-full" onClick={() => router.push('/login')}>
          Se connecter
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordRequest(token as string, newPassword);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de réinitialiser le mot de passe');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1.5 text-[23px] font-semibold">Nouveau mot de passe</h2>
      <p className="mb-8 text-sm text-text-muted">Choisissez un nouveau mot de passe pour votre compte.</p>

      <Field
        label="Nouveau mot de passe"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        minLength={12}
        required
        autoComplete="new-password"
      />
      <p className="-mt-3 mb-4 text-[11.5px] text-text-faint">12 caractères minimum.</p>
      <Field
        label="Confirmer le mot de passe"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        minLength={12}
        required
        autoComplete="new-password"
      />

      {error && (
        <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>
      )}

      <Button type="submit" variant="solid" className="w-full" disabled={submitting}>
        {submitting ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
      </Button>
    </form>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { forgotPasswordRequest } from '../../lib/api/auth';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPasswordRequest(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de traiter cette demande');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <h2 className="mb-1.5 text-[23px] font-semibold">Vérifiez votre boîte mail</h2>
        <p className="mb-6 text-sm text-text-muted">
          Si un compte existe avec l’adresse <strong>{email}</strong>, un email contenant un lien
          de réinitialisation vient de vous être envoyé. Ce lien est valable une heure.
        </p>
        <Link href="/login" className="text-[13px] font-semibold text-accent hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1.5 text-[23px] font-semibold">Mot de passe oublié</h2>
      <p className="mb-8 text-sm text-text-muted">
        Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de
        passe.
      </p>

      <Field
        label="Adresse e-mail"
        type="email"
        placeholder="prenom.nom@exemple.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      {error && (
        <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>
      )}

      <Button type="submit" variant="solid" className="w-full" disabled={submitting}>
        {submitting ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
      </Button>

      <p className="mt-5 text-center text-[13px] text-text-muted">
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}

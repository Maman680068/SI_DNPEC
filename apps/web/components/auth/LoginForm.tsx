'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthProvider';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';
import { OrDivider } from './OrDivider';
import { SecondaryAuthLink } from './SecondaryAuthLink';

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1.5 text-[23px] font-semibold">Connexion</h2>
      <p className="mb-8 text-sm text-text-muted">Accédez à votre espace de travail DNPEC.</p>

      <Field
        label="Adresse e-mail"
        type="email"
        placeholder="prenom.nom@exemple.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Field
        label="Mot de passe"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <div className="-mt-2 mb-4 text-right">
        <Link href="/forgot-password" className="text-[12.5px] font-semibold text-accent hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>
      )}

      <Button type="submit" variant="solid" className="w-full" disabled={submitting}>
        {submitting ? 'Connexion…' : 'Se connecter'}
      </Button>

      <OrDivider />

      <SecondaryAuthLink href="/register">Demander l’accès →</SecondaryAuthLink>
    </form>
  );
}

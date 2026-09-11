'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  getRegistrationOrgOptionsRequest,
  getRegistrationSupervisorOptionsRequest,
  registerRequest,
} from '../../lib/api/auth';
import type { RegistrationOrgOptions, RegistrationSupervisorOption } from '../../lib/auth/types';
import { DeclaredAttachmentFields, type DeclaredAttachment } from './DeclaredAttachmentFields';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';
import { OrDivider } from './OrDivider';
import { SecondaryAuthLink } from './SecondaryAuthLink';

const EMPTY_DECLARATION: DeclaredAttachment = {
  declaredDivisionId: null,
  declaredSectionId: null,
  declaredCelluleId: null,
  declaredSupervisorId: null,
};

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [declaration, setDeclaration] = useState<DeclaredAttachment>(EMPTY_DECLARATION);
  const [orgOptions, setOrgOptions] = useState<RegistrationOrgOptions | null>(null);
  const [supervisorOptions, setSupervisorOptions] = useState<RegistrationSupervisorOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getRegistrationOrgOptionsRequest()
      .then(setOrgOptions)
      .catch(() => setOrgOptions({ divisions: [], cellules: [] }));
    getRegistrationSupervisorOptionsRequest()
      .then(setSupervisorOptions)
      .catch(() => setSupervisorOptions([]));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerRequest({
        email,
        password,
        firstName,
        lastName,
        declaredDivisionId: declaration.declaredDivisionId ?? undefined,
        declaredSectionId: declaration.declaredSectionId ?? undefined,
        declaredCelluleId: declaration.declaredCelluleId ?? undefined,
        declaredSupervisorId: declaration.declaredSupervisorId ?? undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le compte');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <h2 className="mb-1.5 text-[23px] font-semibold">Demande envoyée</h2>
        <p className="mb-6 text-sm text-text-muted">
          Votre demande est en attente de validation par un administrateur. Vous recevrez un accès
          dès qu’elle aura été approuvée.
        </p>
        <Link href="/login" className="text-[13px] font-semibold text-accent hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1.5 text-[23px] font-semibold">Demander l’accès</h2>
      <p className="mb-8 text-sm text-text-muted">
        Votre demande sera examinée par un administrateur avant activation du compte.
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
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
        />
        <Field
          label="Nom"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          autoComplete="family-name"
        />
      </div>
      <Field
        label="Mot de passe"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={12}
        required
        autoComplete="new-password"
      />
      <p className="-mt-3 mb-4 text-[11.5px] text-text-faint">12 caractères minimum.</p>

      {orgOptions &&
        (orgOptions.divisions.length > 0 || orgOptions.cellules.length > 0 || supervisorOptions.length > 0) && (
          <DeclaredAttachmentFields
            divisions={orgOptions.divisions}
            cellules={orgOptions.cellules}
            supervisors={supervisorOptions}
            value={declaration}
            onChange={setDeclaration}
          />
        )}

      {error && (
        <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>
      )}

      <Button type="submit" variant="solid" className="w-full" disabled={submitting}>
        {submitting ? 'Envoi…' : 'Envoyer la demande'}
      </Button>

      <OrDivider />

      <SecondaryAuthLink href="/login">Se connecter →</SecondaryAuthLink>
    </form>
  );
}

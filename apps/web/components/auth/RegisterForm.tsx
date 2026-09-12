'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  getRegistrationOrgOptionsRequest,
  getRegistrationSupervisorOptionsRequest,
  registerRequest,
} from '../../lib/api/auth';
import { DECLARABLE_ROLES, DECLARABLE_ROLE_LABEL } from '../../lib/auth/types';
import type { RegistrationOrgOptions, RegistrationSupervisorOption } from '../../lib/auth/types';
import { DeclaredAttachmentFields, type DeclaredAttachment, type Mode } from './DeclaredAttachmentFields';
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

const ALL_MODES: Mode[] = ['division', 'cellule', 'supervisor'];

// Onglets pertinents de "Votre situation actuelle" selon le poste déclaré —
// DN et DNA en sont délibérément absents : ce niveau ne déclare aucun
// rattachement, voir showAttachmentSection ci-dessous.
const ATTACHMENT_MODES_BY_ROLE: Record<string, Mode[]> = {
  AGENT: ['division', 'cellule'],
  CHEF_SECTION: ['division'],
  CHEF_DIVISION: ['division'],
  CHEF_CELLULE: ['cellule'],
  ASSISTANT_DIRECTION: ['supervisor'],
};

function modeOf(declaration: DeclaredAttachment): Mode | null {
  if (declaration.declaredCelluleId) return 'cellule';
  if (declaration.declaredSupervisorId) return 'supervisor';
  if (declaration.declaredDivisionId) return 'division';
  return null;
}

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [declaredRole, setDeclaredRole] = useState('');
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

  // DN/DNA ne déclarent aucun rattachement (aucun sens à ce niveau) — la
  // section "Votre situation actuelle" disparaît entièrement pour eux.
  const showAttachmentSection = declaredRole !== 'DN' && declaredRole !== 'DNA';
  const allowedModes = ATTACHMENT_MODES_BY_ROLE[declaredRole] ?? ALL_MODES;

  function handleDeclaredRoleChange(next: string) {
    setDeclaredRole(next);
    const hideSection = next === 'DN' || next === 'DNA';
    const nextModes = hideSection ? [] : (ATTACHMENT_MODES_BY_ROLE[next] ?? ALL_MODES);
    const currentMode = modeOf(declaration);
    // Si l'onglet déjà rempli n'a plus de sens pour le nouveau poste (ou que
    // la section disparaît entièrement), on réinitialise plutôt que de
    // soumettre une valeur incohérente cachée derrière un onglet disparu.
    if (currentMode && !nextModes.includes(currentMode)) {
      setDeclaration(EMPTY_DECLARATION);
    }
  }

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
        declaredRole,
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

      <div className="mb-4">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Poste actuel</label>
        <select
          value={declaredRole}
          onChange={(e) => handleDeclaredRoleChange(e.target.value)}
          required
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">— Sélectionner votre poste actuel —</option>
          {DECLARABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {DECLARABLE_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {showAttachmentSection && orgOptions && (
        <DeclaredAttachmentFields
          divisions={orgOptions.divisions}
          cellules={orgOptions.cellules}
          supervisors={supervisorOptions}
          allowedModes={allowedModes}
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

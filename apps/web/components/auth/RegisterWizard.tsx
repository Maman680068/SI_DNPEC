'use client';

import { Fragment, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  getRegistrationOrgOptionsRequest,
  getRegistrationSupervisorOptionsRequest,
  registerRequest,
} from '../../lib/api/auth';
import { DECLARABLE_ROLES, DECLARABLE_ROLE_LABEL, type DeclarableRole } from '../../lib/auth/types';
import type { RegistrationOrgOptions, RegistrationSupervisorOption } from '../../lib/auth/types';
import { DeclaredAttachmentFields, supervisorLabel, type DeclaredAttachment, type Mode } from './DeclaredAttachmentFields';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

const EMPTY_DECLARATION: DeclaredAttachment = {
  declaredDivisionId: null,
  declaredSectionId: null,
  declaredCelluleId: null,
  declaredSupervisorId: null,
};

const ALL_MODES: Mode[] = ['division', 'cellule', 'supervisor'];

// Onglets pertinents de "Votre situation actuelle" selon le poste déclaré —
// DN et DNA en sont délibérément absents : ce niveau ne déclare aucun
// rattachement, voir showAttachmentSection ci-dessous. Logique identique à
// l'ancien RegisterForm.tsx, simplement portée dans le wizard.
const ATTACHMENT_MODES_BY_ROLE: Record<string, Mode[]> = {
  AGENT: ['division', 'cellule'],
  CHEF_SECTION: ['division'],
  CHEF_DIVISION: ['division'],
  CHEF_CELLULE: ['cellule'],
  ASSISTANT_DIRECTION: ['supervisor'],
};

// Un Chef de Division n'est jamais rattaché à une section précise (il dirige
// la division entière) : Section disparaît complètement pour ce poste, reste
// visible et facultative pour un Agent, visible et obligatoire pour un Chef
// de Section — même règle que le pendant admin, OrgAttachmentFields.attachmentKind.
const SECTION_RULE_BY_ROLE: Record<string, { showSection: boolean; sectionRequired: boolean }> = {
  AGENT: { showSection: true, sectionRequired: false },
  CHEF_SECTION: { showSection: true, sectionRequired: true },
  CHEF_DIVISION: { showSection: false, sectionRequired: false },
};
const DEFAULT_SECTION_RULE = { showSection: true, sectionRequired: false };

function modeOf(declaration: DeclaredAttachment): Mode | null {
  if (declaration.declaredCelluleId) return 'cellule';
  if (declaration.declaredSupervisorId) return 'supervisor';
  if (declaration.declaredDivisionId) return 'division';
  return null;
}

const STEP_LABELS = ['E-mail', 'Identité', 'Poste', 'Récapitulatif'] as const;
const TOTAL_STEPS = STEP_LABELS.length;

const STEP_META: Record<number, { icon: string; title: string; subtitle: string }> = {
  1: {
    icon: '✉',
    title: 'Votre adresse e-mail',
    subtitle: 'Utilisée pour vous connecter et recevoir les notifications',
  },
  2: {
    icon: '👤',
    title: 'Votre identité',
    subtitle: 'Comment devons-nous vous appeler, et comment sécuriser votre compte ?',
  },
  3: {
    icon: '🏢',
    title: 'Poste et rattachement',
    subtitle: 'Aide l’administrateur à vérifier votre demande et à choisir le bon rôle',
  },
  4: {
    icon: '📋',
    title: 'Récapitulatif',
    subtitle: 'Vérifiez vos informations avant l’envoi',
  },
};

function TopBar() {
  return (
    <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3 sm:px-10">
      <Link href="/" className="flex items-center gap-2.5">
        <img src="/logo-dnpec.png" alt="DNPEC" className="h-7 w-7 object-contain" />
        <span className="font-heading text-sm font-extrabold text-ink">DNPEC</span>
      </Link>
      <Link href="/login" className="text-[13px] font-bold text-text-muted hover:text-ink">
        ← Déjà inscrit ? Se connecter
      </Link>
    </div>
  );
}

export function RegisterWizard() {
  const [step, setStep] = useState(1);
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
  const sectionRule = SECTION_RULE_BY_ROLE[declaredRole] ?? DEFAULT_SECTION_RULE;

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

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  // Un seul <form> pour tout le wizard : seule l'étape courante est montée,
  // donc la validation native (required/type=email déjà posés sur les champs
  // réutilisés de DeclaredAttachmentFields/Field) ne porte jamais que sur ses
  // propres champs — le navigateur bloque "Continuer" et affiche l'erreur de
  // lui-même tant qu'ils ne sont pas valides, sans logique à dupliquer ici.
  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
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
      <div className="min-h-screen bg-bg">
        <TopBar />
        <div className="mx-auto max-w-[720px] px-4 pb-6 pt-5 sm:px-6 sm:pt-[22px]">
          <div className="mt-[18px] rounded-[14px] border border-line bg-surface p-8 text-center shadow-[0_14px_34px_-14px_rgba(27,42,107,0.14)]">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sage-soft text-xl text-sage">
              ✓
            </div>
            <h2 className="text-[19px] font-semibold">Demande envoyée</h2>
            <p className="mx-auto mt-2 max-w-[420px] text-sm text-text-muted">
              Votre demande est en attente de validation par un administrateur. Vous recevrez un accès
              dès qu’elle aura été approuvée.
            </p>
            <Link href="/login" className="mt-5 inline-block text-[13px] font-semibold text-accent hover:underline">
              Retour à la connexion
            </Link>
          </div>
          <p className="mt-4 text-center text-[11.5px] font-medium text-text-faint">
            Ministère de l’Économie, des Finances et du Budget · République de Guinée
          </p>
        </div>
      </div>
    );
  }

  const meta = STEP_META[step] ?? STEP_META[1]!;

  // Récapitulatif (étape 4) — dérivé des mêmes données que DeclaredAttachmentFields
  // affiche déjà, pour ne rien recalculer différemment.
  const selectedDivision = orgOptions?.divisions.find((d) => d.id === declaration.declaredDivisionId) ?? null;
  const selectedSection = selectedDivision?.sections.find((s) => s.id === declaration.declaredSectionId) ?? null;
  const selectedCellule = orgOptions?.cellules.find((c) => c.id === declaration.declaredCelluleId) ?? null;
  const selectedSupervisor = supervisorOptions.find((s) => s.id === declaration.declaredSupervisorId) ?? null;
  const attachmentSummary = !showAttachmentSection
    ? null
    : selectedSupervisor
      ? `Assiste ${supervisorLabel(selectedSupervisor)}`
      : selectedCellule
        ? selectedCellule.name
        : selectedDivision
          ? [selectedDivision.name, selectedSection?.name].filter(Boolean).join(' · ')
          : null;

  return (
    <div className="min-h-screen bg-bg">
      <TopBar />

      <div className="mx-auto max-w-[720px] px-4 pb-6 pt-5 sm:px-6 sm:pt-[22px]">
        <div className="mb-4 text-center sm:mb-5">
          <h1 className="text-[20px] sm:text-[22px]">Demande d’accès</h1>
          <p className="mx-auto mt-1.5 max-w-[520px] text-[13px] leading-relaxed text-text-muted">
            Créez votre compte — la demande sera examinée par un administrateur de la DNPEC avant
            activation.
          </p>
        </div>

        <div className="flex items-center">
          {STEP_LABELS.map((label, i) => {
            const idx = i + 1;
            const status = idx < step ? 'done' : idx === step ? 'active' : 'upcoming';
            return (
              <Fragment key={label}>
                <div className={`flex items-center gap-2 ${idx < TOTAL_STEPS ? 'flex-1' : 'flex-none'}`}>
                  <div
                    className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      status === 'done'
                        ? 'bg-sage text-white'
                        : status === 'active'
                          ? 'bg-ink text-white'
                          : 'bg-line text-text-faint'
                    }`}
                  >
                    {idx}
                  </div>
                  <div
                    className={`hidden whitespace-nowrap text-[11.5px] font-bold sm:block ${
                      status === 'upcoming' ? 'text-text-faint' : 'text-text'
                    }`}
                  >
                    {label}
                  </div>
                </div>
                {idx < TOTAL_STEPS && (
                  <div className={`mx-1.5 h-0.5 flex-1 ${status === 'done' ? 'bg-sage' : 'bg-line'}`} />
                )}
              </Fragment>
            );
          })}
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="mt-[18px] overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_14px_34px_-14px_rgba(27,42,107,0.14)]"
        >
          <div className="h-[3px] bg-line">
            <div
              className="h-full bg-ink transition-[width]"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-3 border-b border-line px-6 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-base text-ink">
              {meta.icon}
            </div>
            <div>
              <h2 className="text-[15.5px] font-semibold">{meta.title}</h2>
              <div className="mt-0.5 text-xs text-text-muted">{meta.subtitle}</div>
            </div>
          </div>

          <div className="px-6 py-5">
            {step === 1 && (
              <>
                <p className="mb-3.5 text-[12.5px] leading-relaxed text-text-muted">
                  Indiquez une adresse e-mail à laquelle vous avez accès. Elle servira d’identifiant de
                  connexion.
                </p>
                <Field
                  label="Adresse e-mail"
                  type="email"
                  placeholder="prenom.nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                    autoFocus
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
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <p className="-mt-3 text-[11.5px] text-text-faint">8 caractères minimum.</p>
              </>
            )}

            {step === 3 && (
              <>
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
                    showSection={sectionRule.showSection}
                    sectionRequired={sectionRule.sectionRequired}
                    value={declaration}
                    onChange={setDeclaration}
                  />
                )}
                {showAttachmentSection && !orgOptions && (
                  <p className="text-[12.5px] text-text-faint">Chargement…</p>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <dl className="space-y-2.5 text-[13.5px]">
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <dt className="font-semibold text-text-muted">E-mail</dt>
                    <dd className="text-text">{email}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <dt className="font-semibold text-text-muted">Identité</dt>
                    <dd className="text-text">
                      {firstName} {lastName}
                    </dd>
                  </div>
                  <div className={`flex items-center justify-between ${attachmentSummary ? 'border-b border-line pb-2.5' : ''}`}>
                    <dt className="font-semibold text-text-muted">Poste actuel</dt>
                    <dd className="text-text">
                      {declaredRole ? DECLARABLE_ROLE_LABEL[declaredRole as DeclarableRole] : '—'}
                    </dd>
                  </div>
                  {attachmentSummary && (
                    <div className="flex items-center justify-between">
                      <dt className="font-semibold text-text-muted">Rattachement</dt>
                      <dd className="text-text">{attachmentSummary}</dd>
                    </div>
                  )}
                </dl>

                {error && (
                  <div className="mt-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line bg-bg px-6 py-3.5">
            <div className="text-[12.5px] font-bold text-text-faint">
              Étape {step} / {TOTAL_STEPS}
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={goBack} disabled={submitting}>
                  ← Retour
                </Button>
              )}
              <Button type="submit" variant="solid" disabled={submitting}>
                {step < TOTAL_STEPS ? 'Continuer →' : submitting ? 'Envoi…' : 'Envoyer la demande'}
              </Button>
            </div>
          </div>
        </form>

        <p className="mt-4 text-center text-[11.5px] font-medium text-text-faint">
          Ministère de l’Économie, des Finances et du Budget · République de Guinée
        </p>
      </div>
    </div>
  );
}

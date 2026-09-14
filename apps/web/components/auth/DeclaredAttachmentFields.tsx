'use client';

import { useEffect, useState } from 'react';
import type {
  RegistrationCelluleOption,
  RegistrationDivisionOption,
  RegistrationSupervisorOption,
} from '../../lib/auth/types';

export interface DeclaredAttachment {
  declaredDivisionId: string | null;
  declaredSectionId: string | null;
  declaredCelluleId: string | null;
  declaredSupervisorId: string | null;
}

export type Mode = 'division' | 'cellule' | 'supervisor';

const SUPERVISOR_ROLE_LABEL: Record<string, string> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_CELLULE: 'Chef de Cellule',
};

export function supervisorLabel(option: RegistrationSupervisorOption): string {
  const roleLabel =
    option.role === 'CHEF_CELLULE' && option.celluleName
      ? `Chef de cellule ${option.celluleName}`
      : SUPERVISOR_ROLE_LABEL[option.role];
  return `${option.firstName} ${option.lastName} — ${roleLabel}`;
}

/**
 * Rattachement ACTUEL déclaré par la personne qui s'inscrit — une affirmation de
 * fait à vérifier par l'admin à l'approbation, pas une préférence (voir
 * schema.prisma, User.declaredDivisionId : jamais posé comme rattachement réel
 * tant que l'admin ne l'a pas confirmé). Obligatoire : AuthService.register
 * rejette une inscription sans Division ni Cellule déclarée.
 * Autonome (pas de useOrg()) car la page d'inscription est publique, avant
 * authentification : les options viennent de GET /auth/register/org-options.
 */
const EMPTY: DeclaredAttachment = {
  declaredDivisionId: null,
  declaredSectionId: null,
  declaredCelluleId: null,
  declaredSupervisorId: null,
};

const TAB_LABEL: Record<Mode, string> = {
  division: 'Division',
  cellule: 'Cellule transversale',
  supervisor: 'Assistant de direction',
};

export function DeclaredAttachmentFields({
  divisions,
  cellules,
  supervisors,
  allowedModes,
  showSection,
  sectionRequired,
  value,
  onChange,
}: {
  divisions: RegistrationDivisionOption[];
  cellules: RegistrationCelluleOption[];
  supervisors: RegistrationSupervisorOption[];
  allowedModes: Mode[];
  // Un Chef de Division n'est jamais rattaché à une section précise : le
  // poste déclaré (RegisterWizard, étape 3) décide si Section a un sens du
  // tout (showSection) et, si oui, si elle est obligatoire (Chef de
  // Section) ou facultative (Agent) — même vocabulaire que le pendant admin
  // OrgAttachmentFields (showSection/sectionRequired par rôle).
  showSection: boolean;
  sectionRequired: boolean;
  value: DeclaredAttachment;
  onChange: (next: DeclaredAttachment) => void;
}) {
  const [mode, setMode] = useState<Mode>(() => {
    const derived = value.declaredCelluleId ? 'cellule' : value.declaredSupervisorId ? 'supervisor' : 'division';
    return allowedModes.includes(derived) ? derived : (allowedModes[0] ?? 'division');
  });
  const selectedDivision = divisions.find((d) => d.id === value.declaredDivisionId);

  // Le poste déclaré (RegisterWizard, étape 3) restreint les onglets pertinents
  // — si le poste change et rend l'onglet actif invalide, on ne laisse jamais
  // une valeur incohérente cachée derrière un onglet qui a disparu.
  // allowedModes ne devrait jamais être vide ici : RegisterWizard ne monte ce
  // composant que pour un poste qui déclare un rattachement (voir
  // showAttachmentSection).
  useEffect(() => {
    if (!allowedModes.includes(mode)) {
      setMode(allowedModes[0] ?? 'division');
      onChange(EMPTY);
    }
  }, [allowedModes]);

  // Idem si Section disparaît (ex. Agent -> Chef de Division) alors qu'une
  // section était déjà choisie : on ne la laisse jamais posée en silence
  // derrière un champ qui n'existe plus.
  useEffect(() => {
    if (!showSection && value.declaredSectionId) {
      onChange({ ...value, declaredSectionId: null });
    }
  }, [showSection]);

  function switchMode(next: Mode) {
    setMode(next);
    onChange(EMPTY);
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
        Votre situation actuelle
      </label>

      <div className="mb-2.5 flex flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {allowedModes.map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => switchMode(key)}
            className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold ${
              mode === key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      {mode === 'division' && (
        <>
          <select
            value={value.declaredDivisionId ?? ''}
            onChange={(e) =>
              onChange({ ...EMPTY, declaredDivisionId: e.target.value || null })
            }
            required
            className="mb-2.5 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">— Sélectionner une division —</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {showSection && (
            <select
              value={value.declaredSectionId ?? ''}
              onChange={(e) => onChange({ ...value, declaredSectionId: e.target.value || null })}
              disabled={!selectedDivision}
              required={sectionRequired}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm disabled:opacity-50"
            >
              <option value="">{sectionRequired ? '— Sélectionner une section —' : '— Section (optionnel) —'}</option>
              {(selectedDivision?.sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {mode === 'cellule' && (
        <select
          value={value.declaredCelluleId ?? ''}
          onChange={(e) => onChange({ ...EMPTY, declaredCelluleId: e.target.value || null })}
          required
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">— Sélectionner une cellule —</option>
          {cellules.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {mode === 'supervisor' && (
        <>
          <select
            value={value.declaredSupervisorId ?? ''}
            onChange={(e) => onChange({ ...EMPTY, declaredSupervisorId: e.target.value || null })}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">— Sélectionner la personne assistée —</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {supervisorLabel(s)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11.5px] text-text-faint">
            Seuls le Directeur National, la Direction Nationale Adjointe et les Chefs de Cellule
            en poste peuvent être désignés.
          </p>
        </>
      )}
    </div>
  );
}

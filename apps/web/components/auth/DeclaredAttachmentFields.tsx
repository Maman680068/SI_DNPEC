'use client';

import { useState } from 'react';
import type { RegistrationCelluleOption, RegistrationDivisionOption } from '../../lib/auth/types';

export interface DeclaredAttachment {
  declaredDivisionId: string | null;
  declaredSectionId: string | null;
  declaredCelluleId: string | null;
}

type Mode = 'division' | 'cellule';

/**
 * Rattachement ACTUEL déclaré par la personne qui s'inscrit — une affirmation de
 * fait à vérifier par l'admin à l'approbation, pas une préférence (voir
 * schema.prisma, User.declaredDivisionId : jamais posé comme rattachement réel
 * tant que l'admin ne l'a pas confirmé). Obligatoire : AuthService.register
 * rejette une inscription sans Division ni Cellule déclarée.
 * Autonome (pas de useOrg()) car la page d'inscription est publique, avant
 * authentification : les options viennent de GET /auth/register/org-options.
 */
export function DeclaredAttachmentFields({
  divisions,
  cellules,
  value,
  onChange,
}: {
  divisions: RegistrationDivisionOption[];
  cellules: RegistrationCelluleOption[];
  value: DeclaredAttachment;
  onChange: (next: DeclaredAttachment) => void;
}) {
  const [mode, setMode] = useState<Mode>(value.declaredCelluleId ? 'cellule' : 'division');
  const selectedDivision = divisions.find((d) => d.id === value.declaredDivisionId);

  function switchMode(next: Mode) {
    setMode(next);
    onChange({ declaredDivisionId: null, declaredSectionId: null, declaredCelluleId: null });
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
        Votre division ou cellule actuelle
      </label>
      <p className="mb-2 text-[11.5px] text-text-faint">
        Indiquez où vous travaillez actuellement à la DNPEC. Un administrateur vérifiera cette
        information avant d’activer votre compte.
      </p>

      <div className="mb-2.5 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            { key: 'division', label: 'Division' },
            { key: 'cellule', label: 'Cellule transversale' },
          ] as const
        ).map((option) => (
          <button
            type="button"
            key={option.key}
            onClick={() => switchMode(option.key)}
            className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold ${
              mode === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === 'division' ? (
        <>
          <select
            value={value.declaredDivisionId ?? ''}
            onChange={(e) =>
              onChange({
                declaredDivisionId: e.target.value || null,
                declaredSectionId: null,
                declaredCelluleId: null,
              })
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
          <select
            value={value.declaredSectionId ?? ''}
            onChange={(e) => onChange({ ...value, declaredSectionId: e.target.value || null })}
            disabled={!selectedDivision}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm disabled:opacity-50"
          >
            <option value="">— Section (optionnel) —</option>
            {(selectedDivision?.sections ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <select
          value={value.declaredCelluleId ?? ''}
          onChange={(e) =>
            onChange({
              declaredDivisionId: null,
              declaredSectionId: null,
              declaredCelluleId: e.target.value || null,
            })
          }
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
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { getRegistrationSupervisorOptionsRequest } from '../../lib/api/auth';
import type { RegistrationSupervisorOption, SystemRole } from '../../lib/auth/types';
import type { OrgAttachment } from '../../lib/users/types';

type Kind = 'none' | 'division' | 'division_section' | 'cellule' | 'cellule_optional' | 'agent' | 'supervisor';
type AgentMode = 'division' | 'cellule';

const EMPTY: OrgAttachment = { divisionId: null, sectionId: null, celluleId: null, supervisorId: null };

const SUPERVISOR_ROLE_LABEL: Record<string, string> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_CELLULE: 'Chef de Cellule',
};

function supervisorLabel(option: RegistrationSupervisorOption): string {
  const roleLabel =
    option.role === 'CHEF_CELLULE' && option.celluleName
      ? `Chef de cellule ${option.celluleName}`
      : SUPERVISOR_ROLE_LABEL[option.role];
  return `${option.firstName} ${option.lastName} — ${roleLabel}`;
}

/** Reflète l'invariant documenté dans schema.prisma (User, §2.3) : quel rattachement
 * organisationnel un rôle accepte, pour construire le bon jeu de champs. */
function attachmentKind(role: SystemRole): Kind {
  switch (role) {
    case 'DN':
    case 'DNA':
      return 'none';
    case 'ASSISTANT_DIRECTION':
      return 'supervisor';
    case 'CHEF_DIVISION':
      return 'division';
    case 'CHEF_SECTION':
      return 'division_section';
    case 'CHEF_CELLULE':
      return 'cellule';
    case 'ADMIN_SYSTEME':
      return 'cellule_optional';
    case 'AGENT':
      return 'agent';
  }
}

/**
 * Champs Division/Section/Cellule adaptés au rôle sélectionné — partagé entre la
 * création manuelle et l'approbation d'une inscription (les deux fixent role +
 * rattachement ensemble). Purement contrôlé : le parent porte `value`.
 */
export function OrgAttachmentFields({
  role,
  value,
  onChange,
}: {
  role: SystemRole;
  value: OrgAttachment;
  onChange: (next: OrgAttachment) => void;
}) {
  const { divisions, sections, cellules } = useOrg();
  const kind = attachmentKind(role);
  const [agentMode, setAgentMode] = useState<AgentMode>(value.celluleId ? 'cellule' : 'division');
  const [supervisorOptions, setSupervisorOptions] = useState<RegistrationSupervisorOption[]>([]);

  // Même endpoint public que l'inscription (GET /auth/register/supervisor-options) —
  // pas de duplication de la logique de filtrage DN/DNA/Chef de Cellule actif.
  useEffect(() => {
    if (kind !== 'supervisor') return;
    getRegistrationSupervisorOptionsRequest()
      .then(setSupervisorOptions)
      .catch(() => setSupervisorOptions([]));
  }, [kind]);

  // Un changement de rôle change la "famille" de rattachement acceptée — repartir
  // d'un état vide évite de soumettre un divisionId/celluleId devenu incohérent
  // avec le nouveau rôle (ex. CHEF_DIVISION -> CHEF_CELLULE en gardant divisionId).
  // Sauf au tout premier montage : `value` peut alors être pré-rempli délibérément
  // (ex. ApproveRegistrationModal, avec le rattachement déclaré à l'inscription).
  // Comparer à la valeur précédente de `kind` (plutôt qu'un simple drapeau "premier
  // rendu") résiste au double-appel des effets du Strict Mode en dev : ce drapeau se
  // ferait autrement basculer par le second appel, qui déclencherait alors une
  // réinitialisation juste après le montage.
  const previousKind = useRef<Kind | null>(null);
  useEffect(() => {
    if (previousKind.current !== null && previousKind.current !== kind) {
      onChange(EMPTY);
    }
    previousKind.current = kind;
  }, [kind]);

  if (kind === 'none') {
    return (
      <p className="mb-4 rounded-md bg-bg px-3.5 py-2.5 text-[12.5px] text-text-faint">
        Ce rôle n’a pas de rattachement Division/Section/Cellule (direction générale).
      </p>
    );
  }

  const showDivision = kind === 'division' || kind === 'division_section' || (kind === 'agent' && agentMode === 'division');
  const showSection = kind === 'division_section' || (kind === 'agent' && agentMode === 'division');
  const showCellule = kind === 'cellule' || kind === 'cellule_optional' || (kind === 'agent' && agentMode === 'cellule');
  const showSupervisor = kind === 'supervisor';
  const divisionRequired = kind === 'division' || kind === 'division_section' || (kind === 'agent' && agentMode === 'division');
  const sectionRequired = kind === 'division_section';
  const celluleRequired = kind === 'cellule';
  const sectionsForDivision = sections.filter((s) => s.divisionId === value.divisionId);

  return (
    <div className="mb-4">
      {kind === 'agent' && (
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
              onClick={() => {
                setAgentMode(option.key);
                onChange(EMPTY);
              }}
              className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold ${
                agentMode === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {showDivision && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Division {divisionRequired && <span className="text-clay">*</span>}
          </label>
          <select
            value={value.divisionId ?? ''}
            onChange={(e) => onChange({ ...EMPTY, divisionId: e.target.value || null })}
            required={divisionRequired}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showSection && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Section {sectionRequired && <span className="text-clay">*</span>}
          </label>
          <select
            value={value.sectionId ?? ''}
            onChange={(e) => onChange({ ...value, sectionId: e.target.value || null })}
            required={sectionRequired}
            disabled={!value.divisionId}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm disabled:opacity-50"
          >
            <option value="">{sectionRequired ? '— Sélectionner —' : '— Aucune (optionnel) —'}</option>
            {sectionsForDivision.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showCellule && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Cellule {celluleRequired && <span className="text-clay">*</span>}
          </label>
          <select
            value={value.celluleId ?? ''}
            onChange={(e) => onChange({ ...EMPTY, celluleId: e.target.value || null })}
            required={celluleRequired}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {cellules.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showSupervisor && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Personne assistée <span className="text-clay">*</span>
          </label>
          <select
            value={value.supervisorId ?? ''}
            onChange={(e) => onChange({ ...EMPTY, supervisorId: e.target.value || null })}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {supervisorOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {supervisorLabel(s)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

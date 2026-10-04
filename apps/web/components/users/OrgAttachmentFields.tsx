'use client';

import { useEffect, useRef, useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { getRegistrationSupervisorOptionsRequest } from '../../lib/api/auth';
import type { RegistrationSupervisorOption, SystemRole } from '../../lib/auth/types';
import type { OrgAttachment } from '../../lib/users/types';
import { ChoixSegment, Grille2, Liste, SelecteurPersonnes } from '../ui/Formulaire';

type Kind = 'none' | 'division' | 'division_section' | 'cellule' | 'cellule_optional' | 'agent' | 'stagiaire' | 'supervisor';
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

/** Reflète l'invariant documenté dans schema.prisma (User, §2.1) : quel rattachement
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
    // DRH : fonction transversale comme ADMIN_SYSTEME (aucune contrainte de
    // rattachement côté API) — typiquement la cellule RH, facultative.
    case 'DRH':
      return 'cellule_optional';
    case 'AGENT':
      return 'agent';
    // Stagiaire : mêmes champs qu'un Chargé d'Études, mais facultatifs (la
    // rotation du stage tient le rattachement à jour).
    case 'STAGIAIRE':
      return 'stagiaire';
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
  const { divisions: allDivisions, sections: allSections, cellules: allCellules } = useOrg();
  // Une unité suspendue (§2.3) est exclue des listes de sélection pour tout
  // nouveau rattachement — bloqué côté API de toute façon (UsersService.
  // assertUnitsActiveForNewAttachment), filtré ici pour ne pas proposer un choix
  // que le serveur refusera.
  const divisions = allDivisions.filter((d) => d.isActive);
  const sections = allSections.filter((s) => s.isActive);
  const cellules = allCellules.filter((c) => c.isActive);
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
      <p className="mb-3.5 rounded-[10px] bg-bg px-3.5 py-2.5 text-[12.5px] text-text-muted">
        Ce rôle n’a pas de rattachement Division/Section/Cellule (direction générale).
      </p>
    );
  }

  const showDivision = kind === 'division' || kind === 'division_section' || ((kind === 'agent' || kind === 'stagiaire') && agentMode === 'division');
  const showSection = kind === 'division_section' || ((kind === 'agent' || kind === 'stagiaire') && agentMode === 'division');
  const showCellule = kind === 'cellule' || kind === 'cellule_optional' || ((kind === 'agent' || kind === 'stagiaire') && agentMode === 'cellule');
  const showSupervisor = kind === 'supervisor';
  const divisionRequired = kind === 'division' || kind === 'division_section' || (kind === 'agent' && agentMode === 'division');
  const sectionRequired = kind === 'division_section';
  const celluleRequired = kind === 'cellule';
  const sectionsForDivision = sections.filter((s) => s.divisionId === value.divisionId);

  return (
    <div className="min-w-0">
      {kind === 'stagiaire' && (
        <p className="mb-2 text-[12px] text-text-muted">Facultatif : la rotation du stage met ce rattachement à jour à chaque période.</p>
      )}
      {(kind === 'agent' || kind === 'stagiaire') && (
        <ChoixSegment<AgentMode>
          id="rat-mode"
          label="Rattachement"
          options={[
            { value: 'division', label: 'Division' },
            { value: 'cellule', label: 'Cellule transversale' },
          ]}
          value={agentMode}
          onChange={(m) => {
            setAgentMode(m);
            onChange(EMPTY);
          }}
        />
      )}

      {(showDivision || showSection) && (
        <Grille2>
          {showDivision && (
            <Liste
              id="rat-division"
              label="Division"
              facultatif={!divisionRequired}
              required={divisionRequired}
              messageObligatoire="Choisissez la division."
              vide="— Sélectionner —"
              value={value.divisionId ?? ''}
              onChange={(v) => onChange({ ...EMPTY, divisionId: v || null })}
              options={divisions.map((d) => ({ value: d.id, label: d.name }))}
            />
          )}
          {showSection && (
            <Liste
              id="rat-section"
              label="Section"
              facultatif={!sectionRequired}
              required={sectionRequired}
              messageObligatoire="Choisissez la section."
              vide={value.divisionId ? (sectionRequired ? '— Sélectionner —' : '— Aucune —') : 'Choisissez d’abord la division'}
              value={value.sectionId ?? ''}
              onChange={(v) => onChange({ ...value, sectionId: v || null })}
              options={sectionsForDivision.map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        </Grille2>
      )}

      {showCellule && (
        <Liste
          id="rat-cellule"
          label="Cellule"
          facultatif={!celluleRequired}
          required={celluleRequired}
          messageObligatoire="Choisissez la cellule."
          vide="— Sélectionner —"
          value={value.celluleId ?? ''}
          onChange={(v) => onChange({ ...EMPTY, celluleId: v || null })}
          options={cellules.map((c) => ({ value: c.id, label: c.name }))}
        />
      )}

      {showSupervisor && (
        <SelecteurPersonnes
          id="rat-superviseur"
          label="Personne assistée"
          multiple={false}
          required
          messageObligatoire="Choisissez la personne assistée."
          options={supervisorOptions.map((o) => ({ id: o.id, nom: `${o.firstName} ${o.lastName}`, detail: supervisorLabel(o).split(' — ')[1] ?? null }))}
          valeurs={value.supervisorId ? [value.supervisorId] : []}
          onChange={(ids) => onChange({ ...EMPTY, supervisorId: ids[0] ?? null })}
        />
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { DirectoryUser } from '../../lib/org/types';
import type { SystemRole } from '../../lib/auth/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { MessageSquare, Plus } from 'lucide-react';
import { FenetreDetail } from '../ui/FenetreDetail';
import { BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, Initiales, SectionFenetre } from '../ui/Charte';
import { CreateTaskModal } from '../tasks/CreateTaskModal';

/** Rôles ayant potentiellement autorité hiérarchique sur autrui (voir
 * CascadeService.hasDirectAuthorityOver côté API) — pour ne pas proposer une
 * assignation vouée à l'échec à un rôle qui n'a jamais autorité que sur
 * lui-même (Agent, Assistant de direction, Admin Système — §3.1 : la CSID
 * gère les comptes, pas le contenu métier des tâches). Le serveur reste seul
 * juge au final : même pour ces rôles, cibler quelqu'un hors de son propre
 * périmètre (autre division, etc.) est toujours rejeté en 403.
 */
const ROLES_WITH_POSSIBLE_AUTHORITY: SystemRole[] = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Fiche d'une personne de l'annuaire (fenêtre deux colonnes) : informations à gauche, Message,
 * et assignation de tâche à droite. L'annuaire n'expose ni email ni téléphone (champs non sensibles seulement). */
export function PersonDetailModal({ person, onClose }: { person: DirectoryUser; onClose: () => void }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  const [showCreateTask, setShowCreateTask] = useState(false);

  const isSelf = person.id === currentUser?.id;
  const canPossiblyAssign = !isSelf && ROLES_WITH_POSSIBLE_AUTHORITY.includes(currentUser?.role as SystemRole);

  const orgUnit = person.celluleId
    ? getCelluleName(person.celluleId)
    : [getDivisionName(person.divisionId), getSectionName(person.sectionId)].filter(Boolean).join(' · ');

  // Remplace la fiche par le formulaire plutôt que de superposer deux
  // panneaux plein écran — plus lisible qu'empiler deux fonds assombris.
  if (showCreateTask) {
    return (
      <CreateTaskModal
        presetAssignee={person}
        onClose={() => setShowCreateTask(false)}
        onCreated={onClose}
      />
    );
  }

  const nom = `${person.firstName} ${person.lastName}`;
  const fonction = person.jobTitle ?? ROLE_LABEL[person.role as keyof typeof ROLE_LABEL] ?? person.role;

  return (
    <FenetreDetail
      titre={nom}
      filAriane={['Annuaire', orgUnit || null]}
      onClose={onClose}
      largeur={720}
      testid="fiche-personne"
      cote={
        <div>
          {isSelf ? (
            <p className="text-[12.5px] text-text-muted">C&apos;est votre propre fiche.</p>
          ) : (
            <div className="grid gap-2">
              <button type="button" className={BTN_PRINCIPAL} onClick={() => router.push(`/communication?with=${person.id}`)}>
                <MessageSquare aria-hidden size={16} /> Envoyer un message
              </button>
              {canPossiblyAssign && (
                <button type="button" className={BTN_SECONDAIRE} onClick={() => setShowCreateTask(true)}>
                  <Plus aria-hidden size={16} /> Assigner une tâche
                </button>
              )}
              <p className="mt-1 text-[12px] text-text-muted">L’annuaire élargit la visibilité, pas les droits : l’assignation reste soumise aux règles d’autorité habituelles.</p>
            </div>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <CleValeur
              largeur={96}
              lignes={[
                ['Rôle', ROLE_LABEL[person.role as keyof typeof ROLE_LABEL] ?? person.role],
                ['Rattachement', orgUnit || 'Direction'],
              ]}
            />
          </div>
        </div>
      }
    >
      <div className="mb-[18px] flex items-center gap-3.5">
        <Initiales texte={initials(person.firstName, person.lastName)} taille={52} />
        <div className="min-w-0">
          <div className="truncate text-[16px] font-bold text-ink-900">{nom}</div>
          <div className="truncate text-[13px] text-text-muted">{fonction}</div>
        </div>
      </div>
      <SectionFenetre titre="Coordonnées">
        <CleValeur
          lignes={[
            ['Fonction', fonction],
            ['Unité', orgUnit || 'Direction'],
          ]}
        />
      </SectionFenetre>
    </FenetreDetail>
  );
}

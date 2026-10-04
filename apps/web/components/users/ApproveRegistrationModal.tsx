'use client';

import { useCallback, useState } from 'react';
import { approveUser } from '../../lib/api/users';
import { useOrg } from '../../lib/org/OrgProvider';
import type { AdminUser, OrgAttachment } from '../../lib/users/types';
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../../lib/users/types';
import { DECLARABLE_ROLE_LABEL, type DeclarableRole, type SystemRole } from '../../lib/auth/types';
import { OrgAttachmentFields } from './OrgAttachmentFields';
import { ChoixAgent, type SelectionAgent } from '../socle/ChoixAgent';
import { FenetreFormulaire, Liste } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

/**
 * Rôle réel le plus proche du poste déclaré à l'inscription (jamais attribué
 * automatiquement — juste une pré-sélection que l'admin confirme ou corrige,
 * voir schema.prisma User.declaredRole). Le poste déclaré est prioritaire sur
 * le rattachement déclaré s'ils divergent : il est plus directement lié au
 * rôle que la simple présence d'un superviseur déclaré.
 * CHEF_CELLULE en est exclu (comme ASSIGNABLE_ROLES) : sa nomination passe
 * par "Nommer chef de cellule" sur un compte déjà créé, pas par ici.
 */
function nearestAssignableRole(user: AdminUser): SystemRole {
  if (user.declaredRole && (ASSIGNABLE_ROLES as string[]).includes(user.declaredRole)) {
    return user.declaredRole as SystemRole;
  }
  return user.declaredSupervisorId ? 'ASSISTANT_DIRECTION' : 'AGENT';
}

export function ApproveRegistrationModal({
  user,
  onClose,
  onApproved,
}: {
  user: AdminUser;
  onClose: () => void;
  onApproved: (user: AdminUser) => void;
}) {
  const { getDivisionName, getSectionName, getCelluleName, getUserLabel } = useOrg();
  // Pré-sélectionné à partir du poste déclaré (nearestAssignableRole) — l'admin
  // garde la main pour corriger. Partir d'un rôle cohérent dès le montage évite
  // aussi que l'admin doive changer le rôle manuellement, ce qui effacerait le
  // pré-remplissage du rattachement (OrgAttachmentFields réinitialise
  // l'attachement à chaque changement de "famille" de rattachement).
  const [role, setRole] = useState<SystemRole>(() => nearestAssignableRole(user));
  // Pré-rempli avec le rattachement déclaré à l'inscription (voir OrgAttachmentFields :
  // son effet de réinitialisation-au-changement-de-rôle s'abstient exprès au premier
  // montage pour laisser passer ces valeurs) — l'admin n'a plus qu'à confirmer ou corriger.
  const [attachment, setAttachment] = useState<OrgAttachment>({
    divisionId: user.declaredDivisionId,
    sectionId: user.declaredSectionId,
    celluleId: user.declaredCelluleId,
    supervisorId: user.declaredSupervisorId,
  });
  const [agent, setAgent] = useState<SelectionAgent>({});
  const choisirAgent = useCallback((sel: SelectionAgent) => setAgent(sel), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDeclaration = !!(user.declaredDivisionId || user.declaredCelluleId || user.declaredSupervisorId);
  const declarationLabel = user.declaredSupervisorId
    ? `Assiste ${getUserLabel(user.declaredSupervisorId)}`
    : user.declaredCelluleId
      ? getCelluleName(user.declaredCelluleId)
      : [getDivisionName(user.declaredDivisionId), getSectionName(user.declaredSectionId)]
          .filter(Boolean)
          .join(' · ');

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await approveUser(user.id, { role, ...attachment, ...agent });
      onApproved(updated);
    } catch (err) {
      setError(messageErreur(err, "Impossible d'approuver cette inscription"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Approuver l’inscription"
      sousTitre={`${user.firstName} ${user.lastName} · ${user.email}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      enCours={submitting}
      erreur={error}
      libelleValider="Approuver"
      pied="La personne recevra un email avec son rôle, son unité et un bouton « Se connecter »."
      testid="fenetre-approbation"
    >
      {(user.declaredRole || hasDeclaration) && (
        <div className="mb-3.5 space-y-1 rounded-[10px] bg-gold-50 px-3.5 py-2.5 text-[12.5px] text-ink">
          {user.declaredRole && (
            <div>
              <strong>Poste déclaré à l’inscription :</strong> {DECLARABLE_ROLE_LABEL[user.declaredRole as DeclarableRole] ?? user.declaredRole}
            </div>
          )}
          {hasDeclaration && (
            <div>
              <strong>Rattachement déclaré :</strong> {declarationLabel}
            </div>
          )}
        </div>
      )}
      <Liste id="ap-role" label="Rôle attribué" value={role} onChange={(v) => setRole(v as SystemRole)} required options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
      <OrgAttachmentFields role={role} value={attachment} onChange={setAttachment} />
      <ChoixAgent onChange={choisirAgent} />
    </FenetreFormulaire>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { createUser } from '../../lib/api/users';
import type { AdminUser, OrgAttachment } from '../../lib/users/types';
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { OrgAttachmentFields } from './OrgAttachmentFields';
import { ChoixAgent, type SelectionAgent } from '../socle/ChoixAgent';
import { FenetreFormulaire, Grille2, Liste, Saisie } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

const EMPTY_ATTACHMENT: OrgAttachment = { divisionId: null, sectionId: null, celluleId: null, supervisorId: null };

export function CreateUserModal({ onClose, onCreated, agentInitial }: { onClose: () => void; onCreated: (user: AdminUser) => void; agentInitial?: string }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SystemRole>('AGENT');
  const [attachment, setAttachment] = useState<OrgAttachment>(EMPTY_ATTACHMENT);
  const [agent, setAgent] = useState<SelectionAgent>({});
  const choisirAgent = useCallback((sel: SelectionAgent) => setAgent(sel), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const user = await createUser({ email, firstName, lastName, password, role, ...attachment, ...agent });
      onCreated(user);
    } catch (err) {
      setError(messageErreur(err, 'Impossible de créer le compte'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Nouveau compte"
      sousTitre="Compte de connexion rattaché à un agent du dossier RH."
      onClose={onClose}
      onSubmit={handleSubmit}
      enCours={submitting}
      erreur={error}
      libelleValider="Créer le compte"
      pied="La personne recevra un email avec son rôle, son unité et un lien pour choisir son propre mot de passe (valable 7 jours)."
      valider={() => (password && password.length < 8 ? { 'cu-mdp': 'Le mot de passe doit compter au moins 8 caractères.' } : {})}
      testid="fenetre-nouveau-compte"
    >
      <ChoixAgent
        agentInitial={agentInitial}
        onChange={choisirAgent}
        onAgentChoisi={(a) => {
          setFirstName(a.prenoms);
          setLastName(a.nom);
        }}
      />
      <Grille2>
        <Saisie id="cu-prenom" label="Prénom" value={firstName} onChange={setFirstName} required />
        <Saisie id="cu-nom" label="Nom" value={lastName} onChange={setLastName} required />
        <Saisie id="cu-email" label="Adresse e-mail" type="email" value={email} onChange={setEmail} required />
        <Saisie id="cu-mdp" label="Mot de passe" type="password" value={password} onChange={setPassword} required aide="8 caractères minimum." />
      </Grille2>
      <Liste id="cu-role" label="Rôle" value={role} onChange={(v) => setRole(v as SystemRole)} required options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
      <OrgAttachmentFields role={role} value={attachment} onChange={setAttachment} />
    </FenetreFormulaire>
  );
}

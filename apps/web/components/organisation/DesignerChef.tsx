'use client';

import { useEffect, useState } from 'react';
import { listAllUsers } from '../../lib/api/users';
import type { AdminUser, OrgAttachment } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { FenetreFormulaire, SelecteurPersonnes } from '../ui/Formulaire';
import { ChangeRoleModal } from '../users/ChangeRoleModal';
import { useToast } from '../ui/Toast';

/**
 * « Désigner un chef » (S8) : choisir la personne, puis la procédure EXISTANTE de changement de rôle
 * (aperçu des effets calculé par l'API, motif, audit), préremplie avec le rôle et l'unité visés.
 * Réservé à l'administrateur (droit renvoyé par l'API d'organisation).
 */
export function DesignerChef({
  unite,
  role,
  rattachement,
  onClose,
  onFait,
}: {
  unite: string;
  role: SystemRole;
  rattachement: OrgAttachment;
  onClose: () => void;
  onFait: () => void;
}) {
  const toast = useToast();
  const [comptes, setComptes] = useState<AdminUser[]>([]);
  const [choisi, setChoisi] = useState<string[]>([]);
  const [etape, setEtape] = useState<'choix' | 'role'>('choix');
  useEffect(() => {
    listAllUsers()
      .then((l) => setComptes(l.filter((u) => u.status === 'ACTIF' && u.role !== 'STAGIAIRE')))
      .catch(() => setComptes([]));
  }, []);
  const personne = comptes.find((u) => u.id === choisi[0]);
  if (etape === 'role' && personne)
    return (
      <ChangeRoleModal
        user={personne}
        cible={{ role, rattachement }}
        onClose={onClose}
        onChanged={() => {
          toast.succes('Chef désigné', { detail: `${personne.firstName} ${personne.lastName} dirige ${unite}.` });
          onFait();
        }}
      />
    );
  return (
    <FenetreFormulaire
      titre={`Désigner un chef : ${unite}`}
      onClose={onClose}
      largeur={560}
      libelleValider="Continuer"
      testid="fenetre-designer-chef"
      pied="L’étape suivante montre les effets du changement de rôle avant de le confirmer, avec un motif."
      onSubmit={() => {
        if (personne) setEtape('role');
      }}
    >
      <SelecteurPersonnes
        id="designer-chef"
        label="Personne"
        multiple={false}
        options={comptes.map((u) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}`, detail: u.jobTitle }))}
        valeurs={choisi}
        onChange={setChoisi}
        placeholder="Rechercher une personne…"
      />
    </FenetreFormulaire>
  );
}

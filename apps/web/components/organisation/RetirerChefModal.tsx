'use client';

import { useState } from 'react';
import { retirerCelluleChef } from '../../lib/api/org';
import type { Cellule } from '../../lib/org/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { ChoixSegment, FenetreFormulaire, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

/** Rôles proposés au chef qui quitte la fonction en restant dans la cellule ;
 * tout autre changement (autre unité, autre fonction) passe par « Changer de
 * rôle » sur la page Utilisateurs. Le serveur revérifie tout. */
const ROLES_APRES_RETRAIT = ['AGENT', 'DRH', 'ADMIN_SYSTEME'] as const;

/** Retrait du chef d'une cellule (POST /org/cellules/:id/chef/retrait) : motif
 * obligatoire, rôle cible (Chargé d'Études par défaut) ; historique, audit,
 * sessions fermées — même mécanisme que tout changement de rôle. */
export function RetirerChefModal({ cellule, chef, onClose, onDone }: { cellule: Cellule; chef: string; onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState<(typeof ROLES_APRES_RETRAIT)[number]>('AGENT');
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function submit() {
    setEnCours(true);
    setErreur(null);
    try {
      await retirerCelluleChef(cellule.id, motif.trim(), role);
      onDone();
    } catch (err) {
      setErreur(messageErreur(err, 'Retrait impossible'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Retirer le chef"
      sousTitre={`${chef} quitte la direction de ${cellule.name} et reste dans la cellule avec le rôle choisi.`}
      onClose={onClose}
      onSubmit={submit}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      danger
      libelleValider="Retirer le chef"
      pied="Les sessions de la personne sont fermées ; le changement est inscrit à l’historique."
    >
      <ChoixSegment<(typeof ROLES_APRES_RETRAIT)[number]>
        id="rc-role"
        label="Nouveau rôle"
        options={ROLES_APRES_RETRAIT.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        value={role}
        onChange={setRole}
      />
      <ZoneTexte id="rc-motif" label="Motif" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif du retrait." maxLength={1000} />
    </FenetreFormulaire>
  );
}

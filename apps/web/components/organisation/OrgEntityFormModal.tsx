'use client';

import { useState } from 'react';
import { FenetreFormulaire, Grille2, Saisie } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

/** Formulaire générique code+nom, partagé entre Division/Section/Cellule (création et
 * modification) — les trois ont exactement la même forme côté API (CreateDivisionDto,
 * CreateSectionDto, CreateCelluleDto). Le code est toujours mis en majuscules avant
 * envoi : la convention observée partout (DPE, SSR, CSID…), même si seule la longueur
 * est validée côté API pour les sections. */
export function OrgEntityFormModal({
  title,
  codeHint,
  initialCode = '',
  initialName = '',
  libelleValider = 'Enregistrer',
  onClose,
  onSubmit,
}: {
  title: string;
  codeHint: string;
  initialCode?: string;
  initialName?: string;
  libelleValider?: string;
  onClose: () => void;
  onSubmit: (code: string, name: string) => Promise<void>;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(code.trim().toUpperCase(), name.trim());
    } catch (err) {
      setError(messageErreur(err));
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre={title}
      onClose={onClose}
      onSubmit={handleSubmit}
      largeur={600}
      enCours={submitting}
      erreur={error}
      libelleValider={libelleValider}
      pied="Le code est enregistré en majuscules."
    >
      <Grille2>
        <Saisie id="org-code" label="Code" value={code} onChange={setCode} required maxLength={10} aide={codeHint} />
        <Saisie id="org-nom" label="Nom complet" value={name} onChange={setName} required />
      </Grille2>
    </FenetreFormulaire>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createAnnouncement } from '../../lib/api/communication';
import type { Announcement, AudienceScopeValue } from '../../lib/communication/types';
import { getAvailableAudienceScopes, SCOPE_LABEL } from '../../lib/communication/types';
import { AudienceScopeFields } from './AudienceScopeFields';
import { FenetreFormulaire, Saisie, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

/** Nouvelle annonce (refonte, étape 9) : fenêtre de formulaire, portée en un clic, validation dans la fenêtre. */
export function CreateAnnouncementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (announcement: Announcement) => void;
}) {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const availableScopes = useMemo(() => getAvailableAudienceScopes(currentUser?.role ?? ''), [currentUser?.role]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AudienceScopeValue>({
    scope: availableScopes[0] ?? 'GROUPE_PERSONNALISE',
    divisionId: currentUser?.divisionId ?? '',
    sectionId: currentUser?.sectionId ?? '',
    celluleId: currentUser?.celluleId ?? '',
    recipientUserIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const announcement = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        scope: audience.scope,
        divisionId: audience.scope === 'DIVISION' || audience.scope === 'SECTION' ? audience.divisionId : undefined,
        sectionId: audience.scope === 'SECTION' ? audience.sectionId : undefined,
        celluleId: audience.scope === 'CELLULE' ? audience.celluleId : undefined,
        recipientUserIds: audience.scope === 'GROUPE_PERSONNALISE' ? audience.recipientUserIds : undefined,
      });
      toast.succes('Annonce publiée', {
        detail: audience.scope === 'GROUPE_PERSONNALISE' ? `${audience.recipientUserIds.length} destinataire${audience.recipientUserIds.length > 1 ? 's' : ''} prévenu${audience.recipientUserIds.length > 1 ? 's' : ''}.` : `Portée : ${SCOPE_LABEL[audience.scope].toLowerCase()}. Les destinataires sont prévenus.`,
      });
      onCreated(announcement);
    } catch (err) {
      setError(messageErreur(err, 'Impossible de publier l’annonce.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (availableScopes.length === 0) return null;

  return (
    <FenetreFormulaire
      titre="Nouvelle annonce"
      onClose={onClose}
      onSubmit={handleSubmit}
      libelleValider="Publier l’annonce"
      enCours={submitting}
      erreur={error}
      largeur={720}
      testid="fenetre-nouvelle-annonce"
      pied="Chaque destinataire est prévenu par une notification ; vous suivez ensuite qui l’a lue."
      valider={() => ({
        ...(title.trim() ? {} : { 'annonce-titre': 'Donnez un titre à l’annonce.' }),
        ...(body.trim() ? {} : { 'annonce-message': 'Écrivez le message de l’annonce.' }),
      })}
    >
      <Saisie id="annonce-titre" label="Titre" value={title} onChange={setTitle} required messageObligatoire="Donnez un titre à l’annonce." />
      <ZoneTexte id="annonce-message" label="Message" value={body} onChange={setBody} lignes={5} required messageObligatoire="Écrivez le message de l’annonce." />
      <AudienceScopeFields prefixe="annonce" availableScopes={availableScopes} value={audience} onChange={setAudience} />
    </FenetreFormulaire>
  );
}

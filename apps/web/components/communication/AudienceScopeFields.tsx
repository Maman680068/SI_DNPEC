'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { AnnouncementScope, AudienceScopeValue } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { ChoixSegment, Liste, SelecteurPersonnes } from '../ui/Formulaire';

/**
 * Sélecteur de portée d'audience partagé entre annonces et sondages — même
 * ciblage cascade (DNPEC/Division/Section/Cellule/Groupe personnalisé), même
 * autorité vérifiée côté API pour les deux. Extrait de CreateAnnouncementModal
 * pour ne pas dupliquer ce bloc dans CreatePollModal.
 *
 * Refonte (étape 9) : portée en un clic, unité en liste validée dans la fenêtre, destinataires d'un
 * groupe personnalisé avec le sélecteur de personnes (recherche, étiquettes).
 * `prefixe` : identifiants des champs propres à chaque formulaire.
 */
export function AudienceScopeFields({
  availableScopes,
  value,
  onChange,
  prefixe = 'audience',
}: {
  availableScopes: AnnouncementScope[];
  value: AudienceScopeValue;
  onChange: (next: AudienceScopeValue) => void;
  prefixe?: string;
}) {
  const { user: currentUser } = useAuth();
  const { divisions, sections, cellules, users } = useOrg();

  const isChefDivision = currentUser?.role === 'CHEF_DIVISION';
  const isChefSection = currentUser?.role === 'CHEF_SECTION';
  const isChefCellule = currentUser?.role === 'CHEF_CELLULE';
  const sectionsForDivision = sections.filter((s) => s.divisionId === value.divisionId);
  const uniteDe = (u: (typeof users)[number]) =>
    u.celluleId
      ? cellules.find((c) => c.id === u.celluleId)?.name
      : u.sectionId
        ? sections.find((s) => s.id === u.sectionId)?.name
        : u.divisionId
          ? divisions.find((d) => d.id === u.divisionId)?.name
          : 'Direction';
  const personnes = users
    .filter((u) => u.id !== currentUser?.id)
    .map((u) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}`, detail: [u.jobTitle, uniteDe(u)].filter(Boolean).join(' · ') || null }));

  const votre = (libelle: string, nom?: string) => (
    <p className="mb-3.5 text-[13px] text-text-muted">
      {libelle} : <strong className="text-text">{nom ?? '—'}</strong>
    </p>
  );

  return (
    <>
      <ChoixSegment<AnnouncementScope>
        id={`${prefixe}-portee`}
        label="Portée"
        value={value.scope}
        onChange={(scope) => onChange({ ...value, scope })}
        options={availableScopes.map((s) => ({ value: s, label: SCOPE_LABEL[s] }))}
      />

      {value.scope === 'DIVISION' &&
        (isChefDivision ? (
          votre('Votre division', divisions.find((d) => d.id === currentUser?.divisionId)?.name)
        ) : (
          <Liste
            id={`${prefixe}-division`}
            label="Division"
            value={value.divisionId}
            onChange={(divisionId) => onChange({ ...value, divisionId })}
            vide="Choisir une division…"
            required
            messageObligatoire="Choisissez une division."
            options={divisions.map((d) => ({ value: d.id, label: d.name }))}
          />
        ))}

      {value.scope === 'SECTION' &&
        (isChefSection ? (
          votre('Votre section', sections.find((s) => s.id === currentUser?.sectionId)?.name)
        ) : (
          <div className={isChefDivision ? '' : 'grid gap-x-4 sm:grid-cols-2'}>
            {!isChefDivision && (
              <Liste
                id={`${prefixe}-division`}
                label="Division"
                value={value.divisionId}
                onChange={(divisionId) => onChange({ ...value, divisionId, sectionId: '' })}
                vide="Choisir une division…"
                required
                messageObligatoire="Choisissez une division."
                options={divisions.map((d) => ({ value: d.id, label: d.name }))}
              />
            )}
            <Liste
              id={`${prefixe}-section`}
              label="Section"
              value={value.sectionId}
              onChange={(sectionId) => onChange({ ...value, sectionId })}
              vide={value.divisionId ? 'Choisir une section…' : 'Choisissez d’abord une division'}
              required
              messageObligatoire="Choisissez une section."
              options={sectionsForDivision.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
        ))}

      {value.scope === 'CELLULE' &&
        (isChefCellule ? (
          votre('Votre cellule', cellules.find((c) => c.id === currentUser?.celluleId)?.name)
        ) : (
          <Liste
            id={`${prefixe}-cellule`}
            label="Cellule"
            value={value.celluleId}
            onChange={(celluleId) => onChange({ ...value, celluleId })}
            vide="Choisir une cellule…"
            required
            messageObligatoire="Choisissez une cellule."
            options={cellules.map((c) => ({ value: c.id, label: c.name }))}
          />
        ))}

      {value.scope === 'GROUPE_PERSONNALISE' && (
        <SelecteurPersonnes
          id={`${prefixe}-destinataires`}
          label="Destinataires"
          options={personnes}
          valeurs={value.recipientUserIds}
          onChange={(recipientUserIds) => onChange({ ...value, recipientUserIds })}
          required
          messageObligatoire="Choisissez au moins un destinataire."
          aide={personnes.length === 0 ? 'Aucun destinataire disponible dans votre périmètre.' : 'Personnes de votre périmètre.'}
        />
      )}
    </>
  );
}

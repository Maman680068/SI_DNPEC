'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { AnnouncementScope, AudienceScopeValue } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';

/**
 * Sélecteur de portée d'audience partagé entre annonces et sondages — même
 * ciblage cascade (DNPEC/Division/Section/Cellule/Groupe personnalisé), même
 * autorité vérifiée côté API pour les deux. Extrait de CreateAnnouncementModal
 * pour ne pas dupliquer ce bloc dans CreatePollModal.
 */
export function AudienceScopeFields({
  availableScopes,
  value,
  onChange,
}: {
  availableScopes: AnnouncementScope[];
  value: AudienceScopeValue;
  onChange: (next: AudienceScopeValue) => void;
}) {
  const { user: currentUser } = useAuth();
  const { divisions, sections, cellules, users } = useOrg();

  const isChefDivision = currentUser?.role === 'CHEF_DIVISION';
  const isChefSection = currentUser?.role === 'CHEF_SECTION';
  const isChefCellule = currentUser?.role === 'CHEF_CELLULE';
  const sectionsForDivision = sections.filter((s) => s.divisionId === value.divisionId);

  function toggleRecipient(userId: string) {
    onChange({
      ...value,
      recipientUserIds: value.recipientUserIds.includes(userId)
        ? value.recipientUserIds.filter((id) => id !== userId)
        : [...value.recipientUserIds, userId],
    });
  }

  return (
    <>
      <div className="mb-4">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Portée</label>
        <select
          value={value.scope}
          onChange={(e) => onChange({ ...value, scope: e.target.value as AnnouncementScope })}
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        >
          {availableScopes.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {value.scope === 'DIVISION' && (
        <div className="mb-4">
          {isChefDivision ? (
            <p className="text-[13px] text-text-muted">
              Votre division : <strong>{divisions.find((d) => d.id === currentUser?.divisionId)?.name}</strong>
            </p>
          ) : (
            <select
              value={value.divisionId}
              onChange={(e) => onChange({ ...value, divisionId: e.target.value })}
              required
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Choisir une division…</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {value.scope === 'SECTION' && (
        <div className="mb-4 space-y-2.5">
          {isChefSection ? (
            <p className="text-[13px] text-text-muted">
              Votre section : <strong>{sections.find((s) => s.id === currentUser?.sectionId)?.name}</strong>
            </p>
          ) : (
            <>
              {!isChefDivision && (
                <select
                  value={value.divisionId}
                  onChange={(e) => onChange({ ...value, divisionId: e.target.value, sectionId: '' })}
                  required
                  className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
                >
                  <option value="">Choisir une division…</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={value.sectionId}
                onChange={(e) => onChange({ ...value, sectionId: e.target.value })}
                required
                disabled={!value.divisionId}
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm disabled:opacity-60"
              >
                <option value="">Choisir une section…</option>
                {sectionsForDivision.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {value.scope === 'CELLULE' && (
        <div className="mb-4">
          {isChefCellule ? (
            <p className="text-[13px] text-text-muted">
              Votre cellule : <strong>{cellules.find((c) => c.id === currentUser?.celluleId)?.name}</strong>
            </p>
          ) : (
            <select
              value={value.celluleId}
              onChange={(e) => onChange({ ...value, celluleId: e.target.value })}
              required
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Choisir une cellule…</option>
              {cellules.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {value.scope === 'GROUPE_PERSONNALISE' && (
        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Destinataires</label>
          <div className="max-h-32 overflow-y-auto rounded-md border border-line p-2">
            {users
              .filter((u) => u.id !== currentUser?.id)
              .map((u) => (
                <label key={u.id} className="flex items-center gap-2 py-1 text-[13px]">
                  <input
                    type="checkbox"
                    checked={value.recipientUserIds.includes(u.id)}
                    onChange={() => toggleRecipient(u.id)}
                  />
                  {u.firstName} {u.lastName}
                </label>
              ))}
            {users.length <= 1 && <p className="text-[12.5px] text-text-faint">Aucun destinataire disponible.</p>}
          </div>
        </div>
      )}
    </>
  );
}

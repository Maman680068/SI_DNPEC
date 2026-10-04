'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { createCellule, deleteCellule, reactivateCellule, suspendCellule, updateCellule } from '../../lib/api/org';
import type { Cellule } from '../../lib/org/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OrgEntityFormModal } from './OrgEntityFormModal';
import { RetirerChefModal } from './RetirerChefModal';

export function CellulesPanel() {
  const { cellules, refreshOrg, getUserLabel } = useOrg();
  const [retrait, setRetrait] = useState<Cellule | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Cellule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleDelete(cellule: Cellule) {
    if (!window.confirm(`Supprimer la cellule "${cellule.name}" ?`)) return;
    setPendingDeleteId(cellule.id);
    setError(null);
    try {
      await deleteCellule(cellule.id);
      await refreshOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cette cellule');
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleToggleActive(cellule: Cellule) {
    setPendingDeleteId(cellule.id);
    setError(null);
    try {
      if (cellule.isActive) await suspendCellule(cellule.id);
      else await reactivateCellule(cellule.id);
      await refreshOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de modifier le statut de cette cellule');
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="font-heading text-[16px] font-bold text-ink-900">Cellules transversales</h2>
        <Button variant="gold" onClick={() => setCreating(true)}>
          + Nouvelle cellule
        </Button>
      </div>

      {error && <div className="mb-3 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

      {cellules.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">Aucune cellule.</p>
      ) : (
        <div className="space-y-2">
          {cellules.map((cellule) => (
            <Card key={cellule.id} className="flex flex-col gap-3 p-[18px] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold">{cellule.name}</span>
                  {!cellule.isActive && (
                    <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-clay">
                      Suspendue
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-text-muted">
                  {cellule.code} · {cellule.chefId ? `chef : ${getUserLabel(cellule.chefId)}` : 'sans chef'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {cellule.chefId && (
                  <Button variant="outline" onClick={() => setRetrait(cellule)}>
                    Retirer le chef
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditing(cellule)}>
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  disabled={pendingDeleteId === cellule.id}
                  onClick={() => handleToggleActive(cellule)}
                >
                  {cellule.isActive ? 'Suspendre' : 'Réactiver'}
                </Button>
                <Button
                  variant="outline"
                  className="border-clay text-clay hover:bg-clay-soft"
                  disabled={pendingDeleteId === cellule.id}
                  onClick={() => handleDelete(cellule)}
                >
                  Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {retrait && retrait.chefId && (
        <RetirerChefModal
          cellule={retrait}
          chef={getUserLabel(retrait.chefId)}
          onClose={() => setRetrait(null)}
          onDone={async () => {
            setRetrait(null);
            await refreshOrg();
          }}
        />
      )}

      {creating && (
        <OrgEntityFormModal
          title="Nouvelle cellule"
          codeHint="2 à 10 lettres majuscules, ex. CSID"
          onClose={() => setCreating(false)}
          onSubmit={async (code, name) => {
            await createCellule({ code, name });
            await refreshOrg();
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <OrgEntityFormModal
          title="Modifier la cellule"
          codeHint="2 à 10 lettres majuscules"
          initialCode={editing.code}
          initialName={editing.name}
          onClose={() => setEditing(null)}
          onSubmit={async (code, name) => {
            await updateCellule(editing.id, { code, name });
            await refreshOrg();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

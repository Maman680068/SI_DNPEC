'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { createCellule, deleteCellule, updateCellule } from '../../lib/api/org';
import type { Cellule } from '../../lib/org/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OrgEntityFormModal } from './OrgEntityFormModal';

export function CellulesPanel() {
  const { cellules, refreshOrg } = useOrg();
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

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold">Cellules transversales</h2>
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
                <div className="text-[14px] font-bold">{cellule.name}</div>
                <div className="text-[12px] text-text-muted">
                  {cellule.code} · {cellule.chefId ? 'a un chef' : 'sans chef'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(cellule)}>
                  Modifier
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

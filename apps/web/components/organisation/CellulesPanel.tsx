'use client';

import { useState } from 'react';
import { MenuActions } from '../ui/MenuActions';
import { useOrg } from '../../lib/org/OrgProvider';
import { createCellule, deleteCellule, reactivateCellule, suspendCellule, updateCellule } from '../../lib/api/org';
import type { Cellule } from '../../lib/org/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OrgEntityFormModal } from './OrgEntityFormModal';
import { RetirerChefModal } from './RetirerChefModal';
import { Plus } from 'lucide-react';
import { messageErreur, useToast } from '../ui/Toast';

export function CellulesPanel() {
  const { cellules, refreshOrg, getUserLabel } = useOrg();
  const [retrait, setRetrait] = useState<Cellule | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Cellule | null>(null);
  const toast = useToast();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleDelete(cellule: Cellule) {
    if (!window.confirm(`Supprimer la cellule "${cellule.name}" ?`)) return;
    setPendingDeleteId(cellule.id);
    try {
      await deleteCellule(cellule.id);
      await refreshOrg();
      toast.succes('Cellule supprimée', { detail: cellule.name });
    } catch (err) {
      toast.erreur('Suppression impossible', messageErreur(err, 'Impossible de supprimer cette cellule'));
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleToggleActive(cellule: Cellule, annulation = false) {
    setPendingDeleteId(cellule.id);
    try {
      if (cellule.isActive) await suspendCellule(cellule.id);
      else await reactivateCellule(cellule.id);
      await refreshOrg();
      if (!annulation)
        toast.succes(cellule.isActive ? 'Cellule suspendue' : 'Cellule réactivée', {
          detail: cellule.name,
          annuler: () => handleToggleActive({ ...cellule, isActive: !cellule.isActive }, true),
        });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err, 'Impossible de modifier le statut de cette cellule'));
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="font-heading text-[16px] font-bold text-ink-900">Cellules transversales</h2>
        <Button variant="gold" onClick={() => setCreating(true)}>
          <Plus aria-hidden size={16} /> Nouvelle cellule
        </Button>
      </div>


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
              {/* Un bouton visible (« Modifier »), les autres actions dans « Plus d'actions ». */}
              <div className="flex flex-none items-center gap-2">
                <Button variant="outline" className="whitespace-nowrap" onClick={() => setEditing(cellule)}>
                  Modifier
                </Button>
                <MenuActions
                  libelle={`Plus d’actions pour ${cellule.code}`}
                  actions={[
                    ...(cellule.chefId ? [{ label: 'Retirer le chef', onSelect: () => setRetrait(cellule) }] : []),
                    ...(pendingDeleteId === cellule.id
                      ? []
                      : [
                          { label: cellule.isActive ? 'Suspendre' : 'Réactiver', onSelect: () => void handleToggleActive(cellule) },
                          { label: 'Supprimer', danger: true, onSelect: () => void handleDelete(cellule) },
                        ]),
                  ]}
                />
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
            const c = retrait;
            setRetrait(null);
            await refreshOrg();
            toast.succes('Chef retiré', { detail: `${c.name} n’a plus de chef ; la personne a été prévenue.` });
          }}
        />
      )}

      {creating && (
        <OrgEntityFormModal
          title="Nouvelle cellule"
          codeHint="2 à 10 lettres majuscules, ex. CSID"
          onClose={() => setCreating(false)}
          libelleValider="Créer la cellule"
          onSubmit={async (code, name) => {
            await createCellule({ code, name });
            await refreshOrg();
            setCreating(false);
            toast.succes('Cellule créée', { detail: `${code} — ${name}` });
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
            toast.succes('Cellule modifiée', { detail: `${code} — ${name}` });
          }}
        />
      )}
    </div>
  );
}

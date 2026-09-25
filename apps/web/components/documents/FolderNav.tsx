'use client';

import { useEffect, useState } from 'react';
import { createFolder, getFolders } from '../../lib/api/documents';
import type { Folder } from '../../lib/documents/types';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';

export function FolderNav({
  divisionId,
  currentFolderId,
  onNavigate,
}: {
  divisionId: string;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    setFolders(null);
    setErreurChargement(null);
    getFolders(divisionId)
      .then(setFolders)
      .catch((err) => setErreurChargement(messageChargement(err)));
  }, [divisionId]);

  if (erreurChargement) return <ErreurChargement message={erreurChargement} />;
  if (folders === null) return <p className="text-[13px] text-text-muted">Chargement des dossiers…</p>;

  const byId = new Map(folders.map((f) => [f.id, f]));
  const breadcrumb: Folder[] = [];
  let cursor = currentFolderId ? byId.get(currentFolderId) : undefined;
  while (cursor) {
    breadcrumb.unshift(cursor);
    cursor = cursor.parentFolderId ? byId.get(cursor.parentFolderId) : undefined;
  }
  const subFolders = folders.filter((f) => f.parentFolderId === currentFolderId);

  async function handleCreate() {
    if (!newName.trim()) return;
    const created = await createFolder({ name: newName.trim(), divisionId, parentFolderId: currentFolderId ?? undefined });
    setFolders((prev) => (prev ? [...prev, created] : [created]));
    setNewName('');
    setShowCreate(false);
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-muted">
        <button onClick={() => onNavigate(null)} className={`font-semibold ${currentFolderId === null ? 'text-ink' : 'hover:underline'}`}>
          🗂 Racine
        </button>
        {breadcrumb.map((folder) => (
          <span key={folder.id} className="flex items-center gap-1.5">
            <span className="text-text-faint">/</span>
            <button
              onClick={() => onNavigate(folder.id)}
              className={folder.id === currentFolderId ? 'font-semibold text-ink' : 'hover:underline'}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {subFolders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onNavigate(folder.id)}
            className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold hover:bg-bg"
          >
            📁 {folder.name}
          </button>
        ))}

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md border-[1.5px] border-dashed border-line px-3 py-1.5 text-[12.5px] font-semibold text-text-faint"
          >
            + Nouveau dossier
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Nom du dossier"
              className="rounded-md border border-line px-2.5 py-1.5 text-[12.5px]"
            />
            <button onClick={handleCreate} className="text-[12.5px] font-semibold text-accent">
              Créer
            </button>
            <button onClick={() => setShowCreate(false)} className="text-[12.5px] text-text-faint">
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

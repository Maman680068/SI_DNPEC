'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { addVersion, downloadVersion, getVersions, markFinal, publishDocument } from '../../lib/api/documents';
import type { DnpecDocument, DocumentVersionSummary } from '../../lib/documents/types';
import { CATEGORY_LABEL, CAN_PUBLISH_ROLES } from '../../lib/documents/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DocumentDetailDrawer({
  document: doc,
  onClose,
  onChange,
}: {
  document: DnpecDocument;
  onClose: () => void;
  onChange: (doc: DnpecDocument) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getDivisionName, getUserLabel } = useOrg();
  const [versions, setVersions] = useState<DocumentVersionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getVersions(doc.id).then(setVersions);
  }, [doc.id]);

  const isCreator = doc.createdById === currentUser?.id;
  // Heuristique d'affichage seulement (créateur ou supérieur hiérarchique direct) —
  // l'API (CascadeService.hasDirectAuthorityOver) reste seule autorité réelle.
  const canModify = isCreator || (currentUser ? ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'].includes(currentUser.role) : false);
  const canPublish =
    doc.isFinal &&
    doc.visibility !== 'PUBLIE_DNPEC' &&
    currentUser &&
    (currentUser.role === 'DN' ||
      currentUser.role === 'DNA' ||
      (currentUser.role === 'CHEF_DIVISION' && currentUser.divisionId === doc.divisionId));

  async function handleMarkFinal() {
    setBusy(true);
    setError(null);
    try {
      onChange(await markFinal(doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      onChange(await publishDocument(doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddVersion(file: File) {
    setBusy(true);
    setError(null);
    try {
      const updated = await addVersion(doc.id, file);
      onChange(updated);
      getVersions(doc.id).then(setVersions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter cette version");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={doc.visibility === 'PUBLIE_DNPEC' ? 'sage' : 'accent'}>
              {doc.visibility === 'PUBLIE_DNPEC' ? '🌐 Publié DNPEC' : '🔒 Privé — division'}
            </Badge>
            {doc.isFinal && <Badge tone="gold">Final</Badge>}
          </div>
          <button onClick={onClose} className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{doc.title}</h2>
        <p className="mb-5 text-[13px] text-text-muted">
          {CATEGORY_LABEL[doc.category]} · {getDivisionName(doc.divisionId)} · par {getUserLabel(doc.createdById)}
        </p>

        {doc.description && <div className="mb-5 rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">{doc.description}</div>}

        {canModify && (
          <div className="mb-5 flex flex-wrap gap-2.5">
            {!doc.isFinal && (
              <Button variant="outline" disabled={busy} onClick={handleMarkFinal}>
                Marquer comme final
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              Ajouter une version
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleAddVersion(e.target.files[0])}
            />
            {canPublish && (
              <Button variant="gold" disabled={busy} onClick={handlePublish}>
                Publier (toute la DNPEC)
              </Button>
            )}
          </div>
        )}
        {doc.isFinal && !canPublish && doc.visibility !== 'PUBLIE_DNPEC' && !CAN_PUBLISH_ROLES.includes(currentUser?.role ?? '') && (
          <p className="mb-5 text-[12px] text-text-faint">Seuls le DN, la DNA ou le Chef de cette division peuvent publier.</p>
        )}
        {error && <div className="mb-5 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">Versions</div>
        {versions === null ? (
          <p className="text-[13px] text-text-muted">Chargement…</p>
        ) : (
          <div className="space-y-1.5">
            {versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">
                    v{version.versionNumber} — {version.fileName}
                  </div>
                  <div className="text-[11px] text-text-faint">
                    {formatSize(version.sizeBytes)} · {formatDateTime(version.uploadedAt)} · {getUserLabel(version.uploadedById)}
                  </div>
                </div>
                <button
                  onClick={() => downloadVersion(doc.id, version.id, version.fileName)}
                  className="flex-shrink-0 text-[12.5px] font-semibold text-accent"
                >
                  Télécharger
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

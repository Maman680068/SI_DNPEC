'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useOrg } from '../../../lib/org/OrgProvider';
import { getDocuments } from '../../../lib/api/documents';
import type { DnpecDocument, DocumentCategory } from '../../../lib/documents/types';
import { CATEGORY_LABEL } from '../../../lib/documents/types';
import { FolderNav } from '../../../components/documents/FolderNav';
import { DocumentList } from '../../../components/documents/DocumentList';
import { UploadDocumentModal } from '../../../components/documents/UploadDocumentModal';
import { DocumentDetailDrawer } from '../../../components/documents/DocumentDetailDrawer';
import { Button } from '../../../components/ui/Button';

type Tab = 'division' | 'published';
const LEADERSHIP_ROLES = ['DN', 'DNA'];

export default function DocumentsPage() {
  const { user: currentUser } = useAuth();
  const { divisions } = useOrg();
  const [tab, setTab] = useState<Tab>('division');

  const canPickDivision = LEADERSHIP_ROLES.includes(currentUser?.role ?? '');
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  useEffect(() => {
    if (selectedDivisionId) return;
    if (currentUser?.divisionId) setSelectedDivisionId(currentUser.divisionId);
    else if (divisions[0]) setSelectedDivisionId(divisions[0].id);
  }, [currentUser?.divisionId, divisions, selectedDivisionId]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');

  const [documents, setDocuments] = useState<DnpecDocument[] | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DnpecDocument | null>(null);

  const load = useCallback(() => {
    if (tab === 'division' && !selectedDivisionId) return;
    setDocuments(null);
    getDocuments({
      visibility: tab === 'division' ? 'PRIVE_DIVISION' : 'PUBLIE_DNPEC',
      divisionId: tab === 'division' ? selectedDivisionId : undefined,
      folderId: tab === 'division' ? currentFolderId ?? undefined : undefined,
      category: category || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      q: q || undefined,
    }).then(setDocuments);
  }, [tab, selectedDivisionId, currentFolderId, category, dateFrom, dateTo, q]);

  useEffect(() => {
    load();
  }, [load]);

  function handleTabChange(next: Tab) {
    setTab(next);
    setCurrentFolderId(null);
  }

  function handleDocChanged(updated: DnpecDocument) {
    setDocuments((prev) => prev?.map((d) => (d.id === updated.id ? updated : d)) ?? prev);
    setSelectedDoc(updated);
    // Une publication fait passer un document de "division" à "DNPEC" — il doit
    // disparaître de la liste de l'onglet courant s'il ne correspond plus au filtre.
    if (tab === 'division' && updated.visibility === 'PUBLIE_DNPEC') {
      setDocuments((prev) => prev?.filter((d) => d.id !== updated.id) ?? prev);
    }
  }

  const divisionLabel = useMemo(() => divisions.find((d) => d.id === selectedDivisionId)?.name, [divisions, selectedDivisionId]);

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
          <h1 className="text-[22px] font-extrabold">Archives &amp; documents</h1>
        </div>
        {tab === 'division' && selectedDivisionId && (
          <Button variant="gold" onClick={() => setShowUpload(true)}>
            + Nouveau document
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            { key: 'division', label: 'Mon espace division' },
            { key: 'published', label: 'Documents publiés (DNPEC)' },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            onClick={() => handleTabChange(option.key)}
            className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${
              tab === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'division' && (
        <div className="mb-4">
          {canPickDivision ? (
            <select
              value={selectedDivisionId}
              onChange={(e) => {
                setSelectedDivisionId(e.target.value);
                setCurrentFolderId(null);
              }}
              className="mb-3 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mb-3 text-[13px] text-text-muted">
              Division : <strong>{divisionLabel}</strong>
            </p>
          )}
          {selectedDivisionId && (
            <FolderNav divisionId={selectedDivisionId} currentFolderId={currentFolderId} onNavigate={setCurrentFolderId} />
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par titre…"
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory | '')}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
        >
          <option value="">Toutes catégories</option>
          {(Object.keys(CATEGORY_LABEL) as DocumentCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]" />
        <span className="text-[12px] text-text-faint">à</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]" />
      </div>

      {documents === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <DocumentList documents={documents} onSelect={setSelectedDoc} />
      )}

      {showUpload && selectedDivisionId && (
        <UploadDocumentModal
          divisionId={selectedDivisionId}
          folderId={currentFolderId}
          onClose={() => setShowUpload(false)}
          onCreated={(doc) => {
            setDocuments((prev) => (prev ? [doc, ...prev] : [doc]));
            setShowUpload(false);
          }}
        />
      )}
      {selectedDoc && (
        <DocumentDetailDrawer document={selectedDoc} onClose={() => setSelectedDoc(null)} onChange={handleDocChanged} />
      )}
    </div>
  );
}

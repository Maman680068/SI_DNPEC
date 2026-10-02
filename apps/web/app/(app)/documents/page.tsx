'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useOrg } from '../../../lib/org/OrgProvider';
import { getDocument, getDocuments } from '../../../lib/api/documents';
import type { DnpecDocument, DocumentCategory, StatutDiffusion, TypeDocument } from '../../../lib/documents/types';
import { CATEGORY_LABEL, STATUT_LABEL, TYPE_DOCUMENT_LABEL } from '../../../lib/documents/types';
import { FolderNav } from '../../../components/documents/FolderNav';
import { DocumentList } from '../../../components/documents/DocumentList';
import { UploadDocumentModal } from '../../../components/documents/UploadDocumentModal';
import { DocumentDetailDrawer } from '../../../components/documents/DocumentDetailDrawer';
import { Button } from '../../../components/ui/Button';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Tab = 'division' | 'published';
const LEADERSHIP_ROLES = ['DN', 'DNA'];

export default function DocumentsPage() {
  const { user: currentUser } = useAuth();
  const { divisions, cellules } = useOrg();
  const [tab, setTab] = useState<Tab>('division');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const canPickDivision = LEADERSHIP_ROLES.includes(currentUser?.role ?? '');
  // Espace de l'unité productrice : « d:<id> » (division) ou « c:<id> » (cellule rattachée à la Direction).
  const [espace, setEspace] = useState('');
  useEffect(() => {
    if (espace) return;
    if (currentUser?.divisionId) setEspace(`d:${currentUser.divisionId}`);
    else if (currentUser?.celluleId && currentUser.role !== 'STAGIAIRE') setEspace(`c:${currentUser.celluleId}`);
    else if (divisions[0]) setEspace(`d:${divisions[0].id}`);
  }, [currentUser?.divisionId, currentUser?.celluleId, currentUser?.role, divisions, espace]);
  const selectedDivisionId = espace.startsWith('d:') ? espace.slice(2) : '';
  const selectedCelluleId = espace.startsWith('c:') ? espace.slice(2) : '';

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [typeDocument, setTypeDocument] = useState<TypeDocument | ''>('');
  const [statut, setStatut] = useState<StatutDiffusion | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');

  const [documents, setDocuments] = useState<DnpecDocument[] | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DnpecDocument | null>(null);

  const load = useCallback(() => {
    if (tab === 'division' && !espace) return;
    setDocuments(null);
    getDocuments({
      visibility: tab === 'division' ? 'PRIVE_DIVISION' : 'PUBLIE_DNPEC',
      divisionId: tab === 'division' && selectedDivisionId ? selectedDivisionId : undefined,
      celluleId: tab === 'division' && selectedCelluleId ? selectedCelluleId : undefined,
      folderId: tab === 'division' && selectedDivisionId ? currentFolderId ?? undefined : undefined,
      category: category || undefined,
      typeDocument: typeDocument || undefined,
      statutDiffusion: statut || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      q: q || undefined,
    }).then(setDocuments).catch((err) => setErreurChargement(messageChargement(err)));
  }, [tab, espace, selectedDivisionId, selectedCelluleId, currentFolderId, category, typeDocument, statut, dateFrom, dateTo, q]);

  useEffect(() => {
    load();
  }, [load]);

  // Ouverture profonde « /documents?id=<id> » (dépôt depuis un document généré, liens).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) getDocument(id).then(setSelectedDoc).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

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

  const espaceLabel = useMemo(
    () => (selectedDivisionId ? divisions.find((d) => d.id === selectedDivisionId)?.name : cellules.find((c) => c.id === selectedCelluleId)?.name),
    [divisions, cellules, selectedDivisionId, selectedCelluleId],
  );
  const ongletEspace = currentUser?.divisionId || canPickDivision ? 'Mon espace division' : 'Mon espace cellule';

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
          <h1 className="text-[22px] font-extrabold">Archives &amp; documents</h1>
        </div>
        {tab === 'division' && espace && (
          <Button variant="gold" onClick={() => setShowUpload(true)}>
            + Nouveau document
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            { key: 'division', label: ongletEspace },
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
              aria-label="Espace documentaire"
              value={espace}
              onChange={(e) => {
                setEspace(e.target.value);
                setCurrentFolderId(null);
              }}
              className="mb-3 w-full max-w-[280px] rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
            >
              <optgroup label="Divisions">
                {divisions.map((d) => (
                  <option key={d.id} value={`d:${d.id}`}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cellules rattachées à la Direction">
                {cellules.map((c) => (
                  <option key={c.id} value={`c:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          ) : (
            <p className="mb-3 text-[13px] text-text-muted">
              {selectedCelluleId ? 'Cellule' : 'Division'} : <strong>{espaceLabel}</strong>
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
        <select
          aria-label="Type"
          value={typeDocument}
          onChange={(e) => setTypeDocument(e.target.value as TypeDocument | '')}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
        >
          <option value="">Tous types</option>
          {(Object.keys(TYPE_DOCUMENT_LABEL) as TypeDocument[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_DOCUMENT_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="Statut"
          value={statut}
          onChange={(e) => setStatut(e.target.value as StatutDiffusion | '')}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
        >
          <option value="">Tous statuts</option>
          {(Object.keys(STATUT_LABEL) as StatutDiffusion[]).map((t) => (
            <option key={t} value={t}>
              {STATUT_LABEL[t]}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]" />
        <span className="text-[12px] text-text-faint">à</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]" />
      </div>

      {documents === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <DocumentList documents={documents} onSelect={setSelectedDoc} />
      )}

      {showUpload && espace && (
        <UploadDocumentModal
          divisionId={selectedDivisionId || null}
          celluleId={selectedCelluleId || null}
          folderId={selectedDivisionId ? currentFolderId : null}
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

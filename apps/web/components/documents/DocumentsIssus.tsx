'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { getDocuments } from '../../lib/api/documents';
import type { DnpecDocument, TypeDocument } from '../../lib/documents/types';
import { STATUT_LABEL, STATUT_TON, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { messageChargement } from '../ui/ErreurChargement';
import { UploadDocumentModal } from './UploadDocumentModal';

/** Documents de la GED issus d'une tâche ou d'une réunion, et dépôt direct depuis cet écran
 * (socle N4, SIG-RF-GED-08) : le formulaire de la GED est prérempli avec le lien et la période. */
export function DocumentsIssus({ source }: { source: { tacheId?: string; reunionId?: string; libelle: string; type?: TypeDocument; periodeDebut?: string; periodeFin?: string } }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DnpecDocument[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [depot, setDepot] = useState(false);

  const charger = useCallback(() => {
    getDocuments(source.tacheId ? { sourceTaskId: source.tacheId } : { sourceMeetingId: source.reunionId })
      .then(setDocs)
      .catch((e) => setErreur(messageChargement(e)));
  }, [source.tacheId, source.reunionId]);
  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="mb-[22px]" data-testid="documents-issus">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wide text-text-muted">Documents issus{docs ? ` (${docs.length})` : ''}</div>
        {(user?.divisionId || user?.celluleId) && (
          <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => setDepot(true)}>
            Déposer un document
          </Button>
        )}
      </div>
      {erreur && <p className="text-[12.5px] text-clay">{erreur}</p>}
      {docs && docs.length === 0 && <p className="text-[12.5px] text-text-faint">Aucun document déposé depuis cet écran.</p>}
      <ul className="space-y-1.5">
        {docs?.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-[13px]">
            <Link href={`/documents?id=${d.id}`} className="min-w-0 truncate font-semibold text-accent">
              {d.title}
            </Link>
            <span className="flex flex-shrink-0 gap-1">
              <Badge>{TYPE_DOCUMENT_LABEL[d.typeDocument]}</Badge>
              <Badge tone={STATUT_TON[d.statutDiffusion]}>{STATUT_LABEL[d.statutDiffusion]}</Badge>
            </span>
          </li>
        ))}
      </ul>
      {depot && (user?.divisionId || user?.celluleId) && (
        <UploadDocumentModal
          divisionId={user.divisionId}
          celluleId={user.divisionId ? null : user.celluleId}
          folderId={null}
          source={source}
          onClose={() => setDepot(false)}
          onCreated={() => {
            setDepot(false);
            charger();
          }}
        />
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { getDocuments } from '../../lib/api/documents';
import type { DnpecDocument, TypeDocument } from '../../lib/documents/types';
import { STATUT_LABEL, STATUT_PASTILLE, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { BTN_LIGNE, IconeFichier, Pastille } from '../ui/Charte';
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
    <section className="mb-[18px]" data-testid="documents-issus">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink-900">
          Documents issus {docs && <span className="font-semibold text-text-faint">{docs.length}</span>}
        </h3>
        {(user?.divisionId || user?.celluleId) && (
          <button type="button" className={BTN_LIGNE} onClick={() => setDepot(true)}>
            Déposer un document
          </button>
        )}
      </div>
      {erreur && <p className="text-[12.5px] text-clay">{erreur}</p>}
      {docs && docs.length === 0 && <p className="text-[12.5px] text-text-faint">Aucun document déposé depuis cet écran.</p>}
      <ul className="space-y-1.5">
        {docs?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-line px-3 py-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconeFichier nom={d.currentVersion?.fileName ?? d.title} />
              <Link href={`/documents?id=${d.id}`} className="min-w-0 truncate font-semibold text-ink-900 hover:underline">
                {d.title}
              </Link>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1.5">
              <span className="text-[12px] text-text-muted">{TYPE_DOCUMENT_LABEL[d.typeDocument]}</span>
              <Pastille ton={STATUT_PASTILLE[d.statutDiffusion]}>{STATUT_LABEL[d.statutDiffusion]}</Pastille>
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
    </section>
  );
}

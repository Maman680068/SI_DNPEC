'use client';

import { useOrg } from '../../lib/org/OrgProvider';
import type { DnpecDocument } from '../../lib/documents/types';
import { STATUT_LABEL, STATUT_TON, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DocumentList({ documents, onSelect }: { documents: DnpecDocument[]; onSelect: (doc: DnpecDocument) => void }) {
  const { getUserLabel } = useOrg();

  if (documents.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucun document ici pour l&apos;instant.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <Card key={doc.id} onClick={() => onSelect(doc)} className="cursor-pointer p-[18px] hover:border-accent/40">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUT_TON[doc.statutDiffusion]}>{STATUT_LABEL[doc.statutDiffusion]}</Badge>
            <Badge tone={doc.visibility === 'PUBLIE_DNPEC' ? 'sage' : 'accent'}>
              {doc.visibility === 'PUBLIE_DNPEC' ? '🌐 Publié DNPEC' : '🔒 Privé — division'}
            </Badge>
            {doc.isFinal && <Badge tone="gold">Final</Badge>}
          </div>
          <div className="mb-1 text-[14.5px] font-bold leading-snug">{doc.title}</div>
          <div className="mb-2 text-[12px] text-text-faint">
            {TYPE_DOCUMENT_LABEL[doc.typeDocument]} · v{doc.currentVersion?.versionNumber ?? 1} · {formatDate(doc.dateDocument ?? doc.createdAt)}
          </div>
          {doc.description && <p className="mb-2 line-clamp-2 text-[12.5px] text-text-muted">{doc.description}</p>}
          <div className="text-[11px] text-text-faint">Par {getUserLabel(doc.createdById)}</div>
        </Card>
      ))}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { addVersion, changerStatut, downloadVersion, getHistoriqueStatut, getVersions, markFinal, publishDocument, updateDocument } from '../../lib/api/documents';
import type { ChangementStatut, DnpecDocument, DocumentVersionSummary, StatutDiffusion, TypeDocument } from '../../lib/documents/types';
import { CATEGORY_LABEL, STATUT_LABEL, STATUT_TON, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Chargement, messageChargement } from '../ui/ErreurChargement';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}
const jour = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Fiche d'un document : statut de diffusion (§7.1), métadonnées, objet d'origine, versions.
 * Toutes les actions proposées viennent de `doc.droits` (calculés par l'API). */
export function DocumentDetailDrawer({
  document: doc,
  onClose,
  onChange,
}: {
  document: DnpecDocument;
  onClose: () => void;
  onChange: (doc: DnpecDocument) => void;
}) {
  const { getDivisionName, getUserLabel } = useOrg();
  const [versions, setVersions] = useState<DocumentVersionSummary[] | null>(null);
  const [historique, setHistorique] = useState<ChangementStatut[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrait, setRetrait] = useState(false);
  const [motif, setMotif] = useState('');
  const [edition, setEdition] = useState(false);
  const [meta, setMeta] = useState({ typeDocument: doc.typeDocument, periodeDebut: doc.periodeDebut?.slice(0, 10) ?? '', periodeFin: doc.periodeFin?.slice(0, 10) ?? '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { droits } = doc;

  useEffect(() => {
    getVersions(doc.id)
      .then(setVersions)
      .catch((err) => setError(messageChargement(err)));
    getHistoriqueStatut(doc.id)
      .then(setHistorique)
      .catch((err) => setError(messageChargement(err)));
  }, [doc.id, doc.statutDiffusion, doc.currentVersionId]);

  async function agir(fn: () => Promise<DnpecDocument>, apres?: () => void) {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      apres?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  }

  const precedent: Record<StatutDiffusion, StatutDiffusion> = { BROUILLON: 'BROUILLON', VALIDE: 'BROUILLON', DIFFUSABLE: 'VALIDE' };

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={STATUT_TON[doc.statutDiffusion]} data-testid="statut-document">
              {STATUT_LABEL[doc.statutDiffusion]}
            </Badge>
            <Badge tone={doc.visibility === 'PUBLIE_DNPEC' ? 'sage' : 'accent'}>
              {doc.visibility === 'PUBLIE_DNPEC' ? '🌐 Publié DNPEC' : '🔒 Privé — division'}
            </Badge>
            {doc.isFinal && <Badge tone="gold">Final</Badge>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{doc.title}</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          {getDivisionName(doc.divisionId)} · par {getUserLabel(doc.createdById)}
        </p>

        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-line px-3.5 py-2.5 text-[12.5px]" data-testid="metadonnees">
          <dt className="text-text-muted">Type</dt>
          <dd className="font-semibold">{TYPE_DOCUMENT_LABEL[doc.typeDocument]}</dd>
          <dt className="text-text-muted">Date</dt>
          <dd>{jour(doc.dateDocument)}</dd>
          <dt className="text-text-muted">Période couverte</dt>
          <dd>{doc.periodeDebut ? `du ${jour(doc.periodeDebut)} au ${jour(doc.periodeFin)}` : <span className="text-clay">à compléter</span>}</dd>
          <dt className="text-text-muted">Classement</dt>
          <dd>{CATEGORY_LABEL[doc.category]}</dd>
          {doc.source && (
            <>
              <dt className="text-text-muted">Issu de</dt>
              <dd data-testid="source-document">
                {doc.source.titre ? (
                  <Link className="text-accent underline" href={doc.source.type === 'TACHE' ? `/tasks/${doc.source.id}` : `/reunions?id=${doc.source.id}`}>
                    {doc.source.type === 'TACHE' ? 'Tâche' : 'Réunion'} « {doc.source.titre} »
                  </Link>
                ) : (
                  <span className="text-text-faint">{doc.source.type === 'TACHE' ? 'une tâche' : 'une réunion'} hors de votre périmètre</span>
                )}
              </dd>
            </>
          )}
        </dl>

        {droits.modifier && (!doc.metadonneesCompletes || edition) && (
          <form
            className="mb-4 rounded-md border border-dashed border-gold bg-gold-soft px-3.5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              agir(() => updateDocument(doc.id, meta), () => setEdition(false));
            }}
          >
            {!doc.metadonneesCompletes && <p className="mb-2 text-[12.5px]">Métadonnées à compléter avant toute validation.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-[12px] font-semibold">
                Type
                <select className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]" value={meta.typeDocument} onChange={(e) => setMeta({ ...meta, typeDocument: e.target.value as TypeDocument })}>
                  {(Object.keys(TYPE_DOCUMENT_LABEL) as TypeDocument[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_DOCUMENT_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-semibold">
                Du
                <input type="date" required className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]" value={meta.periodeDebut} onChange={(e) => setMeta({ ...meta, periodeDebut: e.target.value })} />
              </label>
              <label className="text-[12px] font-semibold">
                Au
                <input type="date" required className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]" value={meta.periodeFin} onChange={(e) => setMeta({ ...meta, periodeFin: e.target.value })} />
              </label>
            </div>
            <Button type="submit" className="mt-2 !px-3 !py-1.5 !text-[12.5px]" disabled={busy}>
              Enregistrer les métadonnées
            </Button>
          </form>
        )}

        {doc.description && <div className="mb-5 rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">{doc.description}</div>}

        {(droits.valider || droits.rendreDiffusable || droits.retirer) && (
          <div className="mb-5" data-testid="actions-statut">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Statut de diffusion</div>
            {!retrait ? (
              <div className="flex flex-wrap gap-2">
                {droits.valider && (
                  <Button variant="solid" disabled={busy} onClick={() => agir(() => changerStatut(doc.id, 'VALIDE'))}>
                    Valider
                  </Button>
                )}
                {droits.rendreDiffusable && (
                  <Button variant="gold" disabled={busy} onClick={() => agir(() => changerStatut(doc.id, 'DIFFUSABLE'))}>
                    Rendre diffusable
                  </Button>
                )}
                {droits.retirer && (
                  <Button variant="outline" disabled={busy} onClick={() => setRetrait(true)}>
                    Retirer le statut « {STATUT_LABEL[doc.statutDiffusion]} »
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  aria-label="Motif du retrait"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={2}
                  placeholder="Motif (obligatoire) : le document reste consultable en interne."
                  className="mb-2 w-full rounded-md border border-line px-3 py-2 text-[13px]"
                />
                <div className="flex gap-2">
                  <Button variant="solid" className="!border-clay !bg-clay" disabled={busy || motif.trim().length < 5} onClick={() => agir(() => changerStatut(doc.id, precedent[doc.statutDiffusion], motif.trim()), () => (setRetrait(false), setMotif('')))}>
                    Confirmer le retrait
                  </Button>
                  <Button variant="outline" onClick={() => setRetrait(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {(droits.modifier || droits.publier) && (
          <div className="mb-5 flex flex-wrap gap-2.5">
            {droits.marquerFinal && (
              <Button variant="outline" disabled={busy} onClick={() => agir(() => markFinal(doc.id))}>
                Marquer comme final
              </Button>
            )}
            {droits.modifier && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  Ajouter une version
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) agir(() => addVersion(doc.id, f), () => getVersions(doc.id).then(setVersions).catch((err) => setError(messageChargement(err))));
                  }}
                />
                {doc.metadonneesCompletes && !edition && (
                  <Button variant="outline" disabled={busy} onClick={() => setEdition(true)}>
                    Modifier les métadonnées
                  </Button>
                )}
              </>
            )}
            {droits.publier && (
              <Button variant="gold" disabled={busy} onClick={() => agir(() => publishDocument(doc.id))}>
                Publier (toute la DNPEC)
              </Button>
            )}
          </div>
        )}
        {droits.modifier && doc.statutDiffusion !== 'BROUILLON' && (
          <p className="mb-4 text-[12px] text-text-faint">Une nouvelle version ramène le document au statut « Brouillon ».</p>
        )}
        {error && <div className="mb-5 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">Versions</div>
        <p className="mb-2 text-[11.5px] text-text-faint">Le fichier téléchargé porte la mention de son statut.</p>
        {versions === null ? (
          <Chargement erreur={error} className="text-[13px] text-text-muted" />
        ) : (
          <div className="mb-5 space-y-1.5">
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
                  onClick={() => downloadVersion(doc.id, version.id).catch((err) => setError(err instanceof Error ? err.message : 'Téléchargement impossible'))}
                  className="flex-shrink-0 text-[12.5px] font-semibold text-accent"
                >
                  Télécharger
                </button>
              </div>
            ))}
          </div>
        )}

        {historique && historique.length > 0 && (
          <>
            <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">Historique du statut</div>
            <ul className="space-y-1.5 text-[12.5px]" data-testid="historique-statut">
              {historique.map((h) => (
                <li key={h.id} className="rounded-md bg-bg px-3 py-2">
                  <span className="font-semibold">{h.de ? `${STATUT_LABEL[h.de]} → ` : ''}{STATUT_LABEL[h.vers]}</span> · {formatDateTime(h.le)} · {h.par ?? '—'}
                  {h.motif && <div className="text-text-muted">{h.motif}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

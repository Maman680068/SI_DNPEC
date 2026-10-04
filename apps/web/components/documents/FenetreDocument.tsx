'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Globe, Lock, Plus } from 'lucide-react';
import { useOrg } from '../../lib/org/OrgProvider';
import { addVersion, changerStatut, downloadVersion, getHistoriqueStatut, getVersions, markFinal, publishDocument, updateDocument } from '../../lib/api/documents';
import type { ChangementStatut, DnpecDocument, DocumentVersionSummary, Folder, StatutDiffusion, TypeDocument } from '../../lib/documents/types';
import { CATEGORY_LABEL, STATUT_LABEL, STATUT_PASTILLE, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { cheminDossier, dateCourte, dateHeure, dateLongue, periodeLongue, taille } from '../../lib/documents/affichage';
import { BTN_DANGER_CONTOUR, BTN_PRINCIPAL, BTN_SECONDAIRE, BTN_SUCCES, CleValeur, Etapes, IconeFichier, MarqueFinal, Pastille, SectionFenetre, type EtatEtape } from '../ui/Charte';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { FenetreDetail } from '../ui/FenetreDetail';

const BANDEAU_APERCU: Record<StatutDiffusion, { texte: string; classe: string }> = {
  BROUILLON: { texte: 'BROUILLON — non validé', classe: 'bg-[#F0F1F5] text-[#4B5263]' },
  VALIDE: { texte: 'VALIDÉ', classe: 'bg-[#E6F0FA] text-[#1D5FA0]' },
  DIFFUSABLE: { texte: 'DIFFUSABLE', classe: 'bg-sage-50 text-sage' },
};

/**
 * Vignette de la première page : feuille stylisée (lignes grises) avec le bandeau de statut que porte
 * la copie téléchargée, et l'icône du type de fichier. Pas de rendu réel du fichier (trop lourd).
 */
function Apercu({ statut, nomFichier }: { statut: StatutDiffusion; nomFichier: string }) {
  const bandeau = BANDEAU_APERCU[statut];
  return (
    <div className="relative flex h-[200px] items-end justify-center overflow-hidden rounded-xl border border-line bg-[#F2F3F7]" data-testid="apercu-statut">
      <div aria-hidden className="h-[178px] w-[150px] rounded-t-[4px] bg-white shadow-[0_2px_10px_rgba(18,28,77,0.12)]">
        <div className={`px-1.5 py-[3px] text-center text-[8.5px] font-extrabold tracking-wide ${bandeau.classe}`}>{bandeau.texte}</div>
        <div className="space-y-[7px] px-3.5 pt-3.5">
          {[70, 100, 100, 85, 100, 60, 100, 80].map((l, i) => (
            <i key={i} className="block h-1 rounded-sm bg-[#DDE0EA]" style={{ width: `${l}%` }} />
          ))}
        </div>
      </div>
      <span className="absolute bottom-3 right-3">
        <IconeFichier nom={nomFichier} grand />
      </span>
      <span className="sr-only">Aperçu de la première page : bandeau « {bandeau.texte} »</span>
    </div>
  );
}

/**
 * Fenêtre d'un document de la GED (refonte de l'interface, maquette validée) : fil d'Ariane unité ›
 * dossiers, étapes du statut de diffusion (§7.1), aperçu stylisé, informations, versions, historique ;
 * à droite les actions — toutes issues de `doc.droits` (calculés par l'API) — puis statut, auteur,
 * date de dépôt et publication.
 */
export function FenetreDocument({
  document: doc,
  dossiers,
  onClose,
  onChange,
}: {
  document: DnpecDocument;
  dossiers: Folder[];
  onClose: () => void;
  onChange: (doc: DnpecDocument) => void;
}) {
  const { getDivisionName, getCelluleName, getUserLabel, getUserInitials } = useOrg();
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
  const unite = doc.divisionId ? getDivisionName(doc.divisionId) : getCelluleName(doc.celluleId);
  const typeUnite = doc.divisionId ? 'division' : 'cellule';
  const chemin = cheminDossier(doc.folderId, dossiers).map((f) => f.name);
  const ordre: StatutDiffusion[] = ['BROUILLON', 'VALIDE', 'DIFFUSABLE'];
  const rang = ordre.indexOf(doc.statutDiffusion);
  const etat = (i: number): EtatEtape => (i < rang || (i === 2 && rang === 2) ? 'fait' : i === rang ? 'courant' : 'avenir');
  const etapes = (
    <Etapes
      label="Étapes du statut de diffusion"
      etapes={[
        { label: doc.isFinal ? 'Brouillon · Final' : 'Brouillon', etat: etat(0) },
        { label: `Validé par le chef de ${typeUnite}`, etat: etat(1) },
        { label: 'Diffusable (DN ou DNA)', etat: etat(2) },
      ]}
    />
  );

  // Ce qui manque pour valider (même règle que l'API : Final et période couverte renseignée).
  const manques = [!doc.isFinal && 'le document doit être marqué « Final »', !doc.metadonneesCompletes && 'la période couverte doit être renseignée'].filter((x): x is string => !!x);
  const phraseValidation =
    doc.statutDiffusion !== 'BROUILLON'
      ? null
      : manques.length === 0
        ? `Toutes les informations obligatoires sont remplies : la validation est possible.${droits.valider ? ' Une fois validé, le DN ou la DNA pourra le rendre diffusable.' : ''}`
        : `Avant la validation : ${manques.join(' ; ')}.`;
  const publication = doc.visibility === 'PUBLIE_DNPEC';
  const publierPlusTard = droits.publier && doc.statutDiffusion === 'BROUILLON';

  const contenu = (
    <>
      <Apercu statut={doc.statutDiffusion} nomFichier={doc.currentVersion?.fileName ?? ''} />

      <SectionFenetre titre="Informations" className="mb-[18px] mt-4">
        <div data-testid="metadonnees">
          <CleValeur
            largeur={130}
            lignes={[
              ['Type', TYPE_DOCUMENT_LABEL[doc.typeDocument]],
              ['Date du document', dateLongue(doc.dateDocument)],
              ['Période couverte', periodeLongue(doc.periodeDebut, doc.periodeFin) ?? <span className="text-clay">À compléter</span>],
              [
                'Confidentialité',
                <span key="c" className="inline-flex items-center gap-1.5">
                  {publication ? <Globe aria-hidden size={13} /> : <Lock aria-hidden size={13} />}
                  {publication ? 'Publié pour toute la DNPEC' : `Privé — ${unite ?? typeUnite}`}
                </span>,
              ],
              ['Classement', CATEGORY_LABEL[doc.category]],
              ...(doc.source
                ? ([
                    [
                      'Lié à',
                      <span key="s" data-testid="source-document">
                        {doc.source.titre ? (
                          <Link className="text-ink hover:underline" href={doc.source.type === 'TACHE' ? `/tasks/${doc.source.id}` : `/reunions?id=${doc.source.id}`}>
                            {doc.source.type === 'TACHE' ? 'Tâche' : 'Réunion'} « {doc.source.titre} »
                          </Link>
                        ) : (
                          <span className="font-normal text-text-muted">{doc.source.type === 'TACHE' ? 'une tâche' : 'une réunion'} hors de votre périmètre</span>
                        )}
                      </span>,
                    ],
                  ] as [string, ReactNode][])
                : []),
            ]}
          />
        </div>
        {doc.description && <p className="mt-3 whitespace-pre-line rounded-md bg-bg p-3 text-[13px] leading-relaxed text-[#3A4152]">{doc.description}</p>}
      </SectionFenetre>

      {droits.modifier && (!doc.metadonneesCompletes || edition) && (
        <form
          className="mb-[18px] rounded-[10px] border border-dashed border-gold bg-gold-50 px-3.5 py-3"
          data-testid="edition-metadonnees"
          onSubmit={(e) => {
            e.preventDefault();
            agir(() => updateDocument(doc.id, meta), () => setEdition(false));
          }}
        >
          <p className="mb-2 text-[12.5px] font-semibold">{doc.metadonneesCompletes ? 'Modifier les informations' : 'Métadonnées à compléter avant toute validation.'}</p>
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
          <div className="mt-2.5 flex gap-2">
            <button type="submit" className={`${BTN_PRINCIPAL} !h-[34px] !text-[13px]`} disabled={busy}>
              Enregistrer les métadonnées
            </button>
            {edition && (
              <button type="button" className={`${BTN_SECONDAIRE} !h-[34px] !text-[13px]`} onClick={() => setEdition(false)}>
                Annuler
              </button>
            )}
          </div>
        </form>
      )}

      <SectionFenetre titre="Versions" n={versions?.length}>
        <p className="mb-2 text-[12px] text-text-muted">Le fichier téléchargé porte la mention de son statut.</p>
        {versions === null ? (
          <Chargement erreur={error} className="text-[13px] text-text-muted" />
        ) : (
          <ul className="divide-y divide-[#F0F1F6]">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-[26px] min-w-[34px] flex-none place-items-center rounded-[7px] bg-ink-50 px-1.5 text-[12px] font-bold text-ink">v{version.versionNumber}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold">{version.fileName}</b>
                  <small className="block text-[12px] text-text-muted">
                    {taille(version.sizeBytes)} · {getUserLabel(version.uploadedById)} · {dateHeure(version.uploadedAt)}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label={`Télécharger la version ${version.versionNumber} (${version.fileName})`}
                  onClick={() => downloadVersion(doc.id, version.id).catch((err) => setError(err instanceof Error ? err.message : 'Téléchargement impossible'))}
                  className="flex-none text-[13px] font-bold text-ink hover:underline"
                >
                  Télécharger
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionFenetre>

      {historique && historique.length > 0 && (
        <SectionFenetre titre="Historique du statut" n={historique.length} className="mb-0">
          <ul className="space-y-1.5 text-[12.5px]" data-testid="historique-statut">
            {historique.map((h) => (
              <li key={h.id} className="rounded-md bg-bg px-3 py-2">
                <span className="font-semibold">
                  {h.de ? `${STATUT_LABEL[h.de]} → ` : ''}
                  {STATUT_LABEL[h.vers]}
                </span>{' '}
                · {dateHeure(h.le)} · {h.par ?? '—'}
                {h.motif && <div className="text-text-muted">{h.motif}</div>}
              </li>
            ))}
          </ul>
        </SectionFenetre>
      )}
    </>
  );

  const cote = (
    <>
      <div className="flex flex-col gap-2" data-testid="actions-document">
        {(droits.valider || droits.rendreDiffusable || droits.retirer) && (
          <div className="flex flex-col gap-2" data-testid="actions-statut">
            {!retrait ? (
              <>
                {droits.valider && (
                  <button type="button" className={BTN_SUCCES} disabled={busy || manques.length > 0} onClick={() => agir(() => changerStatut(doc.id, 'VALIDE'))}>
                    <Check aria-hidden size={17} strokeWidth={2.5} /> Valider le document
                  </button>
                )}
                {droits.rendreDiffusable && (
                  <button type="button" className={`${BTN_SUCCES} !h-10`} disabled={busy} onClick={() => agir(() => changerStatut(doc.id, 'DIFFUSABLE'))}>
                    Rendre diffusable
                  </button>
                )}
                {droits.retirer && (
                  <button type="button" className={BTN_DANGER_CONTOUR} disabled={busy} onClick={() => setRetrait(true)}>
                    Retirer le statut « {STATUT_LABEL[doc.statutDiffusion]} »
                  </button>
                )}
              </>
            ) : (
              <div>
                <label htmlFor="motif-retrait" className="mb-1 block text-[12.5px] font-semibold">
                  Motif du retrait
                </label>
                <textarea
                  id="motif-retrait"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  placeholder="Motif (obligatoire) : le document reste consultable en interne."
                  className="mb-2 w-full rounded-[9px] border border-line px-3 py-2 text-[13px] focus:border-ink focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-10 flex-1 rounded-[10px] bg-clay px-3 text-[14px] font-bold text-white disabled:opacity-50"
                    disabled={busy || motif.trim().length < 5}
                    onClick={() => agir(() => changerStatut(doc.id, precedent[doc.statutDiffusion], motif.trim()), () => (setRetrait(false), setMotif('')))}
                  >
                    Confirmer le retrait
                  </button>
                  <button type="button" className={`${BTN_SECONDAIRE} !h-10`} onClick={() => setRetrait(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {droits.marquerFinal && (
          <button type="button" className={`${BTN_SECONDAIRE} !h-10`} disabled={busy} onClick={() => agir(() => markFinal(doc.id))}>
            Marquer comme final
          </button>
        )}
        {droits.modifier && (
          <>
            <button type="button" className={`${BTN_SECONDAIRE} !h-10`} disabled={busy} onClick={() => fileInputRef.current?.click()}>
              <Plus aria-hidden size={15} /> Ajouter une version
            </button>
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Fichier de la nouvelle version"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) agir(() => addVersion(doc.id, f), () => getVersions(doc.id).then(setVersions).catch((err) => setError(messageChargement(err))));
              }}
            />
            {doc.metadonneesCompletes && !edition && (
              <button type="button" className={`${BTN_SECONDAIRE} !h-10`} disabled={busy} onClick={() => setEdition(true)}>
                Modifier les informations
              </button>
            )}
          </>
        )}
        {phraseValidation && (droits.valider || droits.modifier) && (
          <p className="text-[12.5px] leading-[1.45] text-text-muted" data-testid="phrase-validation">
            {phraseValidation}
          </p>
        )}
        {droits.modifier && doc.statutDiffusion !== 'BROUILLON' && <p className="text-[12px] leading-[1.45] text-text-muted">Une nouvelle version ramène le document au statut « Brouillon ».</p>}
        {error && (
          <div role="alert" className="rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
            {error}
          </div>
        )}
      </div>

      <div className="my-4 h-px bg-line" />
      <dl className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-y-[13px] text-[13px]">
        <dt className="text-text-muted">Statut</dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          <Pastille ton={STATUT_PASTILLE[doc.statutDiffusion]} testid="statut-document">
            {STATUT_LABEL[doc.statutDiffusion]}
          </Pastille>
          {doc.isFinal && <MarqueFinal />}
        </dd>
        <dt className="text-text-muted">Auteur</dt>
        <dd className="flex items-center gap-[7px] font-semibold">
          <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink-50 text-[10px] font-bold text-ink">
            {getUserInitials(doc.createdById)}
          </span>
          {getUserLabel(doc.createdById)}
        </dd>
        <dt className="text-text-muted">Déposé le</dt>
        <dd className="font-semibold">{dateCourte(doc.createdAt)}</dd>
        {publication && doc.publishedAt && (
          <>
            <dt className="text-text-muted">Publié le</dt>
            <dd className="font-semibold">{dateCourte(doc.publishedAt)}</dd>
          </>
        )}
      </dl>

      {droits.publier && (
        <>
          <div className="my-4 h-px bg-line" />
          <button type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={busy || publierPlusTard} onClick={() => agir(() => publishDocument(doc.id))}>
            Publier pour toute la DNPEC
          </button>
          <p className="mt-1.5 text-[12.5px] text-text-muted">{publierPlusTard ? 'Disponible après validation.' : 'Le document sera visible de toute la DNPEC.'}</p>
        </>
      )}
    </>
  );

  return (
    <FenetreDetail titre={doc.title} onClose={onClose} filAriane={[unite, ...chemin]} entete={etapes} cote={cote} largeur={920} testid="fenetre-document">
      {contenu}
    </FenetreDetail>
  );
}

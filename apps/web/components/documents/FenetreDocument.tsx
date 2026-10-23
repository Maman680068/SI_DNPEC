'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Globe, Lock, PenLine, Plus } from 'lucide-react';
import { useOrg } from '../../lib/org/OrgProvider';
import { addVersion, changerStatut, downloadVersion, getHistoriqueStatut, getVersions, markFinal, publishDocument, updateDocument } from '../../lib/api/documents';
import type { ChangementStatut, DnpecDocument, DocumentVersionSummary, Folder, StatutDiffusion, TypeDocument } from '../../lib/documents/types';
import { CATEGORY_LABEL, STATUT_LABEL, STATUT_PASTILLE, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { cheminDossier, dateCourte, dateHeure, dateLongue, periodeLongue, taille } from '../../lib/documents/affichage';
import { BTN_DANGER_CONTOUR, BTN_PRINCIPAL, BTN_SECONDAIRE, BTN_SUCCES, CleValeur, Etapes, IconeFichier, MarqueFinal, Pastille, SectionFenetre, type EtatEtape } from '../ui/Charte';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { FenetreDetail } from '../ui/FenetreDetail';
import { ChampDate, FenetreFormulaire, Grille2, Liste, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { useEnvoi } from '../courrier/formulaire';

const BANDEAU_APERCU: Record<StatutDiffusion, { texte: string; classe: string }> = {
  BROUILLON: { texte: 'BROUILLON — non validé', classe: 'bg-fond-gris text-text-fort' },
  VALIDE: { texte: 'VALIDÉ', classe: 'bg-bleu-50 text-bleu' },
  DIFFUSABLE: { texte: 'DIFFUSABLE', classe: 'bg-sage-50 text-sage' },
};

/**
 * Vignette de la première page : feuille stylisée (lignes grises) avec le bandeau de statut que porte
 * la copie téléchargée, et l'icône du type de fichier. Pas de rendu réel du fichier (trop lourd).
 */
function Apercu({ statut, nomFichier }: { statut: StatutDiffusion; nomFichier: string }) {
  const bandeau = BANDEAU_APERCU[statut];
  return (
    <div className="relative flex h-[200px] items-end justify-center overflow-hidden rounded-xl border border-line bg-survol" data-testid="apercu-statut">
      <div aria-hidden data-apercu-papier className="h-[178px] w-[150px] rounded-t-[4px] bg-white shadow-[0_2px_10px_rgba(18,28,77,0.12)]">
        <div className={`px-1.5 py-[3px] text-center text-[8.5px] font-extrabold tracking-wide ${bandeau.classe}`}>{bandeau.texte}</div>
        <div className="space-y-[7px] px-3.5 pt-3.5">
          {[70, 100, 100, 85, 100, 60, 100, 80].map((l, i) => (
            <i key={i} className="block h-1 rounded-sm bg-fond-gris" style={{ width: `${l}%` }} />
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
  const toast = useToast();
  const [versions, setVersions] = useState<DocumentVersionSummary[] | null>(null);
  const [historique, setHistorique] = useState<ChangementStatut[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<'retrait' | 'informations' | 'version' | null>(null);
  const { droits } = doc;

  useEffect(() => {
    getVersions(doc.id)
      .then(setVersions)
      .catch((err) => setError(messageChargement(err)));
    getHistoriqueStatut(doc.id)
      .then(setHistorique)
      .catch((err) => setError(messageChargement(err)));
  }, [doc.id, doc.statutDiffusion, doc.currentVersionId]);

  /** Action directe (bouton de la colonne) : message de confirmation, ou d'erreur en français. */
  async function agir(fn: () => Promise<DnpecDocument>, succes: { titre: string; detail?: string }) {
    setBusy(true);
    try {
      onChange(await fn());
      toast.succes(succes.titre, { detail: succes.detail });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err));
    } finally {
      setBusy(false);
    }
  }
  const apresFenetre = (d: DnpecDocument, titre: string, detail?: string) => {
    setFenetre(null);
    onChange(d);
    toast.succes(titre, { detail });
  };

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
        {doc.description && <p className="mt-3 whitespace-pre-line rounded-md bg-bg p-3 text-[13px] leading-relaxed text-text-fort">{doc.description}</p>}
      </SectionFenetre>

      {droits.modifier && !doc.metadonneesCompletes && (
        <div className="mb-[18px] flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-gold bg-gold-50 px-3.5 py-3" data-testid="metadonnees-a-completer">
          <p className="min-w-0 flex-1 text-[12.5px] font-semibold">Métadonnées à compléter avant toute validation.</p>
          <button type="button" className={`${BTN_PRINCIPAL} !h-[34px] !text-[13px]`} onClick={() => setFenetre('informations')}>
            <PenLine aria-hidden size={15} /> Compléter les informations
          </button>
        </div>
      )}

      <SectionFenetre titre="Versions" n={versions?.length}>
        <p className="mb-2 text-[12px] text-text-muted">Le fichier téléchargé porte la mention de son statut.</p>
        {versions === null ? (
          <Chargement erreur={error} className="text-[13px] text-text-muted" />
        ) : (
          <ul className="divide-y divide-line-doux">
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
                  onClick={() => downloadVersion(doc.id, version.id).catch((err) => toast.erreur('Téléchargement impossible', messageErreur(err)))}
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
            {droits.valider && (
              <button type="button" className={BTN_SUCCES} disabled={busy || manques.length > 0} onClick={() => agir(() => changerStatut(doc.id, 'VALIDE'), { titre: 'Document validé', detail: 'Le DN ou la DNA peut le rendre diffusable.' })}>
                <Check aria-hidden size={17} strokeWidth={2.5} /> Valider le document
              </button>
            )}
            {droits.rendreDiffusable && (
              <button type="button" className={`${BTN_SUCCES} !h-10`} disabled={busy} onClick={() => agir(() => changerStatut(doc.id, 'DIFFUSABLE'), { titre: 'Document rendu diffusable', detail: 'Il peut désormais être diffusé.' })}>
                Rendre diffusable
              </button>
            )}
            {droits.retirer && (
              <button type="button" className={BTN_DANGER_CONTOUR} disabled={busy} onClick={() => setFenetre('retrait')}>
                Retirer le statut « {STATUT_LABEL[doc.statutDiffusion]} »
              </button>
            )}
          </div>
        )}
        {droits.marquerFinal && (
          <button type="button" className={`${BTN_SECONDAIRE} !h-10`} disabled={busy} onClick={() => agir(() => markFinal(doc.id), { titre: 'Document marqué final', detail: 'Il pourra être validé par le chef de son unité.' })}>
            Marquer comme final
          </button>
        )}
        {droits.modifier && (
          <>
            <button type="button" className={`${BTN_SECONDAIRE} !h-10`} disabled={busy} onClick={() => setFenetre('version')}>
              <Plus aria-hidden size={15} /> Ajouter une version
            </button>
            {doc.metadonneesCompletes && (
              <button type="button" className={`${BTN_SECONDAIRE} !h-10`} disabled={busy} onClick={() => setFenetre('informations')}>
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
          <button type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={busy || publierPlusTard} onClick={() => agir(() => publishDocument(doc.id), { titre: 'Document publié', detail: 'Il est visible de toute la DNPEC.' })}>
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
      {fenetre === 'retrait' && (
        <FenetreRetrait
          doc={doc}
          vers={precedent[doc.statutDiffusion]}
          onClose={() => setFenetre(null)}
          onFait={(d) => apresFenetre(d, 'Statut retiré', `Le document revient au statut « ${STATUT_LABEL[d.statutDiffusion]} ».`)}
        />
      )}
      {fenetre === 'informations' && <FenetreInformations doc={doc} onClose={() => setFenetre(null)} onFait={(d) => apresFenetre(d, 'Informations enregistrées')} />}
      {fenetre === 'version' && (
        <FenetreVersion
          doc={doc}
          onClose={() => setFenetre(null)}
          onFait={(d) => {
            apresFenetre(d, 'Nouvelle version ajoutée', d.currentVersion ? `${d.currentVersion.fileName} (v${d.currentVersion.versionNumber}).` : undefined);
            getVersions(doc.id)
              .then(setVersions)
              .catch((err) => setError(messageChargement(err)));
          }}
        />
      )}
    </FenetreDetail>
  );
}

/** Retrait d'un statut de diffusion : motif obligatoire (5 caractères au moins, règle de l'API). */
function FenetreRetrait({ doc, vers, onClose, onFait }: { doc: DnpecDocument; vers: StatutDiffusion; onClose: () => void; onFait: (d: DnpecDocument) => void }) {
  const [motif, setMotif] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={`Retirer le statut « ${STATUT_LABEL[doc.statutDiffusion]} »`}
      sousTitre={`« ${doc.title} » revient au statut « ${STATUT_LABEL[vers]} ». Il reste consultable en interne.`}
      libelleValider="Confirmer le retrait"
      danger
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le motif est conservé dans l’historique du statut."
      valider={() => (motif.trim() && motif.trim().length < 5 ? { 'motif-retrait': 'Le motif doit compter au moins 5 caractères.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => changerStatut(doc.id, vers, motif.trim()));
        if (r.ok) onFait(r.valeur);
      }}
    >
      <ZoneTexte id="motif-retrait" label="Motif du retrait" value={motif} onChange={setMotif} required lignes={3} maxLength={1000} messageObligatoire="Indiquez le motif du retrait." />
    </FenetreFormulaire>
  );
}

/** Type et période couverte (métadonnées obligatoires avant la validation). */
function FenetreInformations({ doc, onClose, onFait }: { doc: DnpecDocument; onClose: () => void; onFait: (d: DnpecDocument) => void }) {
  const [meta, setMeta] = useState({ typeDocument: doc.typeDocument, periodeDebut: doc.periodeDebut?.slice(0, 10) ?? '', periodeFin: doc.periodeFin?.slice(0, 10) ?? '' });
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={doc.metadonneesCompletes ? 'Modifier les informations' : 'Compléter les informations'}
      sousTitre={`« ${doc.title} »`}
      libelleValider="Enregistrer les informations"
      largeur={640}
      testid="edition-metadonnees"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Type et période couverte sont exigés avant toute validation."
      valider={() => (meta.periodeDebut && meta.periodeFin && meta.periodeFin < meta.periodeDebut ? { 'meta-fin': 'La fin de la période ne peut pas précéder son début.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => updateDocument(doc.id, meta));
        if (r.ok) onFait(r.valeur);
      }}
    >
      <Liste
        id="meta-type"
        label="Type"
        value={meta.typeDocument}
        onChange={(t) => setMeta({ ...meta, typeDocument: t as TypeDocument })}
        options={(Object.keys(TYPE_DOCUMENT_LABEL) as TypeDocument[]).map((t) => ({ value: t, label: TYPE_DOCUMENT_LABEL[t] }))}
        required
      />
      <Grille2>
        <ChampDate id="meta-debut" label="Période couverte : du" value={meta.periodeDebut} onChange={(periodeDebut) => setMeta({ ...meta, periodeDebut })} required messageObligatoire="Indiquez le début de la période couverte." />
        <ChampDate id="meta-fin" label="Au" value={meta.periodeFin} min={meta.periodeDebut || undefined} onChange={(periodeFin) => setMeta({ ...meta, periodeFin })} required messageObligatoire="Indiquez la fin de la période couverte." />
      </Grille2>
    </FenetreFormulaire>
  );
}

/** Nouvelle version du fichier (le document revient au statut « Brouillon »). */
function FenetreVersion({ doc, onClose, onFait }: { doc: DnpecDocument; onClose: () => void; onFait: (d: DnpecDocument) => void }) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Ajouter une version"
      sousTitre={`« ${doc.title} »${doc.currentVersion ? ` — version actuelle : v${doc.currentVersion.versionNumber}` : ''}`}
      libelleValider="Ajouter la version"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied={doc.statutDiffusion !== 'BROUILLON' ? 'Une nouvelle version ramène le document au statut « Brouillon ».' : 'Les versions précédentes restent téléchargeables.'}
      onSubmit={async () => {
        const r = await envoyer(() => addVersion(doc.id, fichiers[0]!));
        if (r.ok) onFait(r.valeur);
      }}
    >
      <ZoneDepot id="version-fichier" label="Fichier de la nouvelle version" fichiers={fichiers} onChange={setFichiers} required />
    </FenetreFormulaire>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { CircleCheck, Folder as IconeDossier, Plus } from 'lucide-react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useOrg } from '../../../lib/org/OrgProvider';
import { getDocument, getDocuments, getFolders, getSyntheseArchives } from '../../../lib/api/documents';
import type { DnpecDocument, Folder, StatutDiffusion, SyntheseArchives, TypeDocument } from '../../../lib/documents/types';
import { STATUT_LABEL, TYPE_DOCUMENT_LABEL } from '../../../lib/documents/types';
import { bornesPeriode, cheminDossier, type ChoixPeriode } from '../../../lib/documents/affichage';
import { FolderNav, type FolderNavHandle } from '../../../components/documents/FolderNav';
import { DocumentList } from '../../../components/documents/DocumentList';
import { UploadDocumentModal } from '../../../components/documents/UploadDocumentModal';
import { FenetreDocument } from '../../../components/documents/FenetreDocument';
import { BarreOutils, Bandeau, BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage, EtatVide, FiltreSelect, Onglets, Recherche } from '../../../components/ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { useDemandeCreation } from '../../../lib/navigation/creer';

type Tab = 'division' | 'published';
const LEADERSHIP_ROLES = ['DN', 'DNA'];

// Filtre « Période couverte » : chevauchement avec la période couverte du document (couvreDu / couvreAu de GET /documents).
const PERIODES: { value: ChoixPeriode; label: string }[] = [
  { value: '', label: 'Période couverte' },
  { value: 'annee', label: 'Cette année' },
  { value: 'precedente', label: 'Année précédente' },
  { value: '12mois', label: '12 derniers mois' },
  { value: 'perso', label: 'Personnalisée…' },
];

export default function DocumentsPage() {
  const { user: currentUser } = useAuth();
  const { divisions, cellules, getUserLabel } = useOrg();
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
  const [typeDocument, setTypeDocument] = useState<TypeDocument | ''>('');
  const [statut, setStatut] = useState<StatutDiffusion | ''>('');
  const [periode, setPeriode] = useState<ChoixPeriode>('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [auteur, setAuteur] = useState('');
  const [q, setQ] = useState('');

  const [documents, setDocuments] = useState<DnpecDocument[] | null>(null);
  const [dossiers, setDossiers] = useState<Folder[] | null>(null);
  const [erreurDossiers, setErreurDossiers] = useState<string | null>(null);
  const [synthese, setSynthese] = useState<SyntheseArchives | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [fichierDepose, setFichierDepose] = useState<File | null>(null);
  const [survol, setSurvol] = useState(false);
  const arbre = useRef<FolderNavHandle>(null);
  // Menu « Créer » de la barre du haut (« /documents?nouveau=1 ») : dépôt dans l'espace de l'unité,
  // une fois l'espace connu.
  useDemandeCreation(
    'document',
    () => {
      setTab('division');
      setFichierDepose(null);
      setShowUpload(true);
    },
    !!espace,
  );
  const [selectedDoc, setSelectedDoc] = useState<DnpecDocument | null>(null);

  const { couvreDu, couvreAu } = bornesPeriode(periode, du, au);

  // Liste de l'espace (ou des publiés) avec les filtres de l'API ; le dossier et l'auteur se
  // choisissent ensuite dans la liste chargée (compteurs de l'arborescence, auteurs proposés).
  const load = useCallback(() => {
    if (tab === 'division' && !espace) return;
    setDocuments(null);
    getDocuments({
      visibility: tab === 'division' ? 'PRIVE_DIVISION' : 'PUBLIE_DNPEC',
      divisionId: tab === 'division' && selectedDivisionId ? selectedDivisionId : undefined,
      celluleId: tab === 'division' && selectedCelluleId ? selectedCelluleId : undefined,
      typeDocument: typeDocument || undefined,
      statutDiffusion: statut || undefined,
      couvreDu,
      couvreAu,
      q: q || undefined,
    })
      .then(setDocuments)
      .catch((err) => setErreurChargement(messageChargement(err)));
  }, [tab, espace, selectedDivisionId, selectedCelluleId, typeDocument, statut, couvreDu, couvreAu, q]);

  useEffect(() => {
    load();
  }, [load]);

  const chargerSynthese = useCallback(() => {
    getSyntheseArchives()
      .then(setSynthese)
      .catch((err) => setErreurChargement(messageChargement(err)));
  }, []);
  useEffect(() => {
    chargerSynthese();
  }, [chargerSynthese]);

  // Arborescence des dossiers : propre aux divisions ; lecture réservée aux membres de la division
  // (l'API répond 403 aux autres, message affiché à la place des dossiers).
  useEffect(() => {
    setDossiers(null);
    setErreurDossiers(null);
    if (!selectedDivisionId) return;
    getFolders(selectedDivisionId)
      .then(setDossiers)
      .catch((err) => setErreurDossiers(messageChargement(err)));
  }, [selectedDivisionId]);

  // Ouverture profonde « /documents?id=<id> » (dépôt depuis un document généré, liens).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // « Voir tout » de la recherche transverse (socle N5) : filtre de recherche du module prérempli.
    const recherche = params.get('q');
    if (recherche) setQ(recherche);
    const id = params.get('id');
    if (id) ouvrir(id);
  }, []);

  function ouvrir(id: string) {
    getDocument(id)
      .then(setSelectedDoc)
      .catch((err) => setErreurChargement(messageChargement(err)));
  }

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
    chargerSynthese();
  }

  const espaceLabel = useMemo(
    () => (selectedDivisionId ? divisions.find((d) => d.id === selectedDivisionId)?.name : cellules.find((c) => c.id === selectedCelluleId)?.name),
    [divisions, cellules, selectedDivisionId, selectedCelluleId],
  );
  // « Espace de la Division Prévisions », « Espace du Service administratif et financier ».
  const article = (nom: string) => (/^(division|cellule)\b/i.test(nom) ? 'de la ' : /^(service|centre|comité|bureau)\b/i.test(nom) ? 'du ' : 'de ');
  const ongletEspace = espaceLabel ? `Espace ${article(espaceLabel)}${espaceLabel}` : currentUser?.divisionId || canPickDivision ? 'Mon espace division' : 'Mon espace cellule';

  // Arborescence : un dossier compte (et montre) ses documents et ceux de ses sous-dossiers ;
  // filtres « dossier » et « auteur » appliqués à la liste chargée.
  const avecArbre = tab === 'division' && !!selectedDivisionId;
  const ancetres = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of dossiers ?? []) m.set(f.id, cheminDossier(f.id, dossiers ?? []).map((x) => x.id));
    return m;
  }, [dossiers]);
  const compteurs = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents ?? []) for (const id of (d.folderId && ancetres.get(d.folderId)) || []) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [documents, ancetres]);
  const auteurs = useMemo(() => [...new Set((documents ?? []).map((d) => d.createdById))], [documents]);
  const visibles = useMemo(
    () => (documents ?? []).filter((d) => (!avecArbre || currentFolderId === null || (!!d.folderId && (ancetres.get(d.folderId) ?? []).includes(currentFolderId))) && (!auteur || d.createdById === auteur)),
    [documents, avecArbre, currentFolderId, auteur, ancetres],
  );
  const dossierCourant = dossiers?.find((f) => f.id === currentFolderId) ?? null;
  const destination = dossierCourant ? dossierCourant.name : avecArbre ? 'Tous les documents' : (espaceLabel ?? 'Tous les documents');
  const peutDeposer = tab === 'division' && !!espace;
  const filtresActifs = !!(q || typeDocument || statut || periode || auteur);

  function deposer(fichier: File | null) {
    setFichierDepose(fichier);
    setShowUpload(true);
  }

  const aValider = synthese?.aValider ?? [];
  const premier = aValider[0];

  const zoneDepot = peutDeposer && (
    <button
      type="button"
      data-testid="zone-depot"
      onClick={() => deposer(null)}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setSurvol(false);
        const f = e.dataTransfer.files?.[0];
        if (f) deposer(f);
      }}
      className={`my-1 flex min-h-[62px] w-full items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed px-4 py-3 text-center text-[13.5px] font-semibold ${survol ? 'border-ink bg-ink-50 text-ink' : 'border-[#C3C8DA] text-text-muted hover:bg-bg'}`}
    >
      <Plus aria-hidden size={18} className="flex-none" />
      <span>Glissez des fichiers ici pour les déposer dans « {destination} »</span>
    </button>
  );

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <EnTetePage
        titre="Archives & documents"
        avantActions={
          peutDeposer && (
            <div className="flex flex-wrap items-center gap-2">
              {avecArbre && dossiers && (
                <button type="button" className={BTN_SECONDAIRE} onClick={() => arbre.current?.nouveauDossier()}>
                  <IconeDossier aria-hidden size={17} /> Nouveau dossier
                </button>
              )}
              <button type="button" className={BTN_PRINCIPAL} onClick={() => deposer(null)}>
                <Plus aria-hidden size={17} /> Déposer un document
              </button>
            </div>
          )
        }
      />

      <Onglets<Tab>
        label="Espaces documentaires"
        actif={tab}
        onChange={handleTabChange}
        onglets={[
          { cle: 'division', label: ongletEspace },
          { cle: 'published', label: 'Publiés pour toute la DNPEC', n: synthese?.publies ?? null },
        ]}
      />

      {premier && (
        <Bandeau
          testid="bandeau-a-valider"
          icone={<CircleCheck aria-hidden size={17} className="flex-none text-ambre" />}
          action={
            <button type="button" className="h-8 rounded-[8px] border border-line bg-surface px-3 text-[13px] font-bold text-ink hover:bg-bg" onClick={() => ouvrir(premier.id)} aria-label={`Voir « ${premier.titre} »`}>
              Voir
            </button>
          }
        >
          <b className="text-[#6B4600]">
            {aValider.length} document{aValider.length > 1 ? 's attendent' : ' attend'} votre validation
          </b>{' '}
          : « {premier.titre} »{premier.marqueFinalPar ? `, marqué Final par ${premier.marqueFinalPar}` : ', marqué Final'}
          {aValider.length > 1 ? ` (et ${aValider.length - 1} autre${aValider.length > 2 ? 's' : ''})` : ''}.
        </Bandeau>
      )}

      {tab === 'division' && canPickDivision && (
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <label htmlFor="espace-documentaire" className="text-[13px] font-semibold text-text-muted">
            Espace
          </label>
          <select
            id="espace-documentaire"
            aria-label="Espace documentaire"
            value={espace}
            onChange={(e) => {
              setEspace(e.target.value);
              setCurrentFolderId(null);
            }}
            className="h-9 w-full max-w-[300px] rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold"
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
        </div>
      )}

      <div className={avecArbre ? 'grid items-start gap-4 xl:grid-cols-[230px_minmax(0,1fr)]' : ''}>
        {avecArbre && (
          <FolderNav
            ref={arbre}
            divisionId={selectedDivisionId}
            dossiers={dossiers}
            erreur={erreurDossiers}
            compteurs={compteurs}
            total={documents?.length ?? 0}
            currentFolderId={currentFolderId}
            onNavigate={setCurrentFolderId}
            onCreated={(f) => {
              setDossiers((prev) => [...(prev ?? []), f].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
            }}
          />
        )}
        <div className="min-w-0">
          <BarreOutils>
            <Recherche value={q} onChange={setQ} placeholder="Rechercher par titre ou mot-clé…" label="Rechercher par titre ou mot-clé" />
            <FiltreSelect<TypeDocument | ''>
              label="Type"
              value={typeDocument}
              defaut=""
              onChange={setTypeDocument}
              options={[{ value: '', label: 'Type' }, ...(Object.keys(TYPE_DOCUMENT_LABEL) as TypeDocument[]).map((t) => ({ value: t, label: TYPE_DOCUMENT_LABEL[t] }))]}
            />
            <FiltreSelect<StatutDiffusion | ''>
              label="Statut"
              value={statut}
              defaut=""
              onChange={setStatut}
              options={[{ value: '', label: 'Statut' }, ...(Object.keys(STATUT_LABEL) as StatutDiffusion[]).map((s) => ({ value: s, label: STATUT_LABEL[s] }))]}
            />
            <FiltreSelect<ChoixPeriode> label="Période couverte" value={periode} defaut="" onChange={setPeriode} options={PERIODES} />
            {periode === 'perso' && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
                <label htmlFor="depot-du">Du</label>
                <input id="depot-du" type="date" value={du} onChange={(e) => setDu(e.target.value)} className="h-9 rounded-[9px] border border-line bg-surface px-2 text-[13px] text-text" />
                <label htmlFor="depot-au">au</label>
                <input id="depot-au" type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)} className="h-9 rounded-[9px] border border-line bg-surface px-2 text-[13px] text-text" />
              </span>
            )}
            <FiltreSelect<string> label="Auteur" value={auteur} defaut="" onChange={setAuteur} options={[{ value: '', label: 'Auteur' }, ...auteurs.map((id) => ({ value: id, label: getUserLabel(id) }))]} />
          </BarreOutils>

          {documents === null ? (
            <Chargement erreur={erreurChargement} />
          ) : (
            <DocumentList
              documents={visibles}
              dossiers={dossiers ?? []}
              onSelect={setSelectedDoc}
              pied={zoneDepot || undefined}
              vide={
                <EtatVide
                  texte={filtresActifs ? 'Aucun document ne correspond à ces filtres.' : tab === 'published' ? 'Aucun document publié pour l’instant.' : 'Aucun document ici pour l’instant.'}
                  action={
                    filtresActifs ? (
                      <button
                        type="button"
                        className="text-[13px] font-bold text-ink hover:underline"
                        onClick={() => {
                          setQ('');
                          setTypeDocument('');
                          setStatut('');
                          setPeriode('');
                          setAuteur('');
                        }}
                      >
                        Effacer les filtres
                      </button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </div>
      </div>

      {showUpload && espace && (
        <UploadDocumentModal
          divisionId={selectedDivisionId || null}
          celluleId={selectedCelluleId || null}
          folderId={selectedDivisionId ? currentFolderId : null}
          dossierLibelle={dossierCourant?.name ?? null}
          fichierInitial={fichierDepose}
          onClose={() => {
            setShowUpload(false);
            setFichierDepose(null);
          }}
          onCreated={(doc) => {
            setDocuments((prev) => (prev ? [doc, ...prev] : [doc]));
            setShowUpload(false);
            setFichierDepose(null);
          }}
        />
      )}
      {selectedDoc && <FenetreDocument document={selectedDoc} dossiers={dossiers ?? []} onClose={() => setSelectedDoc(null)} onChange={handleDocChanged} />}
    </div>
  );
}

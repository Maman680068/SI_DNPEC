'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { getCatalogue } from '../../../lib/api/generateur';
import { apiFetch } from '../../../lib/api/client';
import {
  creerActivite,
  creerObjectif,
  getActivite,
  getPlan,
  getResponsablesPossibles,
  modifierActivite,
  supprimerActivite,
  supprimerObjectif,
  type ActiviteSaisie,
} from '../../../lib/api/pilotage';
import type { Activite, ActiviteDetail, Objectif, Plan } from '../../../lib/pilotage/types';
import type { Task } from '../../../lib/tasks/types';
import { useOrg } from '../../../lib/org/OrgProvider';
import { Fenetre } from '../../../components/ui/Fenetre';
import { ChampDate, FenetreFormulaire, Grille2, Liste, Saisie, SelecteurPersonnes, ZoneTexte } from '../../../components/ui/Formulaire';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';
import {
  Anneau,
  BTN_DANGER_CONTOUR,
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  BandeCompteurs,
  CleValeur,
  EnTetePage,
  EtatVide,
  FiltreSelect,
  Filtres,
  Pastille,
  SectionFenetre,
} from '../../../components/ui/Charte';
import {
  Chargement,
  ErreurChargement,
  messageChargement,
} from '../../../components/ui/ErreurChargement';
import { ViewToggle, type TaskView } from '../../../components/tasks/ViewToggle';
import { KanbanBoard } from '../../../components/tasks/KanbanBoard';
import { CalendarView } from '../../../components/tasks/CalendarView';
import { CreateTaskModal } from '../../../components/tasks/CreateTaskModal';

const PETIT = 'inline-flex h-[34px] items-center gap-1.5 rounded-[8px] border border-line bg-surface px-[11px] text-[13px] font-bold text-ink hover:bg-bg';
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const GRILLE = 'lg:grid-cols-[minmax(0,1.3fr)_170px_minmax(0,1.6fr)_80px]';

/** Couleur de la barre d'une activité : verte terminée, rouge en retard, bleue en cours. */
const couleurActivite = (a: Pick<Activite, 'avancement' | 'enRetard'>) => (a.avancement >= 100 ? 'bg-sage' : a.enRetard ? 'bg-clay' : 'bg-ink');
const etatActivite = (a: Pick<Activite, 'avancement' | 'enRetard'>) => (a.avancement >= 100 ? 'terminée' : a.enRetard ? 'en retard' : 'en cours');

/** Frise de janvier à décembre : barre de l'activité (dateDebut → dateFin) et trait doré « aujourd'hui ». */
function Frise({ a, annee }: { a: Activite; annee: number }) {
  const debutAn = Date.UTC(annee, 0, 1);
  const finAn = Date.UTC(annee + 1, 0, 1);
  const part = (t: number) => Math.max(0, Math.min(1, (t - debutAn) / (finAn - debutAn))) * 100;
  const gauche = part(new Date(a.dateDebut).getTime());
  const droite = part(new Date(a.dateFin).getTime() + 86_400_000);
  const maintenant = Date.now();
  return (
    <div
      role="img"
      aria-label={`Du ${date(a.dateDebut)} au ${date(a.dateFin)}, ${etatActivite(a)}`}
      className="relative h-[22px] rounded-[5px]"
      style={{ background: 'repeating-linear-gradient(90deg,#F2F3F8 0 calc(100%/12 - 1px),#E4E6EF calc(100%/12 - 1px) calc(100%/12))' }}
    >
      {droite > gauche && <i className={`absolute top-1 h-3.5 rounded-[4px] ${couleurActivite(a)}`} style={{ left: `${gauche}%`, width: `${Math.max(droite - gauche, 0.8)}%` }} />}
      {maintenant >= debutAn && maintenant < finAn && <span aria-hidden className="absolute -bottom-[3px] -top-[3px] w-0.5 bg-gold" style={{ left: `${part(maintenant)}%` }} />}
    </div>
  );
}

/**
 * Plan de travail (socle N5 ; refonte de l'interface, étape 6, maquette validée) : objectif → activités
 * datées → tâches ; avancement calculé (jamais saisi). Bande de synthèse, un panneau par objectif avec
 * anneau d'avancement et frise annuelle des activités ; fiche d'une activité par ?activite=.
 */
/** Formulaire du rapport d'activité de « Documents générés », ouvert sur la période de l'année du plan
 * (jusqu'à aujourd'hui pour l'année en cours). */
function lienRapport(annee: number): string {
  const auj = new Date();
  const fin = annee === auj.getFullYear() ? `${annee}-${String(auj.getMonth() + 1).padStart(2, '0')}-${String(auj.getDate()).padStart(2, '0')}` : `${annee}-12-31`;
  return `/documents-generes?onglet=rapport&debut=${annee}-01-01&fin=${fin}`;
}

export default function PlanTravailPage() {
  const annee0 = new Date().getFullYear();
  const [annee, setAnnee] = useState(annee0);
  const [uniteId, setUniteId] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelObjectif, setNouvelObjectif] = useState(false);
  const [activitePour, setActivitePour] = useState<Objectif | null>(null);
  const [activiteOuverte, setActiviteOuverte] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Objectif | null>(null);
  // Rapport d'activité : bouton montré seulement si l'API ouvre au moins un périmètre de rapport.
  const [rapportPossible, setRapportPossible] = useState(false);
  useEffect(() => {
    getCatalogue()
      .then((c) => setRapportPossible(c.rapportActivite.perimetres.length > 0))
      .catch(() => setRapportPossible(false));
  }, []);

  const charger = useCallback(() => {
    getPlan(annee, uniteId || undefined)
      .then(setPlan)
      .catch((e) => setErreur(messageChargement(e)));
  }, [annee, uniteId]);
  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('activite');
    if (id) setActiviteOuverte(id);
  }, []);

  if (!plan) {
    return (
      <div>
        <ErreurChargement message={erreur} />
        {erreur ? <Chargement erreur={erreur} /> : <SquelettePage />}
      </div>
    );
  }

  const activites = plan.objectifs.flatMap((o) => o.activites);
  const terminees = activites.filter((a) => a.avancement >= 100).length;
  const enRetard = activites.filter((a) => a.enRetard).length;
  const moyenne = activites.length ? Math.round(activites.reduce((s, a) => s + a.avancement, 0) / activites.length) : 0;

  const boutonObjectif = plan.peutCreer && (
    <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouvelObjectif(true)}>
      <Plus aria-hidden size={17} />
      Nouvel objectif
    </button>
  );

  return (
    <div>
      <EnTetePage
        titre={`Plan de travail ${annee}`}
        avantActions={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Filtres
              actifs={(uniteId ? 1 : 0) + (annee !== annee0 ? 1 : 0)}
              onEffacer={() => {
                setUniteId('');
                setAnnee(annee0);
              }}
            >
              <FiltreSelect<string>
                label="Unité"
                value={uniteId}
                defaut=""
                onChange={setUniteId}
                options={[{ value: '', label: 'Toutes les unités visibles' }, ...plan.unites.map((u) => ({ value: u.id, label: u.libelle }))]}
              />
              <FiltreSelect<string>
                label="Année"
                value={String(annee)}
                defaut={String(annee0)}
                onChange={(v) => setAnnee(Number(v))}
                options={[annee0 - 1, annee0, annee0 + 1].map((a) => ({ value: String(a), label: String(a) }))}
              />
            </Filtres>
          </div>
        }
        actions={
          (rapportPossible || boutonObjectif) && (
            <>
              {rapportPossible && (
                <Link href={lienRapport(annee)} className={BTN_SECONDAIRE} data-testid="bouton-rapport-activite">
                  <FileText aria-hidden size={16} />
                  Rapport d’activité
                </Link>
              )}
              {boutonObjectif}
            </>
          )
        }
      />
      <ErreurChargement message={erreur} />

      <BandeCompteurs
        label={`Synthèse du plan de travail ${annee}`}
        items={[
          { valeur: plan.objectifs.length, label: plan.objectifs.length > 1 ? 'Objectifs' : 'Objectif', sous: 'dans votre périmètre', testid: 'synthese-objectifs' },
          { valeur: activites.length, label: activites.length > 1 ? 'Activités' : 'Activité', sous: `dont ${terminees} terminée${terminees > 1 ? 's' : ''}`, testid: 'synthese-activites' },
          { valeur: `${moyenne} %`, label: 'Avancement moyen', sous: 'calculé sur les tâches', ton: 'vert', testid: 'synthese-avancement' },
          { valeur: enRetard, label: enRetard > 1 ? 'Activités en retard' : 'Activité en retard', sous: 'échéance dépassée', ton: enRetard ? 'rouge' : 'encre', testid: 'synthese-retard' },
        ]}
      />

      {plan.objectifs.length === 0 && (
        <div className="rounded-xl border border-line bg-surface">
          <EtatVide texte={`Aucun objectif pour ${annee}.`} action={boutonObjectif || undefined} />
        </div>
      )}

      <div className="space-y-3.5">
        {plan.objectifs.map((o) => (
          <section key={o.id} data-testid="objectif" aria-label={o.libelle} className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-4 py-3.5 sm:px-[18px]">
              <Anneau valeur={o.avancement} taille={52} couleur={o.avancement >= 50 ? 'var(--couleur-sage)' : '#F0B429'} label={`Avancement de l’objectif : ${o.avancement} %`} />
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{o.libelle}</h2>
                <span className="mt-0.5 block text-[12.5px] text-text-muted">{[o.description, o.unite].filter(Boolean).join(' · ')}</span>
              </div>
              {(o.droits.ajouterActivite || o.droits.supprimer) && (
                <div className="flex flex-wrap items-center gap-2">
                  {o.droits.ajouterActivite && (
                    <button type="button" className={PETIT} onClick={() => setActivitePour(o)}>
                      <Plus aria-hidden size={14} />
                      Activité
                    </button>
                  )}
                  {o.droits.supprimer && (
                    <button
                      type="button"
                      className={`${PETIT} !text-clay`}
                      onClick={() => setASupprimer(o)}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
            {o.activites.length === 0 ? (
              <EtatVide
                texte="Aucune activité pour cet objectif."
                action={
                  o.droits.ajouterActivite ? (
                    <button type="button" className={PETIT} onClick={() => setActivitePour(o)}>
                      <Plus aria-hidden size={14} />
                      Ajouter une activité
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div role="table" aria-label={`Activités — ${o.libelle}`}>
                <div role="rowgroup">
                  <div role="row" className={`hidden h-8 items-center gap-3.5 border-b border-[#F0F1F6] bg-[#FAFBFD] px-[18px] text-[11.5px] font-semibold text-text-muted lg:grid ${GRILLE}`}>
                    <span role="columnheader">Activité et indicateur</span>
                    <span role="columnheader">Responsable</span>
                    <span role="columnheader" className="grid grid-cols-12 text-center">
                      {MOIS.map((m, i) => (
                        <span key={i} aria-hidden>
                          {m}
                        </span>
                      ))}
                      <span className="sr-only">Calendrier de janvier à décembre {annee}</span>
                    </span>
                    <span role="columnheader" className="text-right">
                      Avancement
                    </span>
                  </div>
                </div>
                <div role="rowgroup">
                  {o.activites.map((a) => (
                    <LigneActivite key={a.id} a={a} annee={annee} onOuvrir={() => setActiviteOuverte(a.id)} />
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {nouvelObjectif && (
        <FenetreObjectif
          plan={plan}
          annee={annee}
          onClose={() => setNouvelObjectif(false)}
          onFait={() => (setNouvelObjectif(false), charger())}
        />
      )}
      {activitePour && (
        <FenetreActivite
          objectif={activitePour}
          onClose={() => setActivitePour(null)}
          onFait={() => (setActivitePour(null), charger())}
        />
      )}
      {aSupprimer && (
        <FenetreSupprimer
          titre="Supprimer l’objectif"
          texte={`Supprimer l’objectif « ${aSupprimer.libelle} » ?`}
          action={() => supprimerObjectif(aSupprimer.id)}
          succes="Objectif supprimé"
          onClose={() => setASupprimer(null)}
          onFait={() => (setASupprimer(null), charger())}
        />
      )}
      {activiteOuverte && (
        <FicheActivite
          id={activiteOuverte}
          onClose={() => {
            setActiviteOuverte(null);
            window.history.replaceState(null, '', '/plan-travail');
          }}
          onChange={charger}
        />
      )}
    </div>
  );
}

function LigneActivite({ a, annee, onOuvrir }: { a: Activite; annee: number; onOuvrir: () => void }) {
  const { getUserInitials } = useOrg();
  return (
    <div role="row" data-testid="activite" className={`grid grid-cols-1 items-center gap-x-3.5 gap-y-2 border-b border-[#F0F1F6] px-4 py-3 last:border-b-0 sm:px-[18px] lg:min-h-[58px] lg:py-2 ${GRILLE}`}>
      <span role="cell" className="min-w-0">
        <button type="button" onClick={onOuvrir} className="block max-w-full truncate text-left text-[13.5px] font-semibold text-text hover:text-ink hover:underline">
          <span className="mr-1.5 text-text-muted" data-testid="reference-activite">{a.reference}</span>
          {a.libelle}
        </button>
        <span className="block truncate text-[12.5px] text-text-muted">
          {a.indicateur}
          {a.cible ? ` — cible : ${a.cible}` : ''} · {a.nombreTaches} tâche{a.nombreTaches > 1 ? 's' : ''}
        </span>
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-2 text-[13px]">
        <span aria-hidden className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-ink-50 text-[10px] font-bold text-ink">
          {getUserInitials(a.responsable.id) || a.responsable.nom.split(' ').map((x) => x.charAt(0)).slice(0, 2).join('')}
        </span>
        <span className="truncate">{a.responsable.nom}</span>
      </span>
      <span role="cell" className="block">
        <Frise a={a} annee={annee} />
      </span>
      <span role="cell" className={`flex items-center gap-2 text-[13px] font-bold lg:justify-end ${a.enRetard ? 'text-clay' : 'text-text'}`}>
        {a.enRetard && (
          <span className="lg:sr-only">
            <Pastille ton="rouge">En retard</Pastille>
          </span>
        )}
        {a.avancement} %
      </span>
    </div>
  );
}

/** Confirmation d'une suppression (objectif, activité) : l'API refuse ce qui n'est pas permis. */
function FenetreSupprimer({ titre, texte, action, succes, onClose, onFait }: { titre: string; texte: string; action: () => Promise<unknown>; succes: string; onClose: () => void; onFait: () => void }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();
  return (
    <Fenetre
      titre={titre}
      onClose={onClose}
      danger
      libelleValider="Supprimer"
      enCours={enCours}
      erreur={erreur}
      pied="La suppression est définitive."
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return action()
          .then(() => {
            toast.succes(succes);
            onFait();
          })
          .catch((e) => setErreur(messageErreur(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <p className="text-[13.5px]">{texte}</p>
    </Fenetre>
  );
}

function FenetreObjectif({
  plan,
  annee,
  onClose,
  onFait,
}: {
  plan: Plan;
  annee: number;
  onClose: () => void;
  onFait: () => void;
}) {
  const gerees = plan.unites.filter((u) => u.gere);
  const [uniteId, setUniteId] = useState(gerees[0]?.id ?? '');
  const [libelle, setLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();
  return (
    <FenetreFormulaire
      titre={`Nouvel objectif ${annee}`}
      largeur={640}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Créer l’objectif"
      testid="fenetre-objectif"
      pied="Visible de l’unité et de sa hiérarchie ; ajoutez-y ensuite ses activités."
      valider={() => (libelle.trim().length < 3 ? { 'objectif-libelle': libelle.trim() ? 'Le libellé compte au moins 3 caractères.' : 'Indiquez le libellé de l’objectif.' } : {})}
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return creerObjectif({ annee, uniteId, libelle: libelle.trim(), description: description.trim() || undefined })
          .then(() => {
            toast.succes('Objectif créé', { detail: libelle.trim() });
            onFait();
          })
          .catch((e) => setErreur(messageErreur(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <Liste id="objectif-unite" label="Unité" value={uniteId} onChange={setUniteId} required messageObligatoire="Choisissez l’unité." options={gerees.map((u) => ({ value: u.id, label: u.libelle }))} />
      <Saisie id="objectif-libelle" label="Libellé de l’objectif" value={libelle} onChange={setLibelle} required maxLength={300} messageObligatoire="Indiquez le libellé de l’objectif." />
      <ZoneTexte id="objectif-description" label="Description" facultatif value={description} onChange={setDescription} lignes={3} maxLength={2000} />
    </FenetreFormulaire>
  );
}

/** Règles propres d'une activité (longueurs de l'API, fin ≥ début). */
function validerActivite(v: ActiviteSaisie): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.libelle.trim().length < 3) e['activite-libelle'] = v.libelle.trim() ? 'Le libellé compte au moins 3 caractères.' : 'Indiquez le libellé de l’activité.';
  if (v.indicateur.trim().length < 3) e['activite-indicateur'] = v.indicateur.trim() ? 'L’indicateur compte au moins 3 caractères.' : 'Indiquez l’indicateur.';
  if (v.dateDebut && v.dateFin && v.dateFin < v.dateDebut) e['activite-fin'] = 'La fin doit être postérieure ou égale au début.';
  return e;
}

function ChampsActivite({
  v,
  set,
  responsables,
}: {
  v: ActiviteSaisie;
  set: (v: ActiviteSaisie) => void;
  responsables: { id: string; firstName: string; lastName: string }[];
}) {
  return (
    <>
      <Saisie id="activite-libelle" label="Libellé de l’activité" value={v.libelle} onChange={(libelle) => set({ ...v, libelle })} required maxLength={300} messageObligatoire="Indiquez le libellé de l’activité." />
      <SelecteurPersonnes
        id="activite-responsable"
        label="Responsable"
        multiple={false}
        required
        messageObligatoire="Choisissez le responsable."
        options={responsables.map((r) => ({ id: r.id, nom: `${r.firstName} ${r.lastName}` }))}
        valeurs={v.responsableId ? [v.responsableId] : []}
        onChange={(ids) => set({ ...v, responsableId: ids[0] ?? '' })}
        placeholder="Rechercher le responsable…"
      />
      <Grille2>
        <ChampDate id="activite-debut" label="Début" value={v.dateDebut} onChange={(dateDebut) => set({ ...v, dateDebut })} required messageObligatoire="Indiquez la date de début." />
        <ChampDate id="activite-fin" label="Fin" value={v.dateFin} onChange={(dateFin) => set({ ...v, dateFin })} min={v.dateDebut || undefined} required messageObligatoire="Indiquez la date de fin." />
      </Grille2>
      <Grille2>
        <Saisie id="activite-indicateur" label="Indicateur" value={v.indicateur} onChange={(indicateur) => set({ ...v, indicateur })} required maxLength={300} placeholder="Ex. notes publiées" messageObligatoire="Indiquez l’indicateur." />
        <Saisie id="activite-cible" label="Cible" facultatif value={v.cible ?? ''} onChange={(cible) => set({ ...v, cible })} maxLength={200} placeholder="Ex. 1 par mois" />
      </Grille2>
    </>
  );
}

function FenetreActivite({
  objectif,
  onClose,
  onFait,
}: {
  objectif: Objectif;
  onClose: () => void;
  onFait: () => void;
}) {
  const [v, setV] = useState<ActiviteSaisie>({
    libelle: '',
    responsableId: '',
    dateDebut: '',
    dateFin: '',
    indicateur: '',
    cible: '',
  });
  const [responsables, setResponsables] = useState<
    { id: string; firstName: string; lastName: string }[]
  >([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();
  useEffect(() => {
    getResponsablesPossibles(objectif.uniteId)
      .then(setResponsables)
      .catch((e) => setErreur(messageChargement(e)));
  }, [objectif.uniteId]);
  const nom = responsables.find((r) => r.id === v.responsableId);
  return (
    <FenetreFormulaire
      titre="Nouvelle activité"
      sousTitre={objectif.libelle}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      largeur={720}
      libelleValider="Créer l’activité"
      testid="fenetre-activite"
      pied="L’avancement se calcule sur les tâches rattachées à l’activité, jamais saisi."
      valider={() => validerActivite(v)}
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return creerActivite(objectif.id, { ...v, libelle: v.libelle.trim(), indicateur: v.indicateur.trim(), cible: v.cible?.trim() || undefined })
          .then(() => {
            toast.succes('Activité créée', { detail: nom ? `Responsable : ${nom.firstName} ${nom.lastName}.` : v.libelle.trim() });
            onFait();
          })
          .catch((e) => setErreur(messageErreur(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <ChampsActivite v={v} set={setV} responsables={responsables} />
    </FenetreFormulaire>
  );
}

function FicheActivite({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const router = useRouter();
  const [a, setA] = useState<ActiviteDetail | null>(null);
  const [taches, setTaches] = useState<Task[] | null>(null);
  const [vue, setVue] = useState<TaskView>('kanban');
  const [edition, setEdition] = useState<ActiviteSaisie | null>(null);
  const [nouvelleTache, setNouvelleTache] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const toast = useToast();

  const charger = useCallback(() => {
    getActivite(id)
      .then(setA)
      .catch((e) => setErreur(messageChargement(e)));
    apiFetch<Task[]>(`/tasks?activiteId=${encodeURIComponent(id)}`)
      .then(setTaches)
      .catch((e) => setErreur(messageChargement(e)));
  }, [id]);
  useEffect(() => {
    charger();
  }, [charger]);

  const cote = a && (
    <>
      <SectionFenetre titre="Actions">
        <div className="flex flex-col gap-2">
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouvelleTache(true)}>
            <Plus aria-hidden size={16} />
            Nouvelle tâche
          </button>
          {a.droits.modifier && (
            <button
              type="button"
              className={BTN_SECONDAIRE}
              disabled={!!edition}
              onClick={() =>
                setEdition({
                  libelle: a.libelle,
                  responsableId: a.responsable.id,
                  dateDebut: a.dateDebut.slice(0, 10),
                  dateFin: a.dateFin.slice(0, 10),
                  indicateur: a.indicateur,
                  cible: a.cible ?? '',
                })
              }
            >
              Modifier
            </button>
          )}
          {a.droits.supprimer && (
            <button
              type="button"
              className={BTN_DANGER_CONTOUR}
              onClick={() => setSuppression(true)}
            >
              Supprimer
            </button>
          )}
        </div>
      </SectionFenetre>
      <SectionFenetre titre="Informations" className="mb-0">
        <div className="mb-3 flex items-center gap-3">
          <Anneau valeur={a.avancement} taille={52} couleur={a.avancement >= 100 ? 'var(--couleur-sage)' : a.enRetard ? '#CE1126' : '#1B2A6B'} label={`Avancement : ${a.avancement} %`} />
          <span className="text-[12.5px] text-text-muted">Calculé sur les tâches rattachées, jamais saisi.</span>
        </div>
        <CleValeur
          largeur={92}
          lignes={[
            ['Responsable', a.responsable.nom],
            ['Période', `du ${date(a.dateDebut)} au ${date(a.dateFin)}`],
            ['Indicateur', a.indicateur],
            ['Cible', a.cible || '—'],
            ['Tâches', String(a.nombreTaches)],
            ['Unité', a.objectif.unite],
          ]}
        />
      </SectionFenetre>
    </>
  );

  return (
    <>
      <FenetreDetail
        titre={a ? a.libelle : 'Activité'}
        onClose={onClose}
        largeur={1100}
        testid="fiche-activite"
        filAriane={a ? ['Plan de travail', String(a.objectif.annee), a.objectif.libelle, a.reference] : ['Plan de travail']}
        entete={
          a && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {a.avancement >= 100 ? <Pastille ton="vert">Terminée</Pastille> : a.enRetard ? <Pastille ton="rouge">En retard</Pastille> : <Pastille ton="encre">En cours</Pastille>}
            </div>
          )
        }
        cote={cote || undefined}
      >
        {erreur && <p role="alert" className="mb-3 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{erreur}</p>}
        {!a ? (
          <Chargement erreur={erreur} />
        ) : (
          <section aria-label="Tâches de l’activité">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-bold text-ink-900">
                Tâches <span className="font-semibold text-text-muted">{a.nombreTaches}</span>
              </h3>
              <ViewToggle value={vue} onChange={setVue} vues={['kanban', 'calendar']} />
            </div>
            {!taches ? (
              <Chargement erreur={erreur} />
            ) : taches.length === 0 ? (
              <EtatVide
                texte="Aucune tâche rattachée : l’avancement reste à 0 %."
                action={
                  <button type="button" className={BTN_SECONDAIRE} onClick={() => setNouvelleTache(true)}>
                    Créer une tâche
                  </button>
                }
              />
            ) : vue === 'kanban' ? (
              <KanbanBoard tasks={taches} onSelect={(t) => router.push(`/tasks/${t}`)} />
            ) : (
              <CalendarView tasks={taches} onSelect={(t) => router.push(`/tasks/${t}`)} />
            )}
          </section>
        )}
      </FenetreDetail>
      {edition && a && (
        <FenetreFormulaire
          titre="Modifier l’activité"
          sousTitre={a.objectif.libelle}
          largeur={720}
          onClose={() => setEdition(null)}
          enCours={enregistrement}
          erreur={erreurEdition}
          libelleValider="Enregistrer l’activité"
          testid="fenetre-activite"
          pied="L’avancement reste calculé sur les tâches rattachées."
          valider={() => validerActivite(edition)}
          onSubmit={() => {
            setEnregistrement(true);
            setErreurEdition(null);
            return modifierActivite(id, { ...edition, libelle: edition.libelle.trim(), indicateur: edition.indicateur.trim(), cible: edition.cible?.trim() ?? '' })
              .then(() => {
                toast.succes('Activité modifiée', { detail: edition.libelle.trim() });
                setEdition(null);
                charger();
                onChange();
              })
              .catch((err) => setErreurEdition(messageErreur(err)))
              .finally(() => setEnregistrement(false));
          }}
        >
          <ChampsActivite v={edition} set={setEdition} responsables={a.responsablesPossibles} />
        </FenetreFormulaire>
      )}
      {suppression && a && (
        <FenetreSupprimer
          titre="Supprimer l’activité"
          texte={`Supprimer l’activité « ${a.libelle} » ?`}
          action={() => supprimerActivite(id)}
          succes="Activité supprimée"
          onClose={() => setSuppression(false)}
          onFait={() => (setSuppression(false), onChange(), onClose())}
        />
      )}
      {nouvelleTache && (
        <CreateTaskModal
          presetActiviteId={id}
          onClose={() => setNouvelleTache(false)}
          onCreated={() => (setNouvelleTache(false), charger(), onChange())}
        />
      )}
    </>
  );
}

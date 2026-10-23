'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, MessageSquare, Paperclip, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useNavigation } from '../../lib/navigation/NavigationProvider';
import { useDemandeCreation } from '../../lib/navigation/creer';
import { getTasks } from '../../lib/api/tasks';
import type { Task, TaskPriority, TaskStatus } from '../../lib/tasks/types';
import {
  GROUPES_ECHEANCE,
  PRIORITE_ORDRE,
  STATUT_LIBELLE,
  dateEcheance,
  estClose,
  estEnRetard,
  groupeEcheance,
  tonEcheance,
  type GroupeEcheance,
} from '../../lib/tasks/affichage';
import { KanbanBoard } from './KanbanBoard';
import { CalendarView } from './CalendarView';
import { ViewToggle, useVueTaches } from './ViewToggle';
import { FenetreTache } from './FenetreTache';
import { CreateTaskModal } from './CreateTaskModal';
import { Avancement, Avatars, PastilleStatut, PointStatut, Priorite } from './ElementsTache';
import { useUniteTache } from '../dashboard/ListeTachesTableau';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { BTN_SECONDAIRE, EtatVide, FiltreSelect, Filtres } from '../ui/Charte';
import { SqueletteListe } from '../ui/Squelette';
import { referenceTache } from '../../lib/references';

/** Onglets (adresse : `?onglet=`) ; « À valider » et « Mon périmètre » selon ce que l'API ouvre. */
type Onglet = 'assignees' | 'creees' | 'a-valider' | 'perimetre' | 'terminees';
const ONGLETS: Onglet[] = ['assignees', 'creees', 'a-valider', 'perimetre', 'terminees'];

type FiltreStatut = 'ouvertes' | 'toutes' | TaskStatus;
type FiltreEcheance = 'toutes' | 'retard' | 'semaine' | 'plusTard' | 'aucune';
type Groupement = 'echeance' | 'statut';

/** Vue de périmètre : tâches non closes et closes depuis moins de 30 jours, bornées (performance 2026-10). */
const PERIMETRE_MAX = 300;

/**
 * « Mes tâches » (refonte de l'interface, étape 2) : onglets Assignées à moi, Créées par moi, (À valider),
 * (Mon périmètre) et Terminées avec leur compteur ; recherche et filtres (statut, échéance, priorité, plan
 * de travail) ; vues Liste (par défaut, groupée par échéance ou par statut), Kanban et Calendrier, dont la
 * dernière choisie est retenue. `initialTaskId` : ouverture directe d'une tâche (/tasks/:id, liens des
 * emails), y compris une tâche vue par cascade — la fenêtre la charge elle-même, l'API restant seule juge.
 */
export function MyTasksView({ initialTaskId = null }: { initialTaskId?: string | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const { navigation, rafraichir } = useNavigation();
  const userId = user?.id;
  const unite = useUniteTache();
  const [assignees, setAssignees] = useState<Task[] | null>(null);
  const [creees, setCreees] = useState<Task[] | null>(null);
  const [aValider, setAValider] = useState<Task[] | null>(null);
  const [perimetre, setPerimetre] = useState<Task[] | null>(null);
  const [perimetreTronque, setPerimetreTronque] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>('assignees');
  const [vue, setVue] = useVueTaches();
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState<FiltreStatut>('ouvertes');
  const [echeance, setEcheance] = useState<FiltreEcheance>('toutes');
  const [priorite, setPriorite] = useState<'toutes' | TaskPriority>('toutes');
  const [activite, setActivite] = useState('toutes');
  const [groupement, setGroupement] = useState<Groupement>('echeance');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId);
  const [creation, setCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Ouverture par l'adresse : onglet, statut et échéance (compteurs du tableau de bord, « À traiter »).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const o = p.get('onglet') as Onglet | null;
    if (o && ONGLETS.includes(o)) setOnglet(o);
    const s = p.get('statut');
    if (s === 'A_FAIRE' || s === 'EN_COURS' || s === 'SOUMISE_VALIDATION' || s === 'TERMINEE') setStatut(s);
    else if (o === 'terminees') setStatut('toutes');
    const e = p.get('echeance');
    if (e === 'retard' || e === 'semaine' || e === 'plusTard' || e === 'aucune') setEcheance(e);
  }, []);

  // Menu « Créer » (« /tasks?nouvelle=1 ») et lien « Ajouter une tâche » : seulement si l'API l'ouvre.
  const peutCreer = !!navigation?.creer.tache;
  useDemandeCreation('tache', () => setCreation(true), !!navigation);

  // Les tâches de la personne (filtres de l'API) ; « À valider » et « Mon périmètre » à la demande.
  const charger = useCallback(() => {
    if (!userId) return;
    Promise.all([getTasks({ assigneeId: userId }), getTasks({ createdById: userId })])
      .then(([a, c]) => {
        setAssignees(a);
        setCreees(c);
      })
      .catch((err) => setErreur(messageChargement(err)));
  }, [userId]);
  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    if (onglet !== 'a-valider' || aValider) return;
    getTasks({ aValider: true })
      .then(setAValider)
      .catch((err) => setErreur(messageChargement(err)));
  }, [onglet, aValider]);
  useEffect(() => {
    if (onglet !== 'perimetre' || perimetre) return;
    getTasks({ suivi: true, limite: PERIMETRE_MAX + 1 })
      .then((l) => {
        setPerimetreTronque(l.length > PERIMETRE_MAX);
        setPerimetre(l.slice(0, PERIMETRE_MAX));
      })
      .catch((err) => setErreur(messageChargement(err)));
  }, [onglet, perimetre]);

  const terminees = useMemo(() => {
    const vues = new Map<string, Task>();
    for (const t of [...(assignees ?? []), ...(creees ?? [])]) if (estClose(t)) vues.set(t.id, t);
    return [...vues.values()];
  }, [assignees, creees]);

  const nbAValider = navigation?.compteurs.tachesAValider ?? 0;
  const onglets: { cle: Onglet; label: string; n: number | null; chaud?: boolean }[] = [
    { cle: 'assignees', label: 'Assignées à moi', n: assignees ? assignees.filter((t) => !estClose(t)).length : null },
    { cle: 'creees', label: 'Créées par moi', n: creees ? creees.filter((t) => !estClose(t)).length : null },
    ...(nbAValider > 0 || onglet === 'a-valider' ? [{ cle: 'a-valider' as const, label: 'À valider', n: aValider ? aValider.length : nbAValider, chaud: true }] : []),
    ...(navigation?.perimetre || onglet === 'perimetre' ? [{ cle: 'perimetre' as const, label: 'Mon périmètre', n: perimetre ? perimetre.filter((t) => !estClose(t)).length : null }] : []),
    { cle: 'terminees', label: 'Terminées', n: assignees && creees ? terminees.length : null },
  ];

  const source: Task[] | null =
    onglet === 'assignees' ? assignees : onglet === 'creees' ? creees : onglet === 'a-valider' ? aValider : onglet === 'perimetre' ? perimetre : assignees && creees ? terminees : null;

  const activites = useMemo(() => [...new Set((source ?? []).map((t) => t.activiteLibelle).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)), [source]);

  const q = recherche.trim().toLowerCase();
  const filtrees = (source ?? []).filter((t) => {
    if (statut === 'ouvertes' && estClose(t)) return false;
    if (statut !== 'ouvertes' && statut !== 'toutes' && t.status !== statut) return false;
    if (echeance !== 'toutes') {
      if (echeance === 'aucune' ? !!t.dueDate : !t.dueDate || groupeEcheance(t) !== echeance) return false;
    }
    if (priorite !== 'toutes' && t.priority !== priorite) return false;
    if (activite === 'aucune' ? !!t.activiteLibelle : activite !== 'toutes' && t.activiteLibelle !== activite) return false;
    if (q && !`${referenceTache(t.numero)} ${t.title} ${t.description ?? ''} ${unite(t)} ${t.activiteLibelle ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const ouvertes = (onglet === 'assignees' ? (assignees ?? []) : (source ?? [])).filter((t) => !estClose(t));
  const sousTitre = `${ouvertes.length} ouverte${ouvertes.length > 1 ? 's' : ''} · ${ouvertes.filter((t) => estEnRetard(t)).length} en retard · ${ouvertes.filter((t) => t.status === 'SOUMISE_VALIDATION').length} en validation`;

  const statutDefaut: FiltreStatut = onglet === 'terminees' ? 'toutes' : 'ouvertes';
  const nbFiltres = [statut !== statutDefaut, echeance !== 'toutes', priorite !== 'toutes', activite !== 'toutes'].filter(Boolean).length;
  function effacerFiltres() {
    setStatut(statutDefaut);
    setEcheance('toutes');
    setPriorite('toutes');
    setActivite('toutes');
  }

  function choisirOnglet(o: Onglet) {
    setOnglet(o);
    setStatut(o === 'terminees' ? 'toutes' : 'ouvertes');
  }

  function handleClose() {
    setSelectedTaskId(null);
    // Revenir à /tasks après une ouverture directe, pour qu'un rechargement ne rouvre pas la tâche.
    if (initialTaskId) router.replace('/tasks');
  }

  function handleTaskChanged(updated: Task) {
    const maj = (l: Task[] | null) => l?.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) ?? l;
    setAssignees(maj);
    setCreees(maj);
    setAValider(maj);
    setPerimetre(maj);
    rafraichir();
  }

  // Groupes de la vue Liste : par échéance (En retard, Cette semaine, Plus tard, Terminées) ou par statut.
  const groupes: { cle: string; libelle: string; retard?: boolean; taches: Task[] }[] =
    groupement === 'echeance'
      ? GROUPES_ECHEANCE.map((g) => ({ cle: g.cle, libelle: g.libelle, retard: g.cle === 'retard', taches: filtrees.filter((t) => groupeEcheance(t) === (g.cle as GroupeEcheance)) }))
      : (Object.keys(STATUT_LIBELLE) as TaskStatus[]).map((s) => ({ cle: s, libelle: STATUT_LIBELLE[s], taches: filtrees.filter((t) => t.status === s) }));
  const trier = (l: Task[]) => [...l].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITE_ORDRE[a.priority] - PRIORITE_ORDRE[b.priority]);

  const selectionnee = (source ?? []).find((t) => t.id === selectedTaskId);

  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h1 className="font-heading text-[24px] font-extrabold text-ink-900">Mes tâches</h1>
        {source && <span className="text-[14px] text-text-muted">{sousTitre}</span>}
      </div>

      <div role="tablist" aria-label="Mes tâches" className="mb-3.5 flex gap-1 overflow-x-auto border-b border-line">
        {onglets.map((o) => {
          const actif = onglet === o.cle;
          return (
            <button
              key={o.cle}
              role="tab"
              aria-selected={actif}
              onClick={() => choisirOnglet(o.cle)}
              className={`-mb-px flex flex-none items-center gap-2 border-b-2 px-3 py-[9px] text-[14px] font-semibold ${actif ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-ink'}`}
            >
              {o.label}
              {o.n !== null && (
                <span className={`rounded-[10px] px-[7px] py-px text-[11.5px] font-bold ${actif ? 'bg-ink text-white' : o.chaud && o.n > 0 ? 'bg-gold text-sur-or' : 'bg-fond-gris text-text-muted'}`}>{o.n}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-full items-center gap-2 rounded-[9px] border border-line bg-surface px-[11px] text-text-faint focus-within:border-ink sm:w-[280px]">
          <Search aria-hidden size={16} />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Filtrer mes tâches…"
            aria-label="Filtrer mes tâches"
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-text placeholder:text-text-faint focus:outline-none"
          />
        </label>
        <Filtres actifs={nbFiltres} onEffacer={effacerFiltres}>
        <FiltreSelect<FiltreStatut>
          label="Statut"
          value={statut}
          defaut={statutDefaut}
          onChange={setStatut}
          options={[
            { value: 'ouvertes', label: 'Statut : ouvertes' },
            { value: 'toutes', label: 'Statut : tous' },
            ...(Object.keys(STATUT_LIBELLE) as TaskStatus[]).map((s) => ({ value: s, label: STATUT_LIBELLE[s] })),
          ]}
        />
        <FiltreSelect<FiltreEcheance>
          label="Échéance"
          value={echeance}
          defaut="toutes"
          onChange={setEcheance}
          options={[
            { value: 'toutes', label: 'Échéance' },
            { value: 'retard', label: 'En retard' },
            { value: 'semaine', label: 'Cette semaine' },
            { value: 'plusTard', label: 'Plus tard' },
            { value: 'aucune', label: 'Sans échéance' },
          ]}
        />
        <FiltreSelect<'toutes' | TaskPriority>
          label="Priorité"
          value={priorite}
          defaut="toutes"
          onChange={setPriorite}
          options={[
            { value: 'toutes', label: 'Priorité' },
            { value: 'URGENT', label: 'Haute' },
            { value: 'NORMAL', label: 'Normale' },
            { value: 'FAIBLE', label: 'Basse' },
          ]}
        />
        <FiltreSelect<string>
          label="Plan de travail"
          value={activite}
          defaut="toutes"
          onChange={setActivite}
          options={[{ value: 'toutes', label: 'Plan de travail' }, { value: 'aucune', label: 'Sans activité' }, ...activites.map((a) => ({ value: a, label: a }))]}
        />
        </Filtres>
        <div className="ml-auto">
          <ViewToggle value={vue} onChange={setVue} plein />
        </div>
      </div>

      {!source ? (
        <SqueletteListe lignes={6} colonnes={6} />
      ) : vue === 'kanban' ? (
        <KanbanBoard tasks={filtrees} onSelect={setSelectedTaskId} onAjouter={peutCreer && onglet !== 'terminees' ? () => setCreation(true) : undefined} />
      ) : vue === 'calendar' ? (
        <CalendarView tasks={filtrees} onSelect={setSelectedTaskId} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface" data-testid="liste-taches">
          {filtrees.length === 0 && (
            <EtatVide
              texte={
                source.length === 0
                  ? onglet === 'a-valider'
                    ? 'Aucune tâche n’attend votre validation.'
                    : onglet === 'terminees'
                      ? 'Aucune tâche terminée.'
                      : 'Aucune tâche dans cet onglet.'
                  : 'Aucune tâche ne correspond aux filtres.'
              }
              action={
                source.length > 0 && nbFiltres > 0 ? (
                  <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[13px]`} onClick={effacerFiltres}>
                    Effacer les filtres
                  </button>
                ) : peutCreer && (onglet === 'assignees' || onglet === 'creees') ? (
                  <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[13px]`} onClick={() => setCreation(true)}>
                    Nouvelle tâche
                  </button>
                ) : undefined
              }
            />
          )}
          {filtrees.length > 0 && (
          <div role="table" aria-label="Tâches" className="overflow-x-auto">
            <div role="rowgroup">
              <div role="row" className="hidden h-[38px] grid-cols-[24px_minmax(0,1fr)_124px_84px_92px_120px_74px_176px] items-center gap-3 border-b border-line bg-fond-doux px-4 text-[12px] font-semibold text-text-muted lg:grid">
                <span role="columnheader">
                  <span className="sr-only">Indicateur</span>
                </span>
                <span role="columnheader">Tâche</span>
                <span role="columnheader">Statut</span>
                <span role="columnheader">Priorité</span>
                <span role="columnheader">Échéance</span>
                <span role="columnheader">Avancement</span>
                <span role="columnheader">Équipe</span>
                <span role="columnheader">Activité du plan</span>
              </div>
            </div>
            {groupes
              .filter((g) => g.taches.length > 0)
              .map((g) => (
                <div role="rowgroup" key={g.cle} aria-label={g.libelle}>
                  <div role="row" className={`flex items-center gap-2 border-b border-line-doux bg-fond-doux px-4 py-[9px] text-[13px] font-bold ${g.retard ? 'text-clay' : 'text-ink-900'}`}>
                    <span role="cell">
                      {g.libelle} <span className="font-semibold text-text-faint">{g.taches.length}</span>
                    </span>
                  </div>
                  {trier(g.taches).map((t) => {
                    const ton = tonEcheance(t);
                    return (
                      <div
                        role="row"
                        key={t.id}
                        tabIndex={0}
                        onClick={() => setSelectedTaskId(t.id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedTaskId(t.id))}
                        aria-label={`${t.title}, ${STATUT_LIBELLE[t.status]}, échéance ${dateEcheance(t)}`}
                        data-testid="ligne-tache"
                        className={`grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-doux px-4 py-2.5 hover:bg-survol focus:bg-survol focus:outline-none lg:h-[54px] lg:grid-cols-[24px_minmax(0,1fr)_124px_84px_92px_120px_74px_176px] lg:py-0 ${selectedTaskId === t.id ? 'bg-survol' : ''}`}
                      >
                        <span role="cell" className="flex justify-center">
                          <PointStatut tache={t} />
                        </span>
                        <span role="cell" className="min-w-0">
                          <b className="block truncate font-semibold">{t.title}</b>
                          <small className="flex items-center gap-2.5 text-[12px] text-text-muted">
                            <span className="flex-none font-semibold" data-testid="reference-tache">{referenceTache(t.numero)}</span>
                            <span className="truncate">{unite(t)}</span>
                            {!!t.nbSousTaches && (
                              <span className="flex flex-none items-center gap-1">
                                <ListChecks aria-label="Sous-tâches" size={12} /> {t.nbSousTachesFaites ?? 0}/{t.nbSousTaches}
                              </span>
                            )}
                            {!!t.nbCommentaires && (
                              <span className="flex flex-none items-center gap-1">
                                <MessageSquare aria-label="Commentaires" size={12} /> {t.nbCommentaires}
                              </span>
                            )}
                            {!!t.nbPiecesJointes && (
                              <span className="flex flex-none items-center gap-1">
                                <Paperclip aria-label="Pièces jointes" size={12} /> {t.nbPiecesJointes}
                              </span>
                            )}
                          </small>
                        </span>
                        <span role="cell" className="lg:block">
                          <PastilleStatut status={t.status} />
                        </span>
                        <span role="cell" className="hidden lg:block">
                          <Priorite priority={t.priority} />
                        </span>
                        <span role="cell" className={`hidden text-[13px] font-semibold lg:block ${ton === 'retard' ? 'text-clay' : ton === 'proche' ? 'text-ambre' : ''}`}>
                          {dateEcheance(t, ton === 'proche' || ton === 'semaine')}
                        </span>
                        <span role="cell" className="hidden lg:block">
                          <Avancement valeur={t.progressPercent ?? 0} />
                        </span>
                        <span role="cell" className="hidden lg:block">
                          <Avatars tache={t} />
                        </span>
                        <span role="cell" className="hidden truncate text-[12.5px] text-text-muted lg:block">
                          {t.activiteLibelle ?? '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px] text-text-muted">
            <span>
              {filtrees.length} tâche{filtrees.length > 1 ? 's' : ''} · cliquez sur une ligne pour l’ouvrir
              {onglet === 'perimetre' && perimetreTronque && ` · les ${PERIMETRE_MAX} aux échéances les plus proches`}
            </span>
            <label className="flex items-center gap-1">
              Grouper par :
              <select value={groupement} onChange={(e) => setGroupement(e.target.value as Groupement)} className="bg-transparent font-semibold text-ink">
                <option value="echeance">Échéance</option>
                <option value="statut">Statut</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <FenetreTache taskId={selectedTaskId} onClose={handleClose} onTaskChanged={handleTaskChanged} activiteLibelle={selectionnee?.activiteLibelle} />
      {creation && (
        <CreateTaskModal
          onClose={() => setCreation(false)}
          onCreated={(t) => {
            setCreation(false);
            charger();
            rafraichir();
            setSelectedTaskId(t.id);
          }}
        />
      )}
    </div>
  );
}

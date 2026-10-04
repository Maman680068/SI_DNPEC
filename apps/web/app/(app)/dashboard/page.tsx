'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useInterim } from '../../../lib/interim/InterimProvider';
import { estStagiaire } from '../../../lib/auth/stagiaire';
import { useNavigation } from '../../../lib/navigation/NavigationProvider';
import { getTasks, getDashboard } from '../../../lib/api/tasks';
import { exportDashboardPdf, exportTasksExcel } from '../../../lib/api/export';
import { getTableauRole, type TableauRole } from '../../../lib/api/tableau-de-bord';
import { getMeetings } from '../../../lib/api/meetings';
import { getMyBalances } from '../../../lib/api/leaves';
import { getAnnouncements } from '../../../lib/api/communication';
import { getPlan } from '../../../lib/api/pilotage';
import type { Task, TaskDashboard } from '../../../lib/tasks/types';
import type { Meeting } from '../../../lib/meetings/types';
import type { LeaveBalanceView } from '../../../lib/leaves/types';
import type { Announcement } from '../../../lib/communication/types';
import type { Activite } from '../../../lib/pilotage/types';
import { estClose, estEnRetard } from '../../../lib/tasks/affichage';
import { KpiRow } from '../../../components/tasks/KpiRow';
import { ViewToggle, useVueTaches } from '../../../components/tasks/ViewToggle';
import { KanbanBoard } from '../../../components/tasks/KanbanBoard';
import { CalendarView } from '../../../components/tasks/CalendarView';
import { FenetreTache } from '../../../components/tasks/FenetreTache';
import { BroadcastTaskModal } from '../../../components/tasks/BroadcastTaskModal';
import { BarreAvancement } from '../../../components/tasks/ElementsTache';
import { BlocsRole } from '../../../components/dashboard/BlocsRole';
import { ListeTachesTableau, PiedPanneau } from '../../../components/dashboard/ListeTachesTableau';
import { Agenda, DerniereAnnonce, MesConges, StagiaireEncadre } from '../../../components/dashboard/ColonneDroite';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Barre } from '../../../components/ui/Squelette';

/** Bande des compteurs en cours de chargement (même forme que `KpiRow`). */
function SqueletteBande() {
  return (
    <div role="status" aria-label="Chargement en cours" data-testid="squelette" className="mb-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} aria-hidden className="flex items-center gap-3.5 bg-surface px-[18px] py-4">
          <Barre className="h-7 w-[30px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Barre className="h-3 w-[70%]" />
            <Barre className="h-2 w-[45%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lignes grises d'un panneau en cours de chargement (à la place de « Chargement des tâches… »). */
function SqueletteTaches() {
  return (
    <div role="status" aria-label="Chargement en cours" data-testid="squelette" className="divide-y divide-[#F0F1F6]">
      {['w-[62%]', 'w-[48%]', 'w-[70%]'].map((l, i) => (
        <div key={i} aria-hidden className="flex items-center gap-4 px-[18px] py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <Barre className={`h-3 ${l}`} />
            <Barre className="h-2 w-[30%]" />
          </div>
          <Barre className="hidden h-3 w-[80px] rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Rôles pouvant plausiblement diffuser une tâche à une division (voir
 * CascadeService.canBroadcastToDivision) — DN/DNA n'importe laquelle, Chef de
 * Division la sienne. Indication côté client uniquement : le serveur reste
 * seul juge (voir assertCanBroadcastToDivision). */
const CAN_BROADCAST_ROLES = ['DN', 'DNA', 'CHEF_DIVISION'];

/** Suivi de l'équipe : tâches non closes et closes depuis moins de 30 jours (filtre `suivi` de
 * l'API), dans la limite de ce nombre, échéances les plus proches d'abord (performance 2026-10). */
const SUIVI_MAX = 300;

const CONAKRY = 'Africa/Conakry';

/** Prénom de l'accueil : jamais le préfixe « TEST — » des comptes de démonstration (refonte, étape 9). */
function prenomAccueil(prenom: string | null | undefined): string {
  return (prenom ?? '').replace(/^\s*TEST\s*[—–-]\s*/i, '').trim();
}

/** « Bonjour » de 4 h à 16 h 59, « Bonsoir » de 17 h à 3 h 59, à l'heure de Conakry. */
function salutation(maintenant = new Date()): 'Bonjour' | 'Bonsoir' {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hourCycle: 'h23', timeZone: CONAKRY }).format(maintenant));
  return h >= 4 && h < 17 ? 'Bonjour' : 'Bonsoir';
}

const jourConakry = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: CONAKRY });

/** « lundi à 10 h », « aujourd'hui à 15 h 30 », « demain à 9 h ». */
function quandReunion(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  const [h, m] = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: CONAKRY }).split(':');
  const heure = `${Number(h)} h${m && m !== '00' ? ` ${m}` : ''}`;
  const demain = new Date(maintenant.getTime() + 86_400_000);
  const jour =
    jourConakry(d) === jourConakry(maintenant)
      ? 'aujourd’hui'
      : jourConakry(d) === jourConakry(demain)
        ? 'demain'
        : d.toLocaleDateString('fr-FR', { weekday: 'long', ...(d.getTime() - maintenant.getTime() > 6 * 86_400_000 ? { day: 'numeric', month: 'long' } : {}), timeZone: CONAKRY });
  return `${jour} à ${heure}`;
}

function Panneau({ titre, droite, children, testid }: { titre: string; droite?: React.ReactNode; children: React.ReactNode; testid?: string }) {
  return (
    <section aria-label={titre} data-testid={testid} className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3.5">
        <h2 className="font-heading text-[16px] font-bold text-ink-900">{titre}</h2>
        {droite}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  // Rôle emprunté pendant un intérim (le serveur reste seul juge).
  const { effectiveRole } = useInterim();
  const { navigation } = useNavigation();
  const stagiaire = estStagiaire(effectiveRole);
  const canBroadcast = CAN_BROADCAST_ROLES.includes(effectiveRole ?? '');

  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null);
  const [tableau, setTableau] = useState<TableauRole | null>(null);
  const [mesTaches, setMesTaches] = useState<Task[] | null>(null);
  const [creees, setCreees] = useState<Task[] | null>(null);
  const [equipe, setEquipe] = useState<Task[] | null>(null);
  const [tronque, setTronque] = useState(false);
  const [reunions, setReunions] = useState<Meeting[]>([]);
  const [soldes, setSoldes] = useState<LeaveBalanceView[]>([]);
  const [annonce, setAnnonce] = useState<Announcement | null>(null);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [menuExport, setMenuExport] = useState(false);
  const [source, setSource] = useState<'assignees' | 'creees'>('assignees');
  const [vue, setVue] = useVueTaches();
  const racineExport = useRef<HTMLDivElement>(null);

  const profil = tableau?.profil ?? (stagiaire ? 'STAGIAIRE' : null);
  // Encadrement (Direction, chefs) : « À traiter » puis le suivi de l'équipe en tête de colonne.
  const encadrement = profil === 'DIRECTION' || profil === 'CHEF';

  const rafraichirIndicateurs = useCallback(() => {
    getDashboard()
      .then(setDashboard)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);

  useEffect(() => {
    if (!user) return;
    rafraichirIndicateurs();
    getTasks({ assigneeId: user.id })
      .then(setMesTaches)
      .catch((e) => setErreur(messageChargement(e)));
    getAnnouncements()
      .then((l) => setAnnonce([...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null))
      .catch(() => setAnnonce(null));
    if (stagiaire) return;
    getTableauRole()
      .then(setTableau)
      .catch((e) => setErreur(messageChargement(e)));
    const maintenant = Date.now();
    getMeetings()
      .then((l) =>
        setReunions(
          l
            .filter((m) => m.status === 'PLANIFIEE' && new Date(m.endAt ?? m.startAt).getTime() >= maintenant)
            .sort((a, b) => a.startAt.localeCompare(b.startAt))
            .slice(0, 3),
        ),
      )
      .catch(() => setReunions([]));
    getMyBalances()
      .then(setSoldes)
      .catch(() => setSoldes([]));
  }, [user, stagiaire, rafraichirIndicateurs]);

  // Suivi de l'équipe (encadrement seulement) et activités du plan, une fois le profil connu.
  useEffect(() => {
    if (!encadrement) return;
    getTasks({ suivi: true, limite: SUIVI_MAX + 1 })
      .then((l) => {
        setTronque(l.length > SUIVI_MAX);
        setEquipe(l.slice(0, SUIVI_MAX));
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [encadrement]);

  useEffect(() => {
    if (!user || stagiaire || !mesTaches) return;
    const mesActivites = new Set(mesTaches.map((t) => t.activiteId).filter(Boolean));
    getPlan(new Date().getFullYear())
      .then((p) => setActivites(p.objectifs.flatMap((o) => o.activites).filter((a) => a.responsable.id === user.id || mesActivites.has(a.id))))
      .catch(() => setActivites([]));
  }, [user, stagiaire, mesTaches]);

  useEffect(() => {
    if (source !== 'creees' || creees || !user) return;
    getTasks({ createdById: user.id })
      .then(setCreees)
      .catch((e) => setErreur(messageChargement(e)));
  }, [source, creees, user]);

  useEffect(() => {
    if (!menuExport) return;
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !racineExport.current?.contains(e.target as Node)) setMenuExport(false);
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [menuExport]);

  async function handleExport(kind: 'excel' | 'pdf') {
    setMenuExport(false);
    setExporting(kind);
    setErreur(null);
    try {
      await (kind === 'excel' ? exportTasksExcel() : exportDashboardPdf());
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Impossible de générer l'export");
    } finally {
      setExporting(null);
    }
  }

  function handleTaskChanged(updated: Task) {
    const maj = (l: Task[] | null) => l?.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) ?? l;
    setMesTaches(maj);
    setCreees(maj);
    setEquipe(maj);
    rafraichirIndicateurs();
  }

  const ouvertes = useMemo(() => (mesTaches ?? []).filter((t) => !estClose(t)), [mesTaches]);
  const enRetard = ouvertes.filter((t) => estEnRetard(t)).length;
  const prioritesSource = source === 'assignees' ? ouvertes : (creees ?? []).filter((t) => !estClose(t));
  const equipeOuvertes = (equipe ?? []).filter((t) => !estClose(t));
  const blocs = tableau?.blocs ?? [];
  const bloc = (cle: string) => blocs.find((b) => b.cle === cle);
  const aTraiter = navigation?.aTraiter ?? [];
  const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: CONAKRY });
  const aujourdhui = jour.charAt(0).toUpperCase() + jour.slice(1);

  const vueTaches = (taches: Task[], tout: Task[], max?: number) =>
    vue === 'kanban' ? (
      <div className="p-3.5">
        <KanbanBoard tasks={tout} onSelect={setSelectedTaskId} />
      </div>
    ) : vue === 'calendar' ? (
      <div className="p-3.5">
        <CalendarView tasks={tout} onSelect={setSelectedTaskId} />
      </div>
    ) : taches.length === 0 ? (
      <p className="px-[18px] py-3 text-[13px] text-text-muted">Aucune tâche ouverte.</p>
    ) : (
      <ListeTachesTableau taches={taches} onOuvrir={setSelectedTaskId} onChange={handleTaskChanged} maxParGroupe={max} lienSuite="/tasks?onglet=perimetre" />
    );

  const panneauPriorites = (
    <Panneau
      titre="Mes priorités"
      testid="mes-priorites"
      droite={
        <>
          <label className="sr-only" htmlFor="source-priorites">
            Tâches affichées
          </label>
          <select
            id="source-priorites"
            value={source}
            onChange={(e) => setSource(e.target.value as 'assignees' | 'creees')}
            className="h-[34px] rounded-lg border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink"
          >
            <option value="assignees">Assignées à moi</option>
            <option value="creees">Créées par moi</option>
          </select>
          {!encadrement && (
            <div className="ml-auto">
              <ViewToggle value={vue} onChange={setVue} />
            </div>
          )}
        </>
      }
    >
      {!mesTaches ? (
        <SqueletteTaches />
      ) : encadrement ? (
        prioritesSource.length === 0 ? (
          <p className="px-[18px] py-3 text-[13px] text-text-muted">Aucune tâche ouverte.</p>
        ) : (
          <ListeTachesTableau taches={prioritesSource} onOuvrir={setSelectedTaskId} onChange={handleTaskChanged} />
        )
      ) : (
        vueTaches(prioritesSource, source === 'assignees' ? (mesTaches ?? []) : (creees ?? []))
      )}
      <PiedPanneau
        href="/tasks"
        libelle="Voir toutes mes tâches"
        droite={dashboard ? `${dashboard.termineesCeMois} tâche${dashboard.termineesCeMois > 1 ? 's' : ''} terminée${dashboard.termineesCeMois > 1 ? 's' : ''} ce mois` : undefined}
      />
    </Panneau>
  );

  const blocATraiter = (
    <Panneau titre="À traiter" testid="a-traiter">
      {aTraiter.length === 0 ? (
        <p className="px-[18px] py-3 text-[13px] text-text-muted">Rien à traiter pour le moment.</p>
      ) : (
        <ul>
          {aTraiter.map((x, i) => (
            <li key={x.cle} className={i ? 'border-t border-[#F0F1F6]' : ''}>
              <Link href={x.lien} className="flex items-center gap-3 px-[18px] py-2.5 text-[13.5px] hover:bg-bg" data-testid={`a-traiter-${x.cle}`}>
                {x.gravite ? (
                  <span aria-hidden className={`grid h-6 min-w-[26px] place-items-center rounded-xl px-1.5 ${x.gravite === 'INDISPONIBLE' ? 'bg-clay-50 text-clay' : 'bg-gold-50 text-ambre'}`}>
                    <AlertTriangle size={14} />
                  </span>
                ) : (
                  <span className="grid h-6 min-w-[26px] place-items-center rounded-xl bg-gold-50 px-1.5 text-[12px] font-bold text-ambre">{x.nombre}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{x.libelle}</span>
                  {x.detail && <span className="block truncate text-[12.5px] text-text-muted">{x.detail}</span>}
                </span>
                <ChevronRight aria-hidden size={16} className="text-text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panneau>
  );

  const prochaine = reunions[0];

  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[26px] font-extrabold tracking-[-0.01em] text-ink-900">
            {salutation()} {prenomAccueil(user?.firstName)}
          </h1>
          <p className="mt-[5px] text-[14.5px] text-text-muted" data-testid="resume-jour">
            {aujourdhui} ·{' '}
            <b className="font-semibold text-text">
              {ouvertes.length} tâche{ouvertes.length > 1 ? 's' : ''} ouverte{ouvertes.length > 1 ? 's' : ''}
            </b>
            {enRetard > 0 && (
              <>
                , dont <span className="font-semibold text-clay">{enRetard} en retard</span>
              </>
            )}
            .{prochaine ? ` Prochaine réunion ${quandReunion(prochaine.startAt)}.` : ''}
          </p>
        </div>
        {!stagiaire && (
          <div className="flex flex-wrap gap-2">
            {canBroadcast && (
              <button type="button" onClick={() => setShowBroadcastModal(true)} className="flex h-9 items-center gap-2 rounded-[9px] border border-line bg-surface px-3 text-[13.5px] font-semibold text-ink hover:bg-bg">
                Diffuser à une division
              </button>
            )}
            <div ref={racineExport} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuExport}
                disabled={exporting !== null}
                onClick={() => setMenuExport(!menuExport)}
                className="flex h-9 items-center gap-2 rounded-[9px] border border-line bg-surface px-3 text-[13.5px] font-semibold text-ink hover:bg-bg"
              >
                <FileDown aria-hidden size={16} />
                {exporting ? 'Export…' : 'Exporter'}
                <ChevronDown aria-hidden size={15} />
              </button>
              {menuExport && (
                <div role="menu" className="absolute right-0 top-full z-20 mt-1.5 w-[190px] overflow-hidden rounded-[10px] border border-line bg-surface py-1.5 shadow-lg">
                  <button role="menuitem" type="button" onClick={() => handleExport('excel')} className="block w-full px-3.5 py-2 text-left text-[13.5px] hover:bg-bg">
                    Exporter (Excel)
                  </button>
                  <button role="menuitem" type="button" onClick={() => handleExport('pdf')} className="block w-full px-3.5 py-2 text-left text-[13.5px] hover:bg-bg">
                    Exporter (PDF)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {dashboard ? <KpiRow dashboard={dashboard} perimetre={!!navigation?.perimetre} chezLeChef={!encadrement} /> : !erreur && <SqueletteBande />}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {(encadrement || (profil !== null && profil !== 'AGENT' && profil !== 'STAGIAIRE') || aTraiter.length > 0) && blocATraiter}
          {encadrement && (
            <Panneau titre="Suivi de l’équipe" testid="suivi-equipe" droite={<div className="ml-auto"><ViewToggle value={vue} onChange={setVue} /></div>}>
              {!equipe ? (
                <SqueletteTaches />
              ) : (
                vueTaches(equipeOuvertes, equipe, 5)
              )}
              <p className="border-t border-line px-[18px] py-2.5 text-[12.5px] text-text-muted">
                Tâches en cours, et tâches terminées depuis moins de 30 jours.
                {tronque && ` Les ${SUIVI_MAX} aux échéances les plus proches sont affichées ; l'export Excel donne la liste complète.`}
              </p>
            </Panneau>
          )}
          {(!encadrement || ouvertes.length > 0 || source === 'creees') && panneauPriorites}
          <BlocsRole blocs={blocs} />
        </div>

        <aside aria-label="Agenda et informations" className="flex flex-col gap-3.5">
          {!stagiaire && <Agenda reunions={reunions} />}
          {!stagiaire && profil !== null && <MesConges soldes={soldes} demandes={bloc('demandes')} />}
          {bloc('encadrement') && <StagiaireEncadre bloc={bloc('encadrement')!} />}
          {annonce && <DerniereAnnonce annonce={annonce} />}
        </aside>
      </div>

      {activites.length > 0 && (
        <section aria-label="Mes activités du plan de travail" data-testid="mes-activites" className="mt-[18px] rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3.5">
            <h2 className="font-heading text-[16px] font-bold text-ink-900">Mes activités du plan de travail</h2>
            <span className="ml-auto text-[13px] text-text-muted">Avancement calculé à partir des tâches rattachées</span>
          </div>
          {activites.map((a, i) => (
            <Link
              key={a.id}
              href={`/plan-travail?activite=${a.id}`}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[18px] gap-y-1.5 px-[18px] py-3 hover:bg-bg md:grid-cols-[minmax(0,1fr)_260px_90px] ${i ? 'border-t border-[#F0F1F6]' : ''}`}
            >
              <div className="min-w-0">
                <b className="block truncate font-semibold">{a.libelle}</b>
                <small className="block truncate text-[12.5px] text-text-muted">Indicateur : {a.indicateur}</small>
              </div>
              <div className="col-span-2 flex items-center gap-[7px] text-[12px] text-text-muted md:order-none md:col-span-1">
                <BarreAvancement valeur={a.avancement} />
                <span className="w-10 text-right">{a.avancement} %</span>
              </div>
              <span
                className={`row-start-1 inline-flex h-[22px] w-fit items-center justify-self-end rounded-md px-2 text-[12px] font-semibold md:row-auto md:justify-self-start ${a.enRetard ? 'bg-clay-50 text-clay' : 'bg-ink-50 text-ink'}`}
              >
                {a.enRetard ? 'en retard' : `fin ${new Date(a.dateFin).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })}`}
              </span>
            </Link>
          ))}
        </section>
      )}

      <FenetreTache
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskChanged={handleTaskChanged}
        activiteLibelle={[...(mesTaches ?? []), ...(equipe ?? [])].find((t) => t.id === selectedTaskId)?.activiteLibelle}
      />
      {showBroadcastModal && (
        <BroadcastTaskModal
          onClose={() => setShowBroadcastModal(false)}
          onCreated={(created) => {
            setEquipe((prev) => (prev ? [...created, ...prev] : created));
            setShowBroadcastModal(false);
            rafraichirIndicateurs();
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { Button } from '../../../components/ui/Button';
import { Fenetre } from '../../../components/ui/Fenetre';
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

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const SELECT = 'h-9 max-w-full rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold text-text';
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
export default function PlanTravailPage() {
  const annee0 = new Date().getFullYear();
  const [annee, setAnnee] = useState(annee0);
  const [uniteId, setUniteId] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelObjectif, setNouvelObjectif] = useState(false);
  const [activitePour, setActivitePour] = useState<Objectif | null>(null);
  const [activiteOuverte, setActiviteOuverte] = useState<string | null>(null);

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
        <Chargement erreur={erreur} />
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
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <select aria-label="Unité" className={`${SELECT} min-w-0 flex-1 sm:max-w-[320px] sm:flex-none`} value={uniteId} onChange={(e) => setUniteId(e.target.value)}>
              <option value="">Toutes les unités visibles</option>
              {plan.unites.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.libelle}
                </option>
              ))}
            </select>
            <select aria-label="Année" className={SELECT} value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
              {[annee0 - 1, annee0, annee0 + 1].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        }
        actions={boutonObjectif || undefined}
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
                      onClick={() => {
                        if (window.confirm('Supprimer cet objectif ?'))
                          supprimerObjectif(o.id)
                            .then(charger)
                            .catch((e) => setErreur(messageChargement(e)));
                      }}
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
  return (
    <Fenetre
      titre={`Nouvel objectif ${annee}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      onSubmit={() => {
        setEnCours(true);
        return creerObjectif({ annee, uniteId, libelle, description: description || undefined })
          .then(onFait)
          .catch((e) => setErreur(messageChargement(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">
        Unité
        <select
          className={champ}
          value={uniteId}
          onChange={(e) => setUniteId(e.target.value)}
          required
        >
          {gerees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Libellé de l’objectif
        <input
          className={champ}
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          required
          minLength={3}
        />
      </label>
      <label className="block text-[12.5px] font-semibold">
        Description <span className="font-normal text-text-faint">(facultatif)</span>
        <textarea
          className={champ}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
    </Fenetre>
  );
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
      <label className="mb-3 block text-[12.5px] font-semibold">
        Libellé de l’activité
        <input
          className={champ}
          value={v.libelle}
          onChange={(e) => set({ ...v, libelle: e.target.value })}
          required
          minLength={3}
        />
      </label>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Responsable
        <select
          className={champ}
          value={v.responsableId}
          onChange={(e) => set({ ...v, responsableId: e.target.value })}
          required
        >
          <option value="">Choisir…</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>
              {r.firstName} {r.lastName}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="text-[12.5px] font-semibold">
          Début
          <input
            type="date"
            className={champ}
            value={v.dateDebut}
            onChange={(e) => set({ ...v, dateDebut: e.target.value })}
            required
          />
        </label>
        <label className="text-[12.5px] font-semibold">
          Fin
          <input
            type="date"
            className={champ}
            value={v.dateFin}
            onChange={(e) => set({ ...v, dateFin: e.target.value })}
            required
          />
        </label>
      </div>
      <label className="mb-3 block text-[12.5px] font-semibold">
        Indicateur
        <input
          className={champ}
          value={v.indicateur}
          onChange={(e) => set({ ...v, indicateur: e.target.value })}
          required
          minLength={2}
          placeholder="Ex. notes publiées"
        />
      </label>
      <label className="block text-[12.5px] font-semibold">
        Cible <span className="font-normal text-text-faint">(facultatif)</span>
        <input
          className={champ}
          value={v.cible ?? ''}
          onChange={(e) => set({ ...v, cible: e.target.value })}
          placeholder="Ex. 1 par mois"
        />
      </label>
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
  useEffect(() => {
    getResponsablesPossibles(objectif.uniteId)
      .then(setResponsables)
      .catch((e) => setErreur(messageChargement(e)));
  }, [objectif.uniteId]);
  return (
    <Fenetre
      titre={`Nouvelle activité — ${objectif.libelle}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      largeur={520}
      onSubmit={() => {
        setEnCours(true);
        return creerActivite(objectif.id, { ...v, cible: v.cible || undefined })
          .then(onFait)
          .catch((e) => setErreur(messageChargement(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <ChampsActivite v={v} set={setV} responsables={responsables} />
    </Fenetre>
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
  const [erreur, setErreur] = useState<string | null>(null);

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
              onClick={() => {
                if (window.confirm('Supprimer cette activité ?'))
                  supprimerActivite(id)
                    .then(() => (onChange(), onClose()))
                    .catch((e) => setErreur(messageChargement(e)));
              }}
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
        filAriane={a ? ['Plan de travail', String(a.objectif.annee), a.objectif.libelle] : ['Plan de travail']}
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
        ) : edition ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              modifierActivite(id, { ...edition, cible: edition.cible ?? '' })
                .then(() => (setEdition(null), charger(), onChange()))
                .catch((err) => setErreur(messageChargement(err)));
            }}
          >
            <ChampsActivite v={edition} set={setEdition} responsables={a.responsablesPossibles} />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" onClick={() => setEdition(null)}>
                Annuler
              </Button>
              <Button variant="solid" type="submit">
                Enregistrer l’activité
              </Button>
            </div>
          </form>
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

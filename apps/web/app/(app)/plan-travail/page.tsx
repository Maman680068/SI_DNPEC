'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Fenetre } from '../../../components/ui/Fenetre';
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
const petit = '!px-3 !py-1.5 !text-[12.5px]';
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

function Avancement({ valeur, retard }: { valeur: number; retard?: boolean }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Avancement ${valeur} %`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg">
        <div
          className={`h-full ${retard ? 'bg-clay' : 'bg-sage'}`}
          style={{ width: `${valeur}%` }}
        />
      </div>
      <span className="text-[12px] font-semibold tabular-nums">{valeur} %</span>
    </div>
  );
}

/** Plan de travail (socle N5) : objectif → activités datées → tâches ; avancement calculé. */
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

  return (
    <div className="max-w-[1100px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold">Plan de travail</h1>
        {plan.peutCreer && (
          <Button variant="solid" onClick={() => setNouvelObjectif(true)}>
            + Nouvel objectif
          </Button>
        )}
      </div>
      <p className="mb-5 text-[13px] text-text-muted">
        Objectifs de l’année, activités datées (responsable, indicateur) et tâches qui les
        réalisent. L’avancement est calculé à partir des tâches, jamais saisi.
      </p>
      <ErreurChargement message={erreur} />

      <div className="mb-5 flex flex-wrap gap-3">
        <label className="text-[12.5px] font-semibold">
          Année
          <select
            className={champ}
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
          >
            {[annee0 - 1, annee0, annee0 + 1].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[220px] text-[12.5px] font-semibold">
          Unité
          <select className={champ} value={uniteId} onChange={(e) => setUniteId(e.target.value)}>
            <option value="">Toutes les unités visibles</option>
            {plan.unites.map((u) => (
              <option key={u.id} value={u.id}>
                {u.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      {plan.objectifs.length === 0 && (
        <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">
          Aucun objectif pour {annee}.
        </p>
      )}

      <div className="space-y-4">
        {plan.objectifs.map((o) => (
          <section
            key={o.id}
            data-testid="objectif"
            className="rounded-lg border border-line bg-surface p-4"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-faint">
                  {o.unite}
                </div>
                <h2 className="text-[16px] font-bold">{o.libelle}</h2>
                {o.description && <p className="text-[12.5px] text-text-muted">{o.description}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Avancement valeur={o.avancement} />
                {o.droits.ajouterActivite && (
                  <Button className={petit} onClick={() => setActivitePour(o)}>
                    + Activité
                  </Button>
                )}
                {o.droits.supprimer && (
                  <Button
                    className={petit}
                    onClick={() => {
                      if (window.confirm('Supprimer cet objectif ?'))
                        supprimerObjectif(o.id)
                          .then(charger)
                          .catch((e) => setErreur(messageChargement(e)));
                    }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
            {o.activites.length === 0 ? (
              <p className="text-[12.5px] text-text-muted">Aucune activité.</p>
            ) : (
              <ul className="divide-y divide-line">
                {o.activites.map((a) => (
                  <LigneActivite key={a.id} a={a} onOuvrir={() => setActiviteOuverte(a.id)} />
                ))}
              </ul>
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

function LigneActivite({ a, onOuvrir }: { a: Activite; onOuvrir: () => void }) {
  return (
    <li data-testid="activite" className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <button onClick={onOuvrir} className="min-w-0 flex-1 text-left">
        <div className="text-[13.5px] font-semibold text-ink underline-offset-2 hover:underline">
          {a.libelle}
        </div>
        <div className="text-[12px] text-text-muted">
          {a.responsable.nom} · du {date(a.dateDebut)} au {date(a.dateFin)} · {a.indicateur}
          {a.cible ? ` — cible : ${a.cible}` : ''} · {a.nombreTaches} tâche(s)
        </div>
      </button>
      <div className="flex items-center gap-2">
        {a.enRetard && <Badge tone="clay">En retard</Badge>}
        <Avancement valeur={a.avancement} retard={a.enRetard} />
      </div>
    </li>
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

  return (
    <>
      <Fenetre titre={a ? a.libelle : 'Activité'} onClose={onClose} largeur={880} erreur={erreur}>
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
          <div data-testid="fiche-activite">
            <div className="mb-3 text-[12.5px] text-text-muted">
              {a.objectif.unite} · Objectif « {a.objectif.libelle} » ({a.objectif.annee})
            </div>
            <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="inline font-semibold">Responsable : </dt>
                <dd className="inline">{a.responsable.nom}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Période : </dt>
                <dd className="inline">
                  du {date(a.dateDebut)} au {date(a.dateFin)}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Indicateur : </dt>
                <dd className="inline">
                  {a.indicateur}
                  {a.cible ? ` — cible : ${a.cible}` : ''}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="font-semibold">Avancement :</dt>
                <dd className="flex items-center gap-2">
                  <Avancement valeur={a.avancement} retard={a.enRetard} />
                  {a.enRetard && <Badge tone="clay">En retard</Badge>}
                </dd>
              </div>
            </dl>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold">Tâches ({a.nombreTaches})</h3>
              <div className="flex flex-wrap items-center gap-2">
                <ViewToggle value={vue} onChange={setVue} vues={['kanban', 'calendar']} />
                <Button className={petit} onClick={() => setNouvelleTache(true)}>
                  + Nouvelle tâche
                </Button>
                {a.droits.modifier && (
                  <Button
                    className={petit}
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
                  </Button>
                )}
                {a.droits.supprimer && (
                  <Button
                    className={petit}
                    onClick={() => {
                      if (window.confirm('Supprimer cette activité ?'))
                        supprimerActivite(id)
                          .then(() => (onChange(), onClose()))
                          .catch((e) => setErreur(messageChargement(e)));
                    }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
            {!taches ? (
              <Chargement erreur={erreur} />
            ) : taches.length === 0 ? (
              <p className="text-[12.5px] text-text-muted">
                Aucune tâche rattachée : l’avancement reste à 0 %.
              </p>
            ) : vue === 'kanban' ? (
              <KanbanBoard tasks={taches} onSelect={(t) => router.push(`/tasks/${t}`)} />
            ) : (
              <CalendarView tasks={taches} onSelect={(t) => router.push(`/tasks/${t}`)} />
            )}
          </div>
        )}
      </Fenetre>
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

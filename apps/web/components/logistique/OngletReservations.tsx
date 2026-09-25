'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  annulerReservation,
  creerRessource,
  getDisponibilite,
  getReservation,
  getReservations,
  getRessources,
  modifierRessource,
  refuserReservation,
  reserver,
  validerReservation,
} from '../../lib/api/logistique';
import type { Disponibilite, ModeReservation, Reservation, Ressource, StatutReservation, TypeRessource } from '../../lib/logistique/types';
import { MODE_LABEL, STATUT_RESERVATION_LABEL, TYPE_RESSOURCE_LABEL } from '../../lib/logistique/types';
import { Erreur, Fenetre, SELECT_CLASS, TEXTAREA_CLASS } from '../courrier/ui';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Champ, Info, Panneau, SousOnglets, Vide, dateHeure, nom, useAction } from './commun';

const TON: Record<StatutReservation, 'gold' | 'sage' | 'clay' | 'muted'> = {
  EN_ATTENTE: 'gold',
  CONFIRMEE: 'sage',
  REFUSEE: 'clay',
  ANNULEE: 'muted',
  ANNULEE_PRIORITE: 'clay',
};
const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const demain = () => {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Vue = 'reserver' | 'miennes' | 'a_valider' | 'ressources';

export function OngletReservations({ gestionnaire, ouvrirId, onChange }: { gestionnaire: boolean; ouvrirId: string | null; onChange: () => void }) {
  const [vue, setVue] = useState<Vue>(ouvrirId ? 'miennes' : 'reserver');
  const [info, setInfo] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<Reservation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (ouvrirId) getReservation(ouvrirId).then(setOuverte).catch((e) => setErreur(messageChargement(e)));
  }, [ouvrirId]);
  const options: { cle: Vue; libelle: string }[] = [
    { cle: 'reserver', libelle: 'Réserver' },
    { cle: 'miennes', libelle: 'Mes réservations' },
    ...(gestionnaire
      ? [
          { cle: 'a_valider' as Vue, libelle: 'À valider' },
          { cle: 'ressources' as Vue, libelle: 'Ressources' },
        ]
      : []),
  ];
  const fait = (m: string) => {
    setInfo(m);
    setOuverte(null);
    onChange();
  };
  return (
    <div data-testid="onglet-reservations">
      <ErreurChargement message={erreur} />
      <Info message={info} />
      <SousOnglets valeur={vue} options={options} onChange={(k) => { setVue(k); setInfo(null); }} />
      {vue === 'reserver' && <Reserver onReserve={(r) => { fait(r.statut === 'EN_ATTENTE' ? 'Réservation enregistrée : en attente de validation par un gestionnaire.' : 'Réservation confirmée.'); setVue('miennes'); }} />}
      {(vue === 'miennes' || vue === 'a_valider') && <ListeReservations key={`${vue}-${info}`} vue={vue} onOuvrir={setOuverte} />}
      {vue === 'ressources' && <Ressources />}
      {ouverte && <FicheReservation r={ouverte} onClose={() => setOuverte(null)} onChange={fait} />}
    </div>
  );
}

function Reserver({ onReserve }: { onReserve: (r: Reservation) => void }) {
  const [jour, setJour] = useState(demain());
  const [de, setDe] = useState('09:00');
  const [a, setA] = useState('10:00');
  const [type, setType] = useState<TypeRessource | ''>('');
  const [dispo, setDispo] = useState<Disponibilite[] | null>(null);
  const [choix, setChoix] = useState<{ ressource: Disponibilite; prioritaire: boolean } | null>(null);
  const { enCours, erreur, lancer } = useAction();
  const debut = () => new Date(`${jour}T${de}`).toISOString();
  const fin = () => new Date(`${jour}T${a}`).toISOString();
  const chercher = async () => {
    const r = await lancer(() => getDisponibilite(debut(), fin(), type || undefined), 'Recherche impossible');
    if (r) setDispo(r);
  };
  return (
    <div>
      <form
        className="mb-4 flex flex-wrap items-end gap-2.5 rounded-lg border border-line bg-surface p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void chercher();
        }}
      >
        <div>
          <label htmlFor="res-jour" className="mb-1 block text-[12px] font-semibold">Jour</label>
          <input id="res-jour" type="date" className={`${SELECT_CLASS} !w-auto`} value={jour} onChange={(e) => setJour(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="res-de" className="mb-1 block text-[12px] font-semibold">De</label>
          <input id="res-de" type="time" className={`${SELECT_CLASS} !w-auto`} value={de} onChange={(e) => setDe(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="res-a" className="mb-1 block text-[12px] font-semibold">À</label>
          <input id="res-a" type="time" className={`${SELECT_CLASS} !w-auto`} value={a} onChange={(e) => setA(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="res-type" className="mb-1 block text-[12px] font-semibold">Ressource</label>
          <select id="res-type" className={`${SELECT_CLASS} !w-auto`} value={type} onChange={(e) => setType(e.target.value as TypeRessource | '')}>
            <option value="">Toutes</option>
            {(Object.keys(TYPE_RESSOURCE_LABEL) as TypeRessource[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_RESSOURCE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="gold" disabled={enCours}>
          Voir les disponibilités
        </Button>
      </form>
      <Erreur message={erreur} />
      {dispo && dispo.length === 0 && <Vide>Aucune ressource réservable.</Vide>}
      {dispo && dispo.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2" data-testid="disponibilites">
          {dispo.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-surface p-3.5" data-testid="ressource">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">{r.nom}</div>
                  <div className="text-[12px] text-text-muted">
                    {TYPE_RESSOURCE_LABEL[r.type]}
                    {r.capacite ? ` · ${r.capacite} places` : ''} · {MODE_LABEL[r.mode]}
                  </div>
                </div>
                <Badge tone={r.libre ? 'sage' : 'clay'}>{r.libre ? 'Libre' : 'Occupée'}</Badge>
              </div>
              {r.conflits.map((c) => (
                <p key={c.id} className="text-[12.5px] text-text-muted">
                  Réservée par {nom(c.titulaire)} de {heure(c.debut)} à {heure(c.fin)}
                  {c.objet ? ` — ${c.objet}` : ''}
                </p>
              ))}
              <div className="mt-2 flex justify-end">
                {r.libre ? (
                  <Button className="px-3 py-1.5 text-[12.5px]" onClick={() => setChoix({ ressource: r, prioritaire: false })}>
                    Réserver
                  </Button>
                ) : r.prioritePossible ? (
                  <Button className="px-3 py-1.5 text-[12.5px]" onClick={() => setChoix({ ressource: r, prioritaire: true })}>
                    Faire valoir la priorité
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {choix && (
        <FenetreReserver
          ressource={choix.ressource}
          prioritaire={choix.prioritaire}
          debut={debut()}
          fin={fin()}
          onClose={() => setChoix(null)}
          onDone={(r) => {
            setChoix(null);
            onReserve(r);
          }}
        />
      )}
    </div>
  );
}

function FenetreReserver({ ressource, prioritaire, debut, fin, onClose, onDone }: { ressource: Disponibilite; prioritaire: boolean; debut: string; fin: string; onClose: () => void; onDone: (r: Reservation) => void }) {
  const [objet, setObjet] = useState('');
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre
      titre={prioritaire ? 'Réserver en faisant valoir la priorité' : `Réserver ${ressource.nom}`}
      sousTitre={`${ressource.nom} — du ${dateHeure(debut)} au ${dateHeure(fin)}`}
      onClose={onClose}
      valider={prioritaire ? 'Prendre le créneau' : 'Réserver'}
      danger={prioritaire}
      enCours={enCours}
      onSubmit={async () => {
        const r = await lancer(() => reserver({ ressourceId: ressource.id, debut, fin, objet: objet.trim(), prioritaire: prioritaire || undefined }), 'Réservation impossible');
        if (r) onDone(r);
      }}
    >
      <Erreur message={erreur} />
      {prioritaire && (
        <div className="mb-3.5 rounded-md border border-clay bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">
          Ces réservations seront annulées pour priorité, et leurs titulaires prévenus avec votre nom :
          <ul className="mt-1 list-disc pl-5">
            {ressource.conflits.map((c) => (
              <li key={c.id}>
                {nom(c.titulaire)}, de {heure(c.debut)} à {heure(c.fin)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Champ id="res-objet" label="Objet">
        <input id="res-objet" className={SELECT_CLASS} value={objet} onChange={(e) => setObjet(e.target.value)} minLength={2} maxLength={300} required />
      </Champ>
      {!prioritaire && ressource.mode === 'VALIDATION' && <p className="mb-3 text-[12.5px] text-text-muted">Cette ressource demande la validation d’un gestionnaire : le créneau vous est réservé en attendant.</p>}
    </Fenetre>
  );
}

function ListeReservations({ vue, onOuvrir }: { vue: 'miennes' | 'a_valider'; onOuvrir: (r: Reservation) => void }) {
  const [liste, setListe] = useState<Reservation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getReservations({ vue })
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, [vue]);
  if (erreur) return <ErreurChargement message={erreur} />;
  if (!liste) return null;
  if (liste.length === 0) return <Vide>{vue === 'miennes' ? 'Aucune réservation.' : 'Aucune réservation en attente.'}</Vide>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {liste.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onOuvrir(r)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg" data-testid="ligne-reservation">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">
                {r.ressource.nom} — {dateHeure(r.debut)} → {heure(r.fin)}
              </div>
              <div className="text-[12.5px] text-text-muted">
                {r.objet ?? 'Réservé'} · {nom(r.titulaire)}
                {r.statut === 'ANNULEE_PRIORITE' && r.evinceePar ? ` · priorité de ${nom(r.evinceePar)}` : ''}
              </div>
            </div>
            <Badge tone={TON[r.statut]}>{STATUT_RESERVATION_LABEL[r.statut]}</Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FicheReservation({ r, onClose, onChange }: { r: Reservation; onClose: () => void; onChange: (m: string) => void }) {
  const [refus, setRefus] = useState<'refuser' | 'annuler' | null>(null);
  const [motif, setMotif] = useState('');
  const { enCours, erreur, lancer } = useAction();
  const agir = async (fn: () => Promise<unknown>, m: string) => {
    if (await lancer(fn, 'Action impossible')) onChange(m);
  };
  if (refus) {
    return (
      <Fenetre
        titre={refus === 'refuser' ? 'Refuser la réservation' : 'Annuler la réservation'}
        onClose={() => setRefus(null)}
        valider={refus === 'refuser' ? 'Refuser' : 'Annuler la réservation'}
        danger
        enCours={enCours}
        onSubmit={() => agir(() => (refus === 'refuser' ? refuserReservation(r.id, motif.trim()) : annulerReservation(r.id, motif.trim())), refus === 'refuser' ? 'Réservation refusée.' : 'Réservation annulée.')}
      >
        <Erreur message={erreur} />
        <Champ id="res-motif" label="Motif (communiqué au titulaire)">
          <textarea id="res-motif" className={TEXTAREA_CLASS} value={motif} onChange={(e) => setMotif(e.target.value)} minLength={3} required />
        </Champ>
      </Fenetre>
    );
  }
  return (
    <Panneau titre={r.ressource.nom} sousTitre={`Du ${dateHeure(r.debut)} au ${dateHeure(r.fin)} — ${STATUT_RESERVATION_LABEL[r.statut]}`} onClose={onClose} testid="fiche-reservation">
      <Erreur message={erreur} />
      <dl className="mb-4 grid grid-cols-[120px_1fr] gap-y-1 text-[13px]">
        <dt className="text-text-muted">Titulaire</dt>
        <dd>{nom(r.titulaire)}</dd>
        <dt className="text-text-muted">Objet</dt>
        <dd>{r.objet ?? '—'}</dd>
        {r.meeting && (
          <>
            <dt className="text-text-muted">Réunion</dt>
            <dd>{r.meeting.title}</dd>
          </>
        )}
        {r.statut === 'ANNULEE_PRIORITE' && (
          <>
            <dt className="text-text-muted">Priorité</dt>
            <dd className="text-clay">Annulée : {nom(r.evinceePar)} a fait valoir la priorité hiérarchique.</dd>
          </>
        )}
        {r.motifRefus && (
          <>
            <dt className="text-text-muted">Refus</dt>
            <dd className="text-clay">{r.motifRefus}</dd>
          </>
        )}
        {r.motifAnnulation && r.statut === 'ANNULEE' && (
          <>
            <dt className="text-text-muted">Annulation</dt>
            <dd>
              {r.motifAnnulation} ({nom(r.annuleePar)})
            </dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        {r.droits.annuler && (
          <Button disabled={enCours} onClick={() => (r.estTitulaire ? void agir(() => annulerReservation(r.id), 'Réservation annulée.') : setRefus('annuler'))}>
            Annuler la réservation
          </Button>
        )}
        {r.droits.refuser && (
          <Button disabled={enCours} onClick={() => setRefus('refuser')}>
            Refuser
          </Button>
        )}
        {r.droits.valider && (
          <Button variant="gold" disabled={enCours} onClick={() => agir(() => validerReservation(r.id), 'Réservation confirmée.')}>
            Valider
          </Button>
        )}
      </div>
    </Panneau>
  );
}

function Ressources() {
  const [liste, setListe] = useState<Ressource[] | null>(null);
  const [edition, setEdition] = useState<Ressource | 'nouvelle' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    getRessources()
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);
  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-3 flex justify-end">
        <Button variant="gold" onClick={() => setEdition('nouvelle')}>
          + Nouvelle ressource
        </Button>
      </div>
      {liste && liste.length === 0 && <Vide>Aucune ressource : créez les salles et le matériel de présentation.</Vide>}
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {liste?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold">
                {r.nom} {!r.actif && <Badge tone="muted">Inactive</Badge>}
              </div>
              <div className="text-[12.5px] text-text-muted">
                {TYPE_RESSOURCE_LABEL[r.type]}
                {r.capacite ? ` · ${r.capacite} places` : ''} · {MODE_LABEL[r.mode]}
              </div>
            </div>
            <Button className="px-3 py-1.5 text-[12.5px]" onClick={() => setEdition(r)}>
              Modifier
            </Button>
          </li>
        ))}
      </ul>
      {edition && (
        <FenetreRessource
          ressource={edition === 'nouvelle' ? null : edition}
          onClose={() => setEdition(null)}
          onDone={() => {
            setEdition(null);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreRessource({ ressource, onClose, onDone }: { ressource: Ressource | null; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({
    nom: ressource?.nom ?? '',
    type: ressource?.type ?? ('SALLE' as TypeRessource),
    capacite: ressource?.capacite ? String(ressource.capacite) : '',
    mode: ressource?.mode ?? ('IMMEDIATE' as ModeReservation),
    description: ressource?.description ?? '',
    actif: ressource?.actif ?? true,
  });
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre
      titre={ressource ? `Modifier ${ressource.nom}` : 'Nouvelle ressource réservable'}
      onClose={onClose}
      valider="Enregistrer"
      enCours={enCours}
      onSubmit={async () => {
        const capacite = v.capacite ? Number(v.capacite) : null;
        const ok = await lancer(
          () =>
            ressource
              ? modifierRessource(ressource.id, { nom: v.nom.trim(), capacite, mode: v.mode, description: v.description.trim() || null, actif: v.actif })
              : creerRessource({ nom: v.nom.trim(), type: v.type, capacite: capacite ?? undefined, mode: v.mode, description: v.description.trim() || undefined }),
          'Enregistrement impossible',
        );
        if (ok) onDone();
      }}
    >
      <Erreur message={erreur} />
      <Champ id="rs-nom" label="Nom">
        <input id="rs-nom" className={SELECT_CLASS} value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} minLength={2} required />
      </Champ>
      {!ressource && (
        <Champ id="rs-type" label="Type">
          <select id="rs-type" className={SELECT_CLASS} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as TypeRessource })}>
            {(Object.keys(TYPE_RESSOURCE_LABEL) as TypeRessource[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_RESSOURCE_LABEL[t]}
              </option>
            ))}
          </select>
        </Champ>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Champ id="rs-cap" label="Capacité (facultatif)">
          <input id="rs-cap" type="number" min={1} className={SELECT_CLASS} value={v.capacite} onChange={(e) => setV({ ...v, capacite: e.target.value })} />
        </Champ>
        <Champ id="rs-mode" label="Confirmation">
          <select id="rs-mode" className={SELECT_CLASS} value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value as ModeReservation })}>
            {(Object.keys(MODE_LABEL) as ModeReservation[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      <Champ id="rs-desc" label="Description (facultatif)">
        <input id="rs-desc" className={SELECT_CLASS} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Champ>
      {ressource && (
        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={v.actif} onChange={(e) => setV({ ...v, actif: e.target.checked })} /> Réservable
        </label>
      )}
    </Fenetre>
  );
}

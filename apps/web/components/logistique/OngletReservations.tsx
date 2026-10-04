'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
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
import {
  BTN_DANGER_CONTOUR,
  BTN_LIGNE,
  BTN_LIGNE_PRINCIPAL,
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  BarreOutils,
  CleValeur,
  EtatVide,
  LigneTableau,
  Pastille,
  SectionFenetre,
  Tableau,
  type TonPastille,
} from '../ui/Charte';
import { Champ, Info, Panneau, SousOnglets, dateHeure, nom, useAction } from './commun';

const TON: Record<StatutReservation, TonPastille> = {
  EN_ATTENTE: 'ambre',
  CONFIRMEE: 'vert',
  REFUSEE: 'rouge',
  ANNULEE: 'gris',
  ANNULEE_PRIORITE: 'rouge',
};
const GRILLE_RES = 'lg:grid-cols-[minmax(0,1fr)_170px_minmax(0,1.2fr)_minmax(0,1fr)_150px]';
const GRILLE_RESSOURCES = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_100px_minmax(0,1fr)_96px]';
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
      <div className="mb-3.5">
        <SousOnglets valeur={vue} options={options} onChange={(k) => { setVue(k); setInfo(null); }} label="Réservations affichées" />
      </div>
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
        className="mb-4 flex flex-wrap items-end gap-2.5 rounded-xl border border-line bg-surface p-3.5"
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
        <button type="submit" className={BTN_PRINCIPAL} disabled={enCours}>
          Voir les disponibilités
        </button>
      </form>
      <Erreur message={erreur} />
      {dispo && dispo.length === 0 && <EtatVide texte="Aucune ressource réservable." />}
      {dispo && dispo.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2" data-testid="disponibilites">
          {dispo.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-surface p-3.5" data-testid="ressource">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">{r.nom}</div>
                  <div className="text-[12px] text-text-muted">
                    {TYPE_RESSOURCE_LABEL[r.type]}
                    {r.capacite ? ` · ${r.capacite} places` : ''} · {MODE_LABEL[r.mode]}
                  </div>
                </div>
                <Pastille ton={r.libre ? 'vert' : 'rouge'}>{r.libre ? 'Libre' : 'Occupée'}</Pastille>
              </div>
              {r.conflits.map((c) => (
                <p key={c.id} className="text-[12.5px] text-text-muted">
                  Réservée par {nom(c.titulaire)} de {heure(c.debut)} à {heure(c.fin)}
                  {c.objet ? ` — ${c.objet}` : ''}
                </p>
              ))}
              <div className="mt-2 flex justify-end">
                {r.libre ? (
                  <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setChoix({ ressource: r, prioritaire: false })}>
                    Réserver
                  </button>
                ) : r.prioritePossible ? (
                  <button type="button" className={BTN_LIGNE} onClick={() => setChoix({ ressource: r, prioritaire: true })}>
                    Faire valoir la priorité
                  </button>
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
  return (
    <Tableau
      label={vue === 'miennes' ? 'Mes réservations' : 'Réservations à valider'}
      grille={GRILLE_RES}
      colonnes={['Ressource', 'Créneau', 'Objet', 'Titulaire', 'Statut']}
      vide={<EtatVide texte={vue === 'miennes' ? 'Aucune réservation.' : 'Aucune réservation en attente.'} />}
    >
      {liste.map((r) => (
        <LigneTableau key={r.id} grille={GRILLE_RES} onClick={() => onOuvrir(r)} testid="ligne-reservation" label={`${r.ressource.nom}, ${dateHeure(r.debut)}`}>
          <span className="block font-semibold">{r.ressource.nom}</span>
          <span className="text-[12.5px]">
            {dateHeure(r.debut)} → {heure(r.fin)}
          </span>
          <span className="block truncate text-[12.5px] text-text-muted">{r.objet ?? 'Réservé'}</span>
          <span className="block text-[12.5px]">
            {nom(r.titulaire)}
            {r.statut === 'ANNULEE_PRIORITE' && r.evinceePar ? <span className="block text-text-muted">priorité de {nom(r.evinceePar)}</span> : null}
          </span>
          <Pastille ton={TON[r.statut]}>{STATUT_RESERVATION_LABEL[r.statut]}</Pastille>
        </LigneTableau>
      ))}
    </Tableau>
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
        titre={refus === 'refuser' ? 'Rejeter la réservation' : 'Annuler la réservation'}
        onClose={() => setRefus(null)}
        valider={refus === 'refuser' ? 'Rejeter' : 'Annuler la réservation'}
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
    <Panneau
      titre={r.ressource.nom}
      filAriane={['Logistique', 'Réservations']}
      sousTitre={
        <span className="flex flex-wrap items-center gap-2">
          <Pastille ton={TON[r.statut]}>{STATUT_RESERVATION_LABEL[r.statut]}</Pastille>
          Du {dateHeure(r.debut)} au {dateHeure(r.fin)}
        </span>
      }
      onClose={onClose}
      testid="fiche-reservation"
      cote={
        <>
          {(r.droits.valider || r.droits.refuser || r.droits.annuler) && (
            <div className="mb-[18px] grid gap-2">
              {r.droits.valider && (
                <button type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => agir(() => validerReservation(r.id), 'Réservation confirmée.')}>
                  Valider
                </button>
              )}
              {r.droits.refuser && (
                <button type="button" className={`${BTN_DANGER_CONTOUR} w-full`} disabled={enCours} onClick={() => setRefus('refuser')}>
                  Rejeter avec un motif
                </button>
              )}
              {r.droits.annuler && (
                <button type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={enCours} onClick={() => (r.estTitulaire ? void agir(() => annulerReservation(r.id), 'Réservation annulée.') : setRefus('annuler'))}>
                  Annuler la réservation
                </button>
              )}
            </div>
          )}
          <SectionFenetre titre="Informations" className="">
            <CleValeur largeur={84} lignes={[['Type', TYPE_RESSOURCE_LABEL[r.ressource.type]], ['Mode', MODE_LABEL[r.ressource.mode]], ['Titulaire', nom(r.titulaire)]]} />
          </SectionFenetre>
        </>
      }
    >
      <Erreur message={erreur} />
      <SectionFenetre titre="Réservation" className="">
        <CleValeur
          largeur={110}
          lignes={
            [
              ['Objet', r.objet ?? '—'],
              r.meeting ? ['Réunion', r.meeting.title] : null,
              r.statut === 'ANNULEE_PRIORITE' ? ['Priorité', <span key="p" className="text-clay">Annulée : {nom(r.evinceePar)} a fait valoir la priorité hiérarchique.</span>] : null,
              r.motifRefus ? ['Refus', <span key="r" className="text-clay">{r.motifRefus}</span>] : null,
              r.motifAnnulation && r.statut === 'ANNULEE' ? ['Annulation', `${r.motifAnnulation} (${nom(r.annuleePar)})`] : null,
            ].filter(Boolean) as [ReactNode, ReactNode][]
          }
        />
      </SectionFenetre>
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
      <BarreOutils
        droite={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setEdition('nouvelle')}>
            <Plus aria-hidden size={17} />
            Nouvelle ressource
          </button>
        }
      >
        <span className="text-[13px] text-text-muted">Salles et matériel de présentation proposés à la réservation.</span>
      </BarreOutils>
      {liste && (
        <Tableau label="Ressources réservables" grille={GRILLE_RESSOURCES} colonnes={['Ressource', 'Type', 'Capacité', 'Mode', <span key="a" className="sr-only">Action</span>]} vide={<EtatVide texte="Aucune ressource : créez les salles et le matériel de présentation." />}>
          {liste.map((r) => (
            <LigneTableau key={r.id} grille={GRILLE_RESSOURCES}>
              <span className="block font-semibold">
                {r.nom} {!r.actif && <Pastille ton="gris">Inactive</Pastille>}
              </span>
              <span className="text-[12.5px] text-text-muted">{TYPE_RESSOURCE_LABEL[r.type]}</span>
              <span className="text-[12.5px] text-text-muted">{r.capacite ? `${r.capacite} places` : '—'}</span>
              <span className="text-[12.5px] text-text-muted">{MODE_LABEL[r.mode]}</span>
              <button type="button" className={BTN_LIGNE} onClick={() => setEdition(r)} aria-label={`Modifier ${r.nom}`}>
                Modifier
              </button>
            </LigneTableau>
          ))}
        </Tableau>
      )}
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

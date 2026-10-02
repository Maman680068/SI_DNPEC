'use client';

import { useCallback, useEffect, useState } from 'react';
import { affecterVehicule, ajouterPlein, creerVehicule, getParcVehicules, getVehicule, modifierVehicule, retourMission } from '../../lib/api/vehicules';
import type { EtatVehicule, MissionVehicule, ParcVehicules, VehiculeDetail } from '../../lib/logistique/vehicules';
import { LIBELLE_ETAT_VEHICULE } from '../../lib/logistique/vehicules';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { dateCourte, nom } from './commun';

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const TON_ETAT: Record<EtatVehicule, 'sage' | 'clay' | 'gold' | 'muted'> = { EN_SERVICE: 'sage', EN_PANNE: 'clay', EN_REPARATION: 'gold', REFORME: 'muted' };
const km = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} km`);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Véhicules de service, missions et carburant (socle N6, SIG-RF-LOG-03). */
export function OngletVehicules() {
  const [parc, setParc] = useState<ParcVehicules | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getParcVehicules().then(setParc).catch((x) => setErreur(messageChargement(x))), []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!parc) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const g = parc.droits.gerer;
  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Parc de véhicules</h2>
        {g && <Button variant="solid" onClick={() => setNouveau(true)}>+ Nouveau véhicule</Button>}
      </div>
      {parc.vehicules.length === 0 ? (
        <p className="mb-6 rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucun véhicule enregistré.</p>
      ) : (
        <ul className="mb-6 divide-y divide-line rounded-lg border border-line bg-surface" data-testid="vehicules">
          {parc.vehicules.map((v) => (
            <li key={v.id}>
              <button data-testid="vehicule" onClick={() => setOuvert(v.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg">
                <span>
                  <span className="text-[13.5px] font-semibold">{v.immatriculation}</span>{' '}
                  <span className="text-[12.5px] text-text-muted">{v.marque} {v.modele} · {v.energie === 'GAZOLE' ? 'Gazole' : 'Essence'} · {km(v.kilometrage)}</span>
                </span>
                <span className="flex gap-1.5">
                  {!v.actif && <Badge tone="muted">Retiré du parc</Badge>}
                  <Badge tone={TON_ETAT[v.etat]}>{LIBELLE_ETAT_VEHICULE[v.etat]}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {g && <Missions parc={parc} onChange={charger} onErreur={setErreur} />}
      {nouveau && <FenetreVehicule onClose={() => setNouveau(false)} onFait={() => (setNouveau(false), charger())} />}
      {ouvert && <FicheVehicule id={ouvert} onClose={() => setOuvert(null)} onChange={charger} />}
    </div>
  );
}

function Missions({ parc, onChange, onErreur }: { parc: ParcVehicules; onChange: () => void; onErreur: (m: string | null) => void }) {
  const [retour, setRetour] = useState<MissionVehicule | null>(null);
  const enService = parc.vehicules.filter((v) => v.actif && v.etat === 'EN_SERVICE');
  const agir = (p: Promise<unknown>) => {
    onErreur(null);
    p.then(onChange).catch((x) => onErreur(messageChargement(x)));
  };
  return (
    <section aria-label="Ordres de mission à équiper" data-testid="missions-vehicules">
      <h2 className="mb-1 text-[15px] font-bold">Ordres de mission</h2>
      <p className="mb-2.5 text-[12.5px] text-text-muted">Affectez un véhicule en service ; au retour, saisissez le kilométrage du compteur.</p>
      {parc.missions.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucune mission en cours ou à venir.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {parc.missions.map((m) => (
            <li key={m.id} data-testid="mission-vehicule" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{m.objet} — {m.destination}</div>
                <div className="text-[12px] text-text-muted">
                  {nom(m.agent)} · du {dateCourte(m.dateDepart)} au {dateCourte(m.dateRetour)}
                  {m.kilometrageRetour !== null ? ` · ${(m.kilometrageRetour - (m.kilometrageDepart ?? 0)).toLocaleString('fr-FR')} km parcourus` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {m.kilometrageRetour === null ? (
                  <>
                    <select aria-label={`Véhicule de la mission ${m.objet}`} value={m.vehiculeId ?? ''} onChange={(e) => agir(affecterVehicule(m.id, e.target.value || null))} className="rounded-md border border-line bg-surface px-2 py-1.5 text-[12.5px]">
                      <option value="">— Sans véhicule —</option>
                      {parc.vehicules.filter((v) => v.id === m.vehiculeId || enService.includes(v)).map((v) => <option key={v.id} value={v.id}>{v.immatriculation}</option>)}
                    </select>
                    {m.vehiculeId && <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => setRetour(m)}>Enregistrer le retour</Button>}
                  </>
                ) : (
                  <Badge tone="sage">Retour enregistré</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {retour && <FenetreRetour mission={retour} onClose={() => setRetour(null)} onFait={() => (setRetour(null), onChange())} />}
    </section>
  );
}

function FenetreRetour({ mission, onClose, onFait }: { mission: MissionVehicule; onClose: () => void; onFait: () => void }) {
  const [k, setK] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <Fenetre
      titre={`Retour de mission — ${mission.objet}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Enregistrer le retour"
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await retourMission(mission.id, Number(k));
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <p className="mb-3 text-[12.5px] text-text-muted">Kilométrage au départ : {km(mission.kilometrageDepart)}.</p>
      <label className="block text-[12.5px] font-semibold">Kilométrage au retour<input type="number" required min={0} value={k} onChange={(e) => setK(e.target.value)} className={champ} /></label>
    </Fenetre>
  );
}

function FenetreVehicule({ onClose, onFait }: { onClose: () => void; onFait: () => void }) {
  const [v, setV] = useState({ immatriculation: '', marque: '', modele: '', energie: 'GAZOLE', kilometrage: '0' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Fenetre
      titre="Nouveau véhicule"
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Ajouter le véhicule"
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await creerVehicule({ ...v, immatriculation: v.immatriculation.toUpperCase(), kilometrage: Number(v.kilometrage) });
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">Immatriculation<input required value={v.immatriculation} onChange={set('immatriculation')} className={champ} /></label>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[12.5px] font-semibold">Marque<input required value={v.marque} onChange={set('marque')} className={champ} /></label>
        <label className="block text-[12.5px] font-semibold">Modèle<input required value={v.modele} onChange={set('modele')} className={champ} /></label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[12.5px] font-semibold">Énergie
          <select value={v.energie} onChange={set('energie')} className={champ}><option value="GAZOLE">Gazole</option><option value="ESSENCE">Essence</option></select>
        </label>
        <label className="block text-[12.5px] font-semibold">Kilométrage du compteur<input type="number" min={0} required value={v.kilometrage} onChange={set('kilometrage')} className={champ} /></label>
      </div>
    </Fenetre>
  );
}

function FicheVehicule({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const [v, setV] = useState<VehiculeDetail | null>(null);
  const [plein, setPlein] = useState({ date: aujourdhui(), litres: '', kilometrage: '', ordreMissionId: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getVehicule(id).then(setV).catch((x) => setErreur(messageChargement(x))), [id]);
  useEffect(() => {
    charger();
  }, [charger]);
  const agir = (p: Promise<unknown>) => {
    setErreur(null);
    p.then(() => (charger(), onChange())).catch((x) => setErreur(messageChargement(x)));
  };
  return (
    <Fenetre titre={v ? `${v.immatriculation} — ${v.marque} ${v.modele}` : 'Véhicule'} onClose={onClose} largeur={640}>
      <ErreurChargement message={erreur} />
      {!v ? (
        <Chargement erreur={erreur} />
      ) : (
        <div data-testid="fiche-vehicule">
          <div className="mb-3 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-3">
            <div className="rounded-md border border-line p-2.5"><div className="text-text-muted">Compteur</div><div className="text-[16px] font-bold">{km(v.kilometrage)}</div></div>
            <div className="rounded-md border border-line p-2.5"><div className="text-text-muted">Consommation</div><div className="text-[16px] font-bold">{v.consommationL100 !== null ? `${v.consommationL100} L/100 km` : '—'}</div></div>
            <div className="rounded-md border border-line p-2.5"><div className="text-text-muted">Carburant</div><div className="text-[16px] font-bold">{v.litresTotal.toLocaleString('fr-FR')} L</div></div>
          </div>
          {v.droits.gerer && (
            <label className="mb-3 block text-[12.5px] font-semibold">
              État
              <select value={v.etat} onChange={(e) => agir(modifierVehicule(v.id, { etat: e.target.value as EtatVehicule }))} className={champ}>
                {(Object.keys(LIBELLE_ETAT_VEHICULE) as EtatVehicule[]).map((x) => <option key={x} value={x}>{LIBELLE_ETAT_VEHICULE[x]}</option>)}
              </select>
            </label>
          )}
          <h3 className="mb-1.5 text-[13.5px] font-bold">Pleins de carburant</h3>
          {v.pleins.length === 0 ? <p className="mb-3 text-[12.5px] text-text-muted">Aucun plein enregistré.</p> : (
            <table className="mb-3 w-full text-[12.5px]">
              <thead><tr className="text-left text-text-muted"><th className="py-1">Date</th><th>Litres</th><th>Compteur</th><th>Mission</th></tr></thead>
              <tbody>{v.pleins.map((p) => <tr key={p.id} className="border-t border-line"><td className="py-1">{dateCourte(p.date)}</td><td>{p.litres.toLocaleString('fr-FR')}</td><td>{km(p.kilometrage)}</td><td>{p.ordreMission?.objet ?? '—'}</td></tr>)}</tbody>
            </table>
          )}
          {v.droits.gerer && (
            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                agir(ajouterPlein(v.id, { date: plein.date, litres: Number(plein.litres), kilometrage: Number(plein.kilometrage), ordreMissionId: plein.ordreMissionId || undefined }).then(() => setPlein({ date: aujourdhui(), litres: '', kilometrage: '', ordreMissionId: '' })));
              }}
            >
              <label className="text-[12px] font-semibold">Date<input type="date" required value={plein.date} onChange={(e) => setPlein({ ...plein, date: e.target.value })} className={champ} /></label>
              <label className="text-[12px] font-semibold">Litres<input type="number" step="0.01" min={0.5} required value={plein.litres} onChange={(e) => setPlein({ ...plein, litres: e.target.value })} className={champ} /></label>
              <label className="text-[12px] font-semibold">Mission (facultatif)
                <select value={plein.ordreMissionId} onChange={(e) => setPlein({ ...plein, ordreMissionId: e.target.value })} className={champ}>
                  <option value="">—</option>
                  {v.missions.map((m) => <option key={m.id} value={m.id}>{m.objet}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-semibold">Compteur<input type="number" min={0} required value={plein.kilometrage} onChange={(e) => setPlein({ ...plein, kilometrage: e.target.value })} className={champ} /></label>
              <div className="flex items-end"><Button type="submit" variant="solid" className="w-full">Ajouter le plein</Button></div>
            </form>
          )}
        </div>
      )}
    </Fenetre>
  );
}

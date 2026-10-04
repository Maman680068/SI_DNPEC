'use client';

import { useCallback, useEffect, useState } from 'react';
import { affecterVehicule, ajouterPlein, creerVehicule, getParcVehicules, getVehicule, modifierVehicule, retourMission } from '../../lib/api/vehicules';
import type { EtatVehicule, MissionVehicule, ParcVehicules, VehiculeDetail } from '../../lib/logistique/vehicules';
import { LIBELLE_ETAT_VEHICULE } from '../../lib/logistique/vehicules';
import { Plus } from 'lucide-react';
import { BTN_LIGNE, BTN_PRINCIPAL, CleValeur, EtatVide, LigneTableau, Panneau, Pastille, SectionFenetre, type TonPastille } from '../ui/Charte';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Panneau as PanneauFiche, dateCourte, nom } from './commun';

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const TON_ETAT: Record<EtatVehicule, TonPastille> = { EN_SERVICE: 'vert', EN_PANNE: 'rouge', EN_REPARATION: 'ambre', REFORME: 'gris' };
const GRILLE_V = 'lg:grid-cols-[140px_minmax(0,1.4fr)_100px_120px_minmax(0,1fr)]';
const GRILLE_M = 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)]';
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
      <Panneau
        titre="Parc de véhicules"
        compteur={<span className="text-[13px] font-semibold text-text-muted">{parc.vehicules.length}</span>}
        action={
          g && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouveau(true)}>
              <Plus aria-hidden size={17} />
              Nouveau véhicule
            </button>
          )
        }
        className="mb-4 overflow-hidden"
      >
        {parc.vehicules.length === 0 ? (
          <EtatVide texte="Aucun véhicule enregistré." />
        ) : (
          <div role="table" aria-label="Parc de véhicules" data-testid="vehicules">
            <div role="rowgroup">
              <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-[#F7F8FB] px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE_V}`}>
                {['Immatriculation', 'Véhicule', 'Énergie', 'Compteur', 'État'].map((c) => (
                  <span key={c} role="columnheader">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {parc.vehicules.map((v) => (
                <LigneTableau key={v.id} grille={GRILLE_V} onClick={() => setOuvert(v.id)} testid="vehicule" label={`${v.immatriculation} — ${v.marque} ${v.modele}`}>
                  <span className="font-heading text-[13px] font-bold text-ink">{v.immatriculation}</span>
                  <span className="block truncate">
                    {v.marque} {v.modele}
                  </span>
                  <span className="text-[12.5px] text-text-muted">{v.energie === 'GAZOLE' ? 'Gazole' : 'Essence'}</span>
                  <span className="text-[12.5px]">{km(v.kilometrage)}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {!v.actif && <Pastille ton="gris">Retiré du parc</Pastille>}
                    <Pastille ton={TON_ETAT[v.etat]}>{LIBELLE_ETAT_VEHICULE[v.etat]}</Pastille>
                  </span>
                </LigneTableau>
              ))}
            </div>
          </div>
        )}
      </Panneau>
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
    <section aria-label="Ordres de mission à équiper" data-testid="missions-vehicules" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-[18px] py-3">
        <h2 className="font-heading text-[15.5px] font-bold text-ink-900">Ordres de mission</h2>
        <p className="text-[12.5px] text-text-muted">Affectez un véhicule en service ; au retour, saisissez le kilométrage du compteur.</p>
      </div>
      {parc.missions.length === 0 ? (
        <EtatVide texte="Aucune mission en cours ou à venir." />
      ) : (
        <div role="table" aria-label="Ordres de mission">
          <div role="rowgroup">
            <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-[#F7F8FB] px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE_M}`}>
              {['Mission', 'Agent', 'Dates', 'Véhicule'].map((c) => (
                <span key={c} role="columnheader">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div role="rowgroup">
            {parc.missions.map((m) => (
              <LigneTableau key={m.id} grille={GRILLE_M} testid="mission-vehicule">
                <span className="block font-semibold">
                  {m.objet} — {m.destination}
                </span>
                <span className="text-[12.5px]">{nom(m.agent)}</span>
                <span className="text-[12.5px] text-text-muted">
                  du {dateCourte(m.dateDepart)} au {dateCourte(m.dateRetour)}
                  {m.kilometrageRetour !== null ? <span className="block">{(m.kilometrageRetour - (m.kilometrageDepart ?? 0)).toLocaleString('fr-FR')} km parcourus</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {m.kilometrageRetour === null ? (
                    <>
                      <select aria-label={`Véhicule de la mission ${m.objet}`} value={m.vehiculeId ?? ''} onChange={(e) => agir(affecterVehicule(m.id, e.target.value || null))} className="h-[30px] max-w-full rounded-[7px] border border-line bg-surface px-2 text-[12.5px]">
                        <option value="">— Sans véhicule —</option>
                        {parc.vehicules.filter((v) => v.id === m.vehiculeId || enService.includes(v)).map((v) => <option key={v.id} value={v.id}>{v.immatriculation}</option>)}
                      </select>
                      {m.vehiculeId && (
                        <button type="button" className={BTN_LIGNE} onClick={() => setRetour(m)}>
                          Enregistrer le retour
                        </button>
                      )}
                    </>
                  ) : (
                    <Pastille ton="vert">Retour enregistré</Pastille>
                  )}
                </span>
              </LigneTableau>
            ))}
          </div>
        </div>
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
    <PanneauFiche
      titre={v ? `${v.immatriculation} — ${v.marque} ${v.modele}` : 'Véhicule'}
      filAriane={['Logistique', 'Véhicules']}
      onClose={onClose}
      testid="fenetre-vehicule"
      sousTitre={v ? <Pastille ton={TON_ETAT[v.etat]}>{LIBELLE_ETAT_VEHICULE[v.etat]}</Pastille> : undefined}
      cote={
        v ? (
          <>
            {v.droits.gerer && (
              <label className="mb-[18px] block text-[12.5px] font-semibold">
                État
                <select value={v.etat} onChange={(e) => agir(modifierVehicule(v.id, { etat: e.target.value as EtatVehicule }))} className={champ}>
                  {(Object.keys(LIBELLE_ETAT_VEHICULE) as EtatVehicule[]).map((x) => <option key={x} value={x}>{LIBELLE_ETAT_VEHICULE[x]}</option>)}
                </select>
              </label>
            )}
            <SectionFenetre titre="Informations" className="">
              <CleValeur
                largeur={100}
                lignes={[
                  ['Compteur', km(v.kilometrage)],
                  ['Consommation', v.consommationL100 !== null ? `${v.consommationL100} L/100 km` : '—'],
                  ['Carburant', `${v.litresTotal.toLocaleString('fr-FR')} L`],
                  ['Énergie', v.energie === 'GAZOLE' ? 'Gazole' : 'Essence'],
                ]}
              />
            </SectionFenetre>
          </>
        ) : undefined
      }
    >
      <ErreurChargement message={erreur} />
      {!v ? (
        <Chargement erreur={erreur} />
      ) : (
        <div data-testid="fiche-vehicule">
          <SectionFenetre titre="Pleins de carburant" n={v.pleins.length}>
            {v.pleins.length === 0 ? <p className="text-[12.5px] text-text-muted">Aucun plein enregistré.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead><tr className="text-left text-text-muted"><th className="py-1 font-semibold">Date</th><th className="font-semibold">Litres</th><th className="font-semibold">Compteur</th><th className="font-semibold">Mission</th></tr></thead>
                  <tbody>{v.pleins.map((p) => <tr key={p.id} className="border-t border-line"><td className="py-1.5">{dateCourte(p.date)}</td><td>{p.litres.toLocaleString('fr-FR')}</td><td>{km(p.kilometrage)}</td><td>{p.ordreMission?.objet ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </SectionFenetre>
          {v.droits.gerer && (
            <SectionFenetre titre="Ajouter un plein" className="">
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
                <div className="col-span-2 flex items-end sm:col-span-1"><button type="submit" className={`${BTN_PRINCIPAL} w-full`}>Ajouter le plein</button></div>
              </form>
            </SectionFenetre>
          )}
        </div>
      )}
    </PanneauFiche>
  );
}

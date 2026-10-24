'use client';

import { useCallback, useEffect, useState } from 'react';
import { affecterVehicule, ajouterPlein, creerVehicule, getParcVehicules, getVehicule, modifierVehicule, retourMission } from '../../lib/api/vehicules';
import type { EtatVehicule, MissionVehicule, ParcVehicules, VehiculeDetail } from '../../lib/logistique/vehicules';
import { LIBELLE_ETAT_VEHICULE } from '../../lib/logistique/vehicules';
import { Fuel, Plus } from 'lucide-react';
import { BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, EtatVide, LigneTableau, Panneau, Pastille, SectionFenetre, type TonPastille } from '../ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { jourLocal, useEnvoi } from '../courrier/formulaire';
import { Panneau as PanneauFiche, dateCourte, nom } from './commun';

const champ = 'mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px]';
const TON_ETAT: Record<EtatVehicule, TonPastille> = { EN_SERVICE: 'vert', EN_PANNE: 'rouge', EN_REPARATION: 'ambre', REFORME: 'gris' };
const GRILLE_V = 'lg:grid-cols-[140px_minmax(0,1.4fr)_100px_120px_minmax(0,1fr)]';
const GRILLE_M = 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)]';
const km = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} km`);
const entier = (v: string, min: number) => Number.isInteger(Number(v)) && Number(v) >= min;
/** Litres saisis à la française (virgule) ou au point ; NaN si illisible. */
const litres = (v: string) => (/^\d+([.,]\d{1,2})?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : NaN);

/** Véhicules de service, missions et carburant (socle N6, SIG-RF-LOG-03). */
export function OngletVehicules() {
  const toast = useToast();
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
              <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-fond-doux px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE_V}`}>
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
      {g && <Missions parc={parc} onChange={charger} />}
      {nouveau && (
        <FenetreVehicule
          onClose={() => setNouveau(false)}
          onFait={(immatriculation) => {
            setNouveau(false);
            toast.succes('Véhicule ajouté au parc', { detail: immatriculation });
            charger();
          }}
        />
      )}
      {ouvert && <FicheVehicule id={ouvert} onClose={() => setOuvert(null)} onChange={charger} />}
    </div>
  );
}

function Missions({ parc, onChange }: { parc: ParcVehicules; onChange: () => void }) {
  const toast = useToast();
  const [retour, setRetour] = useState<MissionVehicule | null>(null);
  const enService = parc.vehicules.filter((v) => v.actif && v.etat === 'EN_SERVICE');
  const immat = (id: string | null) => parc.vehicules.find((v) => v.id === id)?.immatriculation ?? '';
  /** Affectation (ou retrait) du véhicule ; « Annuler » remet le véhicule précédent par la même route. */
  const affecter = async (m: MissionVehicule, vehiculeId: string | null, precedent: string | null, annulable = true) => {
    try {
      await affecterVehicule(m.id, vehiculeId);
      onChange();
      toast.succes(vehiculeId ? 'Véhicule affecté' : 'Véhicule retiré de la mission', {
        detail: vehiculeId ? `${immat(vehiculeId)} pour « ${m.objet} ».` : `« ${m.objet} » part sans véhicule de service.`,
        annuler: annulable ? () => affecter(m, precedent, vehiculeId, false) : undefined,
      });
    } catch (x) {
      toast.erreur('Affectation impossible', messageErreur(x));
    }
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
            <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-fond-doux px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE_M}`}>
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
                      <select aria-label={`Véhicule de la mission ${m.objet}`} value={m.vehiculeId ?? ''} onChange={(e) => void affecter(m, e.target.value || null, m.vehiculeId)} className="h-[30px] max-w-full rounded-[7px] border border-line bg-surface px-2 text-[12.5px]">
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
      {retour && (
        <FenetreRetour
          mission={retour}
          onClose={() => setRetour(null)}
          onFait={(distance) => {
            setRetour(null);
            toast.succes('Retour de mission enregistré', { detail: `${distance.toLocaleString('fr-FR')} km parcourus.` });
            onChange();
          }}
        />
      )}
    </section>
  );
}

function FenetreRetour({ mission, onClose, onFait }: { mission: MissionVehicule; onClose: () => void; onFait: (distance: number) => void }) {
  const [k, setK] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={`Retour de mission — ${mission.objet}`}
      sousTitre={`Kilométrage au départ : ${km(mission.kilometrageDepart)}.`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      largeur={540}
      libelleValider="Enregistrer le retour"
      pied="Le compteur du véhicule ne recule jamais."
      valider={() =>
        k && !entier(k, 0)
          ? { 'retour-km': 'Indiquez un nombre entier de kilomètres.' }
          : k && mission.kilometrageDepart !== null && Number(k) < mission.kilometrageDepart
            ? { 'retour-km': `Le compteur ne peut pas être inférieur au départ (${km(mission.kilometrageDepart)}).` }
            : {}
      }
      onSubmit={async () => {
        const r = await envoyer(() => retourMission(mission.id, Number(k)));
        if (r.ok) onFait(r.valeur.distance);
      }}
    >
      <Saisie id="retour-km" label="Kilométrage au retour" type="number" min={0} value={k} onChange={setK} required messageObligatoire="Indiquez le kilométrage du compteur au retour." />
    </FenetreFormulaire>
  );
}

function FenetreVehicule({ onClose, onFait }: { onClose: () => void; onFait: (immatriculation: string) => void }) {
  const [v, setV] = useState({ immatriculation: '', marque: '', modele: '', energie: 'GAZOLE' as 'GAZOLE' | 'ESSENCE', kilometrage: '0' });
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Nouveau véhicule"
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      largeur={640}
      libelleValider="Ajouter le véhicule"
      pied="Le véhicule entre au parc « En service » ; le carburant se suit en litres."
      valider={() => (v.kilometrage && !entier(v.kilometrage, 0) ? { 'veh-km': 'Indiquez un nombre entier de kilomètres.' } : {})}
      onSubmit={async () => {
        const immatriculation = v.immatriculation.trim().toUpperCase();
        const r = await envoyer(() => creerVehicule({ ...v, immatriculation, marque: v.marque.trim(), modele: v.modele.trim(), kilometrage: Number(v.kilometrage) }));
        if (r.ok) onFait(immatriculation);
      }}
    >
      <Saisie id="veh-immat" label="Immatriculation" value={v.immatriculation} onChange={(immatriculation) => setV({ ...v, immatriculation })} required maxLength={20} messageObligatoire="Indiquez l’immatriculation." placeholder="RC-1234-A" />
      <Grille2>
        <Saisie id="veh-marque" label="Marque" value={v.marque} onChange={(marque) => setV({ ...v, marque })} required maxLength={60} messageObligatoire="Indiquez la marque." />
        <Saisie id="veh-modele" label="Modèle" value={v.modele} onChange={(modele) => setV({ ...v, modele })} required maxLength={60} messageObligatoire="Indiquez le modèle." />
        <ChoixSegment<'GAZOLE' | 'ESSENCE'>
          id="veh-energie"
          label="Énergie"
          value={v.energie}
          onChange={(energie) => setV({ ...v, energie })}
          options={[
            { value: 'GAZOLE', label: 'Gazole' },
            { value: 'ESSENCE', label: 'Essence' },
          ]}
        />
        <Saisie id="veh-km" label="Kilométrage du compteur" type="number" min={0} value={v.kilometrage} onChange={(kilometrage) => setV({ ...v, kilometrage })} required />
      </Grille2>
    </FenetreFormulaire>
  );
}

/** Plein de carburant : litres seulement (aucun montant), compteur qui ne recule jamais. */
function FenetrePlein({ vehicule, onClose, onFait }: { vehicule: VehiculeDetail; onClose: () => void; onFait: (litres: number) => void }) {
  const [plein, setPlein] = useState({ date: jourLocal(0), litres: '', kilometrage: '', ordreMissionId: '' });
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={`Ajouter un plein — ${vehicule.immatriculation}`}
      sousTitre={`Compteur actuel : ${km(vehicule.kilometrage)}.`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      largeur={640}
      libelleValider="Ajouter le plein"
      pied="Carburant en litres seulement ; le compteur ne recule jamais."
      valider={() => ({
        ...(plein.litres && !(litres(plein.litres) >= 0.5) ? { 'plein-litres': 'Indiquez un nombre de litres (0,5 au moins), par exemple 42,5.' } : {}),
        ...(plein.kilometrage && !entier(plein.kilometrage, 0)
          ? { 'plein-km': 'Indiquez un nombre entier de kilomètres.' }
          : plein.kilometrage && vehicule.kilometrage !== null && Number(plein.kilometrage) < vehicule.kilometrage
            ? { 'plein-km': `Le compteur ne peut pas être inférieur à ${km(vehicule.kilometrage)}.` }
            : {}),
      })}
      onSubmit={async () => {
        const r = await envoyer(() => ajouterPlein(vehicule.id, { date: plein.date, litres: litres(plein.litres), kilometrage: Number(plein.kilometrage), ordreMissionId: plein.ordreMissionId || undefined }));
        if (r.ok) onFait(litres(plein.litres));
      }}
    >
      <Grille2>
        <ChampDate id="plein-date" label="Date" value={plein.date} max={jourLocal(0)} onChange={(date) => setPlein({ ...plein, date })} required messageObligatoire="Indiquez la date du plein." />
        <Saisie id="plein-litres" label="Litres" placeholder="42,5" value={plein.litres} onChange={(litres) => setPlein({ ...plein, litres })} required messageObligatoire="Indiquez le nombre de litres." />
        <Saisie id="plein-km" label="Compteur (km)" type="number" min={0} value={plein.kilometrage} onChange={(kilometrage) => setPlein({ ...plein, kilometrage })} required messageObligatoire="Indiquez le kilométrage du compteur." />
        <Liste id="plein-mission" label="Mission" facultatif value={plein.ordreMissionId} onChange={(ordreMissionId) => setPlein({ ...plein, ordreMissionId })} vide="Aucune" options={vehicule.missions.map((m) => ({ value: m.id, label: `${m.objet} — ${m.destination}` }))} />
      </Grille2>
    </FenetreFormulaire>
  );
}

function FicheVehicule({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const toast = useToast();
  const [v, setV] = useState<VehiculeDetail | null>(null);
  const [plein, setPlein] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getVehicule(id).then(setV).catch((x) => setErreur(messageChargement(x))), [id]);
  useEffect(() => {
    charger();
  }, [charger]);
  /** Changement d'état ; « Annuler » remet l'état précédent par la même route. */
  const changerEtat = async (etat: EtatVehicule, precedent: EtatVehicule, annulable = true) => {
    if (!v) return;
    try {
      await modifierVehicule(v.id, { etat });
      charger();
      onChange();
      toast.succes('État du véhicule enregistré', {
        detail: `${v.immatriculation} : ${LIBELLE_ETAT_VEHICULE[etat]}.`,
        annuler: annulable ? () => changerEtat(precedent, etat, false) : undefined,
      });
    } catch (x) {
      toast.erreur('Changement impossible', messageErreur(x));
    }
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
                <select value={v.etat} onChange={(e) => void changerEtat(e.target.value as EtatVehicule, v.etat)} className={champ}>
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
            <button type="button" className={BTN_SECONDAIRE} onClick={() => setPlein(true)}>
              <Fuel aria-hidden size={16} /> Ajouter un plein
            </button>
          )}
          {plein && (
            <FenetrePlein
              vehicule={v}
              onClose={() => setPlein(false)}
              onFait={(litres) => {
                setPlein(false);
                toast.succes('Plein enregistré', { detail: `${litres.toLocaleString('fr-FR')} L pour ${v.immatriculation}.` });
                charger();
                onChange();
              }}
            />
          )}
        </div>
      )}
    </PanneauFiche>
  );
}

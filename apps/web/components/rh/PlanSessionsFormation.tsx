'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { creerSessionFormation, etatSessionFormation, getSessionsFormation } from '../../lib/api/rh';
import type { EtatSessionFormation, PlanSessions, SessionFormation } from '../../lib/rh/types';
import { LIBELLE_ETAT_SESSION } from '../../lib/rh/types';
import { BarreOutils, BTN_LIGNE, BTN_PRINCIPAL, EtatVide, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { Case, ChampDate, FenetreFormulaire, Grille2, Liste, Saisie } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const GRILLE = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_90px_110px_minmax(0,1fr)]';
const TON_ETAT: Record<EtatSessionFormation, 'ambre' | 'encre' | 'vert' | 'gris'> = { SOUHAITEE: 'ambre', PLANIFIEE: 'encre', SUIVIE: 'vert', ANNULEE: 'gris' };
const dateCourte = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function periodeSession(s: SessionFormation) {
  return s.dateFin && s.dateFin !== s.dateDebut ? `${dateCourte(s.dateDebut)} → ${dateCourte(s.dateFin)}` : dateCourte(s.dateDebut);
}

export type BesoinAPlanifier = { id: string; intitule: string };

/**
 * Plan de formation individuel : sessions par agent (docs/conception_plan_formation.md). Lecture pour le
 * DRH, la Direction et le chef le plus proche ; création et suivi par le DRH seul (droits donnés par l'API).
 */
export function PlanSessionsFormation({ aPlanifier, onPlanifie }: { aPlanifier: BesoinAPlanifier | null; onPlanifie: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<PlanSessions | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState<BesoinAPlanifier | null | false>(false);
  const charger = useCallback(() => getSessionsFormation().then(setP).catch((x) => setErreur(messageChargement(x))), []);
  useEffect(() => {
    charger();
  }, [charger]);
  // Besoin retenu à l'instant : la liste des besoins proposés est relue avant d'ouvrir la fenêtre.
  useEffect(() => {
    if (aPlanifier) charger().then(() => setNouvelle(aPlanifier));
  }, [aPlanifier, charger]);
  if (!p) return <ErreurChargement message={erreur} />;
  const agir = (s: SessionFormation, action: 'planifier' | 'suivie' | 'annuler', libelle: string) =>
    etatSessionFormation(s.id, action)
      .then(() => {
        charger();
        toast.succes(libelle, { detail: `${s.intitule} · ${s.agent.nom}` });
      })
      .catch((x) => toast.erreur('Action impossible', messageErreur(x)));
  return (
    <section className="mb-6" aria-label="Plan de formation">
      <BarreOutils
        droite={
          p.droits.creer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouvelle(null)}>
              <CalendarPlus aria-hidden size={16} /> Planifier une formation
            </button>
          )
        }
      >
        <h2 className="text-[15px] font-bold text-ink-900">Plan de formation</h2>
      </BarreOutils>
      <Tableau
        label="Plan de formation"
        testid="plan-sessions-formation"
        grille={GRILLE}
        colonnes={['Formation', 'Agent', 'Période', 'Durée', 'État', '']}
        vide={<EtatVide texte="Aucune session de formation au plan." />}
      >
        {p.sessions.map((s) => (
          <LigneTableau key={s.id} grille={GRILLE} testid="session-formation">
            <span className="block">
              <b className="block font-semibold text-ink-900">{s.intitule}</b>
              <small className="block text-[12px] text-text-muted">{[s.organisme, s.besoin ? `besoin : ${s.besoin.intitule}` : null].filter(Boolean).join(' · ') || '—'}</small>
            </span>
            <span className="block truncate">{s.agent.nom}</span>
            <span className="text-text-muted">{periodeSession(s)}</span>
            <span className="text-text-muted">{s.dureeJours ? `${s.dureeJours} j` : '—'}</span>
            <Pastille ton={TON_ETAT[s.etat]}>{LIBELLE_ETAT_SESSION[s.etat]}</Pastille>
            <span className="flex flex-wrap justify-end gap-1.5">
              {s.droits.planifier && <button type="button" className={BTN_LIGNE} onClick={() => agir(s, 'planifier', 'Formation planifiée')}>Planifier</button>}
              {s.droits.marquerSuivie && <button type="button" className={BTN_LIGNE} onClick={() => agir(s, 'suivie', 'Formation marquée suivie')}>Marquer suivie</button>}
              {s.droits.annuler && <button type="button" className={BTN_LIGNE} onClick={() => agir(s, 'annuler', 'Formation annulée')}>Annuler</button>}
            </span>
          </LigneTableau>
        ))}
      </Tableau>
      {nouvelle !== false && (
        <FenetreSession
          plan={p}
          besoin={nouvelle}
          onClose={() => setNouvelle(false)}
          onFait={(s) => {
            setNouvelle(false);
            charger();
            onPlanifie();
            toast.succes(s.etat === 'PLANIFIEE' ? 'Formation planifiée' : 'Formation ajoutée au plan', { detail: `${s.intitule} · ${s.agent.nom}` });
          }}
        />
      )}
    </section>
  );
}

function FenetreSession({ plan, besoin, onClose, onFait }: { plan: PlanSessions; besoin: BesoinAPlanifier | null; onClose: () => void; onFait: (s: SessionFormation) => void }) {
  const [v, setV] = useState({ intitule: besoin?.intitule ?? '', agentId: '', besoinId: besoin?.id ?? '', dateDebut: '', dateFin: '', dureeJours: '', organisme: '' });
  const [planifier, setPlanifier] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <FenetreFormulaire
      titre="Planifier une formation"
      sousTitre={besoin ? `À partir du besoin retenu « ${besoin.intitule} »` : 'Plan de formation individuel'}
      onClose={onClose}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      libelleValider={planifier ? 'Planifier' : 'Ajouter au plan'}
      pied="L’agent et son chef le plus proche sont prévenus avant le début d’une session planifiée."
      onSubmit={async () => {
        if (!v.dateFin && !v.dureeJours) return setErreur('Indiquez la date de fin ou la durée.');
        setEnCours(true);
        setErreur(null);
        try {
          onFait(
            await creerSessionFormation({
              intitule: v.intitule.trim(),
              agentId: v.agentId,
              besoinId: v.besoinId || undefined,
              dateDebut: v.dateDebut,
              dateFin: v.dateFin || undefined,
              dureeJours: v.dureeJours ? Number(v.dureeJours) : undefined,
              organisme: v.organisme.trim() || undefined,
              planifier,
            }),
          );
        } catch (x) {
          setErreur(messageErreur(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Saisie id="sf-intitule" label="Intitulé de la formation" required value={v.intitule} onChange={set('intitule')} />
      <Liste id="sf-agent" label="Agent" required value={v.agentId} onChange={set('agentId')} vide="Choisir l’agent" options={plan.agentsPossibles.map((a) => ({ value: a.id, label: a.nom }))} />
      <Liste
        id="sf-besoin"
        label="Besoin d’origine"
        facultatif
        value={v.besoinId}
        onChange={set('besoinId')}
        vide="Aucun"
        options={plan.besoinsRetenus.map((b) => ({ value: b.id, label: `${b.intitule} (${b.annee})` }))}
      />
      <Grille2>
        <ChampDate id="sf-debut" label="Date de début" required value={v.dateDebut} onChange={set('dateDebut')} raccourcis={false} />
        <ChampDate id="sf-fin" label="Date de fin" facultatif value={v.dateFin} onChange={set('dateFin')} min={v.dateDebut || undefined} raccourcis={false} />
      </Grille2>
      <Grille2>
        <Saisie id="sf-duree" label="Durée (jours)" type="number" min={1} max={365} facultatif value={v.dureeJours} onChange={set('dureeJours')} aide="Si la date de fin n’est pas connue." />
        <Saisie id="sf-organisme" label="Organisme" facultatif value={v.organisme} onChange={set('organisme')} />
      </Grille2>
      <Case id="sf-planifier" label="Session planifiée (dates arrêtées)" checked={planifier} onChange={setPlanifier} />
    </FenetreFormulaire>
  );
}

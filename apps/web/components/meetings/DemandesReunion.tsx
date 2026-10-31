'use client';

import { useEffect, useState } from 'react';
import { accepterDemandeReunion, demanderReunion, getParticipantsPossibles, refuserDemandeReunion, transmettreDemandeReunion } from '../../lib/api/meetings';
import type { DemandeReunion, ParticipantsPossibles } from '../../lib/meetings/types';
import { LIBELLE_ETAPE_DEMANDE, LIBELLE_ETAT_DEMANDE } from '../../lib/meetings/types';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, EtatVide, Pastille, type TonPastille } from '../ui/Charte';
import { ChampDate, FenetreFormulaire, Grille2, Saisie, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { SelecteurParticipants } from './SelecteurParticipants';

const TON_ETAT: Record<DemandeReunion['etat'], TonPastille> = { EN_ATTENTE: 'ambre', ACCEPTEE: 'vert', REFUSEE: 'rouge', UTILISEE: 'gris', EXPIREE: 'gris' };
const deux = (n: number) => String(n).padStart(2, '0');
const jourDe = (d: Date) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
const heureDe = (d: Date) => `${deux(d.getHours())}:${deux(d.getMinutes())}`;
const instant = (jour: string, heure: string) => (jour && /^\d{2}:\d{2}$/.test(heure) ? new Date(`${jour}T${heure}`) : null);
export const quandDemande = (d: { debut: string; fin: string }) =>
  `${new Date(d.debut).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}, ${heureDe(new Date(d.debut))} – ${heureDe(new Date(d.fin))}`;

function useParticipantsPossibles() {
  const [p, setP] = useState<ParticipantsPossibles | null>(null);
  useEffect(() => {
    getParticipantsPossibles()
      .then(setP)
      .catch(() => setP({ personnes: [], unites: [] }));
  }, []);
  return p;
}

/** Champs communs : date, heures, participants (demande, ou acceptation avec modification). */
function ChampsCreneau({ v, set, possibles }: { v: { jour: string; debut: string; fin: string; participants: string[]; unites: string[] }; set: (k: string, x: unknown) => void; possibles: ParticipantsPossibles | null }) {
  return (
    <>
      <Grille2>
        <ChampDate id="dr-date" label="Date proposée" value={v.jour} onChange={(x) => set('jour', x)} required messageObligatoire="Choisissez la date." />
        <Grille2>
          <Saisie id="dr-debut" label="Début" type="time" value={v.debut} onChange={(x) => set('debut', x)} required messageObligatoire="Indiquez l’heure de début." />
          <Saisie id="dr-fin" label="Fin" type="time" value={v.fin} onChange={(x) => set('fin', x)} required messageObligatoire="Indiquez l’heure de fin." />
        </Grille2>
      </Grille2>
      <SelecteurParticipants possibles={possibles} valeurs={v.participants} onChange={(x) => set('participants', x)} unitesChoisies={v.unites} onUnites={(x) => set('unites', x)} />
    </>
  );
}

/** « Demander une réunion » (chargé d'études) : objet, courte explication, créneau, participants proposés. */
export function DemanderReunionModal({ onClose, onFait }: { onClose: () => void; onFait: (d: DemandeReunion) => void }) {
  const toast = useToast();
  const possibles = useParticipantsPossibles();
  const [v, setV] = useState({ objet: '', explication: '', jour: '', debut: '', fin: '', participants: [] as string[], unites: [] as string[] });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const set = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  return (
    <FenetreFormulaire
      titre="Demander une réunion"
      sousTitre="Votre chef décide : il peut accepter (en ajustant la date et les participants), refuser ou transmettre."
      onClose={onClose}
      testid="fenetre-demande-reunion"
      enCours={enCours}
      erreur={erreur}
      libelleValider="Envoyer la demande"
      pied="Une fois la demande acceptée, vous recevez une notification « Créer la réunion »."
      valider={() => (v.debut && v.fin && v.fin <= v.debut ? { 'dr-fin': 'L’heure de fin doit suivre l’heure de début.' } : {})}
      onSubmit={async () => {
        const debut = instant(v.jour, v.debut);
        const fin = instant(v.jour, v.fin);
        if (!debut || !fin) return;
        setEnCours(true);
        setErreur(null);
        try {
          const d = await demanderReunion({ objet: v.objet.trim(), explication: v.explication.trim(), debut: debut.toISOString(), fin: fin.toISOString(), participantIds: v.participants, uniteIds: v.unites });
          toast.succes('Demande envoyée', { detail: `À ${d.decideurs.join(' ou ')}.` });
          onFait(d);
        } catch (x) {
          setErreur(messageErreur(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <Saisie id="dr-objet" label="Objet" value={v.objet} onChange={(x) => set('objet', x)} required maxLength={300} messageObligatoire="Indiquez l’objet de la réunion." />
      <ZoneTexte id="dr-explication" label="Courte explication" value={v.explication} onChange={(x) => set('explication', x)} required lignes={3} maxLength={2000} messageObligatoire="Expliquez en quelques mots pourquoi cette réunion." />
      <ChampsCreneau v={v} set={set} possibles={possibles} />
    </FenetreFormulaire>
  );
}

/** Décision d'un chef : accepter (date et participants modifiables), refuser (motif), transmettre. */
export function FenetreDemande({ demande, onClose, onChange, onCreer }: { demande: DemandeReunion; onClose: () => void; onChange: () => void; onCreer: (d: DemandeReunion) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'voir' | 'accepter' | 'refuser'>('voir');
  const possibles = useParticipantsPossibles();
  const [v, setV] = useState({ jour: jourDe(new Date(demande.debut)), debut: heureDe(new Date(demande.debut)), fin: heureDe(new Date(demande.fin)), participants: demande.participants.map((p) => p.id), unites: demande.unites.map((u) => u.id) });
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const set = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  const d = demande;
  const fait = (titre: string, detail: string) => {
    toast.succes(titre, { detail });
    onChange();
    onClose();
  };
  const agir = async (f: () => Promise<unknown>, titre: string, detail: string) => {
    setEnCours(true);
    setErreur(null);
    try {
      await f();
      fait(titre, detail);
    } catch (x) {
      setErreur(messageErreur(x));
    } finally {
      setEnCours(false);
    }
  };
  if (mode === 'refuser')
    return (
      <FenetreFormulaire titre="Refuser la demande" sousTitre={d.objet} onClose={onClose} enCours={enCours} erreur={erreur} libelleValider="Refuser la demande" pied="Le motif est visible du demandeur." testid="fenetre-refus-demande" onSubmit={() => agir(() => refuserDemandeReunion(d.id, motif.trim()), 'Demande refusée', `${d.demandeur.nom} est prévenu(e).`)}>
        <ZoneTexte id="dr-motif" label="Motif du refus" value={motif} onChange={setMotif} required lignes={3} messageObligatoire="Indiquez le motif du refus." />
      </FenetreFormulaire>
    );
  if (mode === 'accepter')
    return (
      <FenetreFormulaire
        titre="Accepter la demande"
        sousTitre={`${d.objet} · demandée par ${d.demandeur.nom}`}
        onClose={onClose}
        enCours={enCours}
        erreur={erreur}
        libelleValider="Accepter"
        pied="Le demandeur reçoit « Créer la réunion » : la date et les participants validés y seront verrouillés."
        testid="fenetre-accepter-demande"
        valider={() => (v.fin <= v.debut ? { 'dr-fin': 'L’heure de fin doit suivre l’heure de début.' } : {})}
        onSubmit={() => {
          const debut = instant(v.jour, v.debut);
          const fin = instant(v.jour, v.fin);
          if (!debut || !fin) return;
          return agir(() => accepterDemandeReunion(d.id, { debut: debut.toISOString(), fin: fin.toISOString(), participantIds: v.participants, uniteIds: v.unites }), 'Demande acceptée', `${d.demandeur.nom} peut créer la réunion.`);
        }}
      >
        <ChampsCreneau v={v} set={set} possibles={possibles} />
      </FenetreFormulaire>
    );
  return (
    <FenetreFormulaire titre="Demande de réunion" sousTitre={d.objet} onClose={onClose} enCours={enCours} erreur={erreur} testid="fenetre-demande" sansPied>
      <div className="space-y-3 text-[13.5px]" data-testid="detail-demande">
        <p>
          <Pastille ton={TON_ETAT[d.etat]}>{LIBELLE_ETAT_DEMANDE[d.etat]}</Pastille>
        </p>
        <p className="whitespace-pre-wrap text-text">{d.explication}</p>
        <p>
          <b>Demandée par</b> {d.demandeur.nom} · <b>Créneau</b> {quandDemande(d)}
        </p>
        <p>
          <b>Participants</b> {d.participants.length ? d.participants.map((p) => p.nom).join(', ') : 'aucun autre'}
          {d.unites.length > 0 && <span className="text-text-muted"> (unités : {d.unites.map((u) => u.code).join(', ')})</span>}
        </p>
        {d.etat === 'EN_ATTENTE' && <p className="text-text-muted">À décider par : {d.decideurs.join(' ou ')}</p>}
        {d.motifRefus && (
          <p className="rounded-md bg-clay-soft px-3 py-2 text-clay" data-testid="motif-refus">
            Motif du refus : {d.motifRefus}
          </p>
        )}
        <ol className="space-y-1 border-l-2 border-line pl-3 text-[12.5px] text-text-muted" data-testid="etapes-demande">
          {d.etapes.map((e, i) => (
            <li key={i}>
              {new Date(e.le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — {LIBELLE_ETAPE_DEMANDE[e.action] ?? e.action}
              {e.par ? ` par ${e.par}` : ''}
              {e.action !== 'REUNION_CREEE' && e.vers.length ? ` → ${e.vers.join(', ')}` : ''}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 pt-1">
          {d.droits.accepter && (
            <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setMode('accepter')}>
              Accepter
            </button>
          )}
          {d.droits.refuser && (
            <button type="button" className={BTN_LIGNE} onClick={() => setMode('refuser')}>
              Refuser
            </button>
          )}
          {d.droits.transmettre && (
            <button type="button" className={BTN_LIGNE} disabled={enCours} onClick={() => agir(() => transmettreDemandeReunion(d.id), 'Demande transmise', 'Votre propre chef en décidera.')}>
              Transmettre à mon chef
            </button>
          )}
          {d.droits.creerReunion && (
            <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => onCreer(d)}>
              Créer la réunion
            </button>
          )}
        </div>
      </div>
    </FenetreFormulaire>
  );
}

/** Panneau « Demandes de réunion » : à décider (chef) et mes demandes (où elles en sont). */
export function PanneauDemandes({ aDecider, miennes, onOuvrir }: { aDecider: DemandeReunion[]; miennes: DemandeReunion[]; onOuvrir: (d: DemandeReunion) => void }) {
  if (!aDecider.length && !miennes.length) return null;
  const ligne = (d: DemandeReunion, qui: string) => (
    <li key={d.id} className="flex flex-wrap items-center gap-2.5 border-t border-line-doux px-4 py-2.5 first:border-t-0" data-testid="demande-reunion">
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px] font-semibold text-ink-900">{d.objet}</b>
        <small className="block truncate text-[12px] text-text-muted">
          {quandDemande(d)} · {qui}
        </small>
      </span>
      <Pastille ton={TON_ETAT[d.etat]}>{LIBELLE_ETAT_DEMANDE[d.etat]}</Pastille>
      <button type="button" className={d.droits.accepter || d.droits.creerReunion ? BTN_LIGNE_PRINCIPAL : BTN_LIGNE} onClick={() => onOuvrir(d)}>
        {d.droits.accepter ? 'Décider' : d.droits.creerReunion ? 'Créer la réunion' : 'Voir'}
      </button>
    </li>
  );
  return (
    <section id="demandes-reunion" aria-label="Demandes de réunion" data-testid="panneau-demandes" className="mb-4 scroll-mt-4 rounded-xl border border-line bg-surface">
      {aDecider.length > 0 && (
        <>
          <h2 className="px-4 pb-1 pt-3.5 font-heading text-[15.5px] font-bold text-ink-900">Demandes de réunion à décider ({aDecider.length})</h2>
          <ul data-testid="demandes-a-decider">{aDecider.map((d) => ligne(d, `demandée par ${d.demandeur.nom}`))}</ul>
        </>
      )}
      {miennes.length > 0 && (
        <>
          <h2 className="px-4 pb-1 pt-3.5 font-heading text-[15.5px] font-bold text-ink-900">Mes demandes de réunion</h2>
          <ul data-testid="mes-demandes">{miennes.slice(0, 8).map((d) => ligne(d, d.etat === 'EN_ATTENTE' ? `chez ${d.decideurs.join(' ou ')}` : d.decidePar ? `par ${d.decidePar}` : ''))}</ul>
        </>
      )}
      {!aDecider.length && !miennes.length && <EtatVide texte="Aucune demande de réunion." />}
    </section>
  );
}

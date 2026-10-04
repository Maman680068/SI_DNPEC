'use client';

import { useEffect, useState } from 'react';
import { createLeaveRequest, simulerConge } from '../../lib/api/leaves';
import type { LeaveRequest, LeaveType, SimulationConge } from '../../lib/leaves/types';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';
import { dateLongue } from './format';

/** Délai avant la simulation, pour ne pas appeler l'API à chaque frappe. */
const DELAI_SIMULATION = 350;

/** « Avis de Fatoumata Camara attendu sous 48 h ouvrées, puis décision du DRH. » (avis tiré de l'API). */
export function phraseAvis(s: Pick<SimulationConge, 'avisants' | 'delaiAvisHeures'> | null): string {
  if (!s) return 'Votre chef le plus proche donne son avis, puis le DRH décide.';
  if (s.avisants.length === 0) return 'Votre demande est transmise pour décision.';
  const noms = s.avisants.map((a) => a.nom);
  const qui = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(', ')} ou ${noms[noms.length - 1]}`;
  return `Avis de ${qui} attendu sous ${s.delaiAvisHeures} h ouvrées, puis décision du DRH.`;
}

/**
 * « Demander un congé » (refonte, étape 9, maquette `apres-form-conge`) : type en un clic, Du / Au
 * (inclus), bandeau vert calculé par l'API pendant la saisie (jours décomptés, jours fériés, reprise,
 * solde après la demande), motif ; en pied, le chef qui donnera l'avis et son délai.
 */
export function CreateLeaveRequestModal({
  leaveTypes,
  onClose,
  onCreated,
}: {
  leaveTypes: LeaveType[];
  onClose: () => void;
  onCreated: (request: LeaveRequest, simulation: SimulationConge | null) => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationConge | null>(null);
  const [erreurSimulation, setErreurSimulation] = useState<string | null>(null);
  const [calcul, setCalcul] = useState(false);

  // Type choisi par défaut quand la liste arrive après l'ouverture.
  useEffect(() => {
    if (!leaveTypeId && leaveTypes[0]) setLeaveTypeId(leaveTypes[0].id);
  }, [leaveTypes, leaveTypeId]);

  // Bandeau calculé pendant la saisie (même règle que la création, par l'API).
  useEffect(() => {
    setErreurSimulation(null);
    if (!leaveTypeId || !startDate || !endDate || endDate < startDate) {
      setSimulation(null);
      setCalcul(false);
      return;
    }
    let actuel = true;
    setCalcul(true);
    const minuteur = setTimeout(() => {
      simulerConge(leaveTypeId, startDate, endDate)
        .then((s) => actuel && setSimulation(s))
        .catch((err) => {
          if (!actuel) return;
          setSimulation(null);
          setErreurSimulation(messageErreur(err, 'Le décompte n’a pas pu être calculé. Vous pouvez tout de même envoyer la demande.'));
        })
        .finally(() => actuel && setCalcul(false));
    }, DELAI_SIMULATION);
    return () => {
      actuel = false;
      clearTimeout(minuteur);
    };
  }, [leaveTypeId, startDate, endDate]);

  async function envoyer() {
    setSubmitting(true);
    setError(null);
    try {
      const request = await createLeaveRequest({ leaveTypeId, startDate, endDate, reason: reason.trim() || undefined });
      onCreated(request, simulation);
    } catch (err) {
      setError(messageErreur(err, 'La demande n’a pas pu être envoyée.'));
    } finally {
      setSubmitting(false);
    }
  }

  const options = leaveTypes.map((t) => ({ value: t.id, label: t.name }));
  const s = simulation;
  const detailFeries = s
    ? s.feries.length === 0
      ? 'aucun jour férié sur la période'
      : `${s.feries.length} jour${s.feries.length > 1 ? 's' : ''} férié${s.feries.length > 1 ? 's' : ''} sur la période (${s.feries.map((f) => f.libelle).join(', ')})`
    : '';
  const reprise = s ? dateLongue(`${s.reprise}T00:00:00Z`).replace(` ${new Date().getFullYear()}`, '') : '';

  return (
    <FenetreFormulaire
      titre="Demander un congé"
      onClose={onClose}
      onSubmit={envoyer}
      libelleValider="Envoyer la demande"
      enCours={submitting}
      erreur={error}
      largeur={760}
      testid="fenetre-demande-conge"
      pied={phraseAvis(s)}
      valider={() => (startDate && endDate && endDate < startDate ? { 'conge-fin': 'La date de fin doit être postérieure ou égale à la date de début.' } : {})}
    >
      {options.length <= 5 ? (
        <ChoixSegment id="conge-type" label="Type de congé" options={options} value={leaveTypeId} onChange={setLeaveTypeId} required />
      ) : (
        <Liste id="conge-type" label="Type de congé" options={options} value={leaveTypeId} onChange={setLeaveTypeId} required />
      )}
      <Grille2>
        <ChampDate id="conge-debut" label="Du" value={startDate} onChange={setStartDate} required messageObligatoire="Indiquez le premier jour du congé." />
        <ChampDate id="conge-fin" label="Au (inclus)" value={endDate} onChange={setEndDate} min={startDate || undefined} required messageObligatoire="Indiquez le dernier jour du congé." />
      </Grille2>

      {s ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="simulation-conge"
          className={`mb-3.5 flex flex-col gap-1.5 rounded-[10px] bg-sage-50 px-3.5 py-2.5 text-[13px] text-[#145C33] sm:flex-row sm:items-center sm:gap-4 ${calcul ? 'opacity-60' : ''}`}
        >
          <b className="whitespace-nowrap font-heading text-[18px] font-extrabold">
            {s.jours} jour{s.jours > 1 ? 's' : ''}
          </b>
          <span className="min-w-0">
            décompté{s.jours > 1 ? 's' : ''} · {detailFeries} · reprise le {reprise}
          </span>
          {s.solde && (
            <span className="sm:ml-auto sm:text-right">
              Solde après la demande : <b className="whitespace-nowrap text-[14px]">{s.solde.apres} j</b>
            </span>
          )}
        </div>
      ) : (
        <div role="status" aria-live="polite" data-testid="simulation-conge-attente" className="mb-3.5 rounded-[10px] bg-bg px-3.5 py-2.5 text-[13px] text-text-muted">
          {erreurSimulation ?? (calcul ? 'Calcul du décompte…' : 'Choisissez les deux dates : le nombre de jours décomptés, la reprise et votre solde s’affichent ici.')}
        </div>
      )}

      <ZoneTexte id="conge-motif" label="Motif" facultatif value={reason} onChange={setReason} placeholder="Précisez si besoin…" lignes={3} maxLength={1000} />
    </FenetreFormulaire>
  );
}

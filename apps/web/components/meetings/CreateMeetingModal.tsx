'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createMeeting, getParticipantsPossibles } from '../../lib/api/meetings';
import { getDisponibilite } from '../../lib/api/logistique';
import type { Disponibilite } from '../../lib/logistique/types';
import type { DemandeReunion, Meeting, ParticipantsPossibles } from '../../lib/meetings/types';
import { ChampDate, FenetreFormulaire, Grille2, Liste, Saisie, ZoneTexte } from '../ui/Formulaire';
import { SelecteurParticipants } from './SelecteurParticipants';
import { messageErreur, useToast } from '../ui/Toast';

const deuxChiffres = (n: number) => String(n).padStart(2, '0');
const jourDe = (d: Date) => `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
const heureDe = (d: Date) => `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;

/** « 2026-11-12 » + « 10:30 » → date locale ; null si incomplet. */
const instant = (jour: string, heure: string) => (jour && /^\d{2}:\d{2}$/.test(heure) ? new Date(`${jour}T${heure}`) : null);

/**
 * « Nouvelle réunion » (refonte, étape 9) : titre, date, heures de début et de fin, salle proposée par
 * l'API pour le créneau (ou lieu libre), ordre du jour, participants (unités entières et personnes,
 * sans les stagiaires). `demande` (S1) : réunion d'une demande acceptée — date, heures et participants
 * validés par le chef, verrouillés ; le demandeur choisit la salle et l'ordre du jour.
 */
export function CreateMeetingModal({ onClose, onCreated, demande }: { onClose: () => void; onCreated: (meeting: Meeting) => void; demande?: DemandeReunion | null }) {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const verrou = !!demande;
  const [title, setTitle] = useState(demande?.objet ?? '');
  const [agenda, setAgenda] = useState('');
  const [location, setLocation] = useState('');
  const [jour, setJour] = useState(demande ? jourDe(new Date(demande.debut)) : '');
  const [heureDebut, setHeureDebut] = useState(demande ? heureDe(new Date(demande.debut)) : '');
  const [heureFin, setHeureFin] = useState(demande ? heureDe(new Date(demande.fin)) : '');
  const [possibles, setPossibles] = useState<ParticipantsPossibles | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>(demande ? demande.participants.map((p) => p.id) : []);
  const [uniteIds, setUniteIds] = useState<string[]>(demande ? demande.unites.map((u) => u.id) : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // D9 — salles proposées par l'API pour le créneau : libres, ou occupées
  // quand la priorité hiérarchique est possible (liste = ce que l'API accepte).
  const [salles, setSalles] = useState<Disponibilite[] | null>(null);
  const [salleId, setSalleId] = useState('');

  const debut = instant(jour, heureDebut);
  const fin = instant(jour, heureFin);

  useEffect(() => {
    getParticipantsPossibles()
      .then(setPossibles)
      .catch(() => setPossibles({ personnes: [], unites: [] }));
  }, [currentUser?.id]);

  const cleCreneau = debut && fin && fin > debut ? `${debut.toISOString()}|${fin.toISOString()}` : '';
  useEffect(() => {
    setSalles(null);
    if (!cleCreneau) return;
    const [d, f] = cleCreneau.split('|') as [string, string];
    let cancelled = false;
    const timer = setTimeout(() => {
      getDisponibilite(d, f, 'SALLE')
        .then((dispo) => {
          if (cancelled) return;
          const proposees = dispo.filter((r) => r.libre || r.prioritePossible);
          setSalles(proposees);
          setSalleId((id) => (proposees.some((r) => r.id === id) ? id : ''));
        })
        .catch(() => !cancelled && setSalles([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleCreneau]);
  const salle = salles?.find((r) => r.id === salleId) ?? null;

  async function handleSubmit() {
    if (!debut) return;
    setSubmitting(true);
    setError(null);
    try {
      const meeting = await createMeeting({
        title: title.trim(),
        agenda: agenda.trim() || undefined,
        location: salle ? undefined : location.trim() || undefined,
        startAt: debut.toISOString(),
        endAt: fin ? fin.toISOString() : undefined,
        participantIds,
        ...(demande ? { demandeReunionId: demande.id } : {}),
        ...(salle ? { ressourceId: salle.id, prioritaire: salle.libre ? undefined : true } : {}),
      });
      const n = participantIds.length;
      toast.succes('Réunion créée', {
        detail: n ? `${n} participant${n > 1 ? 's ont été invités' : ' a été invité'}${salle ? ` · ${salle.nom} réservée` : ''}.` : salle ? `${salle.nom} réservée.` : 'Elle apparaît dans « À venir ».',
      });
      onCreated(meeting);
    } catch (err) {
      setError(messageErreur(err, 'La réunion n’a pas pu être créée.'));
    } finally {
      setSubmitting(false);
    }
  }

  const conflits = salle && !salle.libre ? salle.conflits.map((c) => `${c.titulaire.firstName} ${c.titulaire.lastName}`).join(', ') : '';

  return (
    <FenetreFormulaire
      titre="Nouvelle réunion"
      sousTitre={demande ? <span data-testid="demande-validee">Demande validée par {demande.decidePar ?? 'votre chef'} : date et participants verrouillés.</span> : undefined}
      onClose={onClose}
      onSubmit={handleSubmit}
      libelleValider="Créer la réunion"
      enCours={submitting}
      erreur={error}
      testid="fenetre-nouvelle-reunion"
      pied="Les participants reçoivent l’invitation immédiatement et répondent depuis la réunion."
      valider={() => ({
        ...(title.trim().length < 2 ? { 'reunion-titre': title.trim() ? 'Le titre doit compter au moins 2 caractères.' : 'Donnez un titre à la réunion.' } : {}),
        ...(heureFin && heureDebut && heureFin <= heureDebut ? { 'reunion-fin': 'L’heure de fin doit suivre l’heure de début.' } : {}),
      })}
    >
      <Saisie id="reunion-titre" label="Titre" value={title} onChange={setTitle} required maxLength={300} messageObligatoire="Donnez un titre à la réunion." />
      <Grille2>
        {verrou ? (
          <div className="mb-3.5" data-testid="date-verrouillee">
            <p className="mb-1.5 text-[13px] font-semibold text-text">Date et heures validées</p>
            <p className="rounded-[10px] border border-line bg-fond-doux px-3 py-2 text-[13px] text-text">
              {new Date(demande!.debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {heureDebut} – {heureFin}
            </p>
          </div>
        ) : (
          <>
            <ChampDate id="reunion-date" label="Date" value={jour} onChange={setJour} required messageObligatoire="Choisissez la date de la réunion." />
            <Grille2>
              <Saisie id="reunion-debut" label="Début" type="time" value={heureDebut} onChange={setHeureDebut} required messageObligatoire="Indiquez l’heure de début." />
              <Saisie id="reunion-fin" label="Fin" type="time" facultatif value={heureFin} onChange={setHeureFin} />
            </Grille2>
          </>
        )}
      </Grille2>
      <Liste
        id="reunion-salle"
        label="Réserver une salle"
        facultatif
        value={salleId}
        onChange={setSalleId}
        vide={salles ? 'Aucune (lieu libre ci-dessous)' : 'Indiquez la date, le début et la fin pour voir les salles libres'}
        options={(salles ?? []).map((r) => ({
          value: r.id,
          label: `${r.nom}${r.capacite ? ` (${r.capacite} places)` : ''}${r.libre ? (r.mode === 'VALIDATION' ? ' — soumise à validation' : '') : ` — occupée : priorité hiérarchique sur ${r.conflits.map((c) => `${c.titulaire.firstName} ${c.titulaire.lastName}`).join(', ')}`}`,
        }))}
      />
      {salle && !salle.libre && (
        <p className="-mt-2 mb-3.5 rounded-md bg-clay-soft px-3 py-2 text-[12px] text-clay" data-testid="avertissement-priorite">
          En créant la réunion, vous faites valoir la priorité hiérarchique : la réservation de {conflits} sera annulée et la personne prévenue avec votre nom.
        </p>
      )}
      {!salle && <Saisie id="reunion-lieu" label="Lieu" facultatif value={location} onChange={setLocation} placeholder="Bureau, salle extérieure, visioconférence…" />}
      <ZoneTexte id="reunion-ordre" label="Ordre du jour" facultatif value={agenda} onChange={setAgenda} placeholder="Un point par ligne…" lignes={3} />
      <SelecteurParticipants possibles={possibles} valeurs={participantIds} onChange={setParticipantIds} unitesChoisies={uniteIds} onUnites={setUniteIds} verrouille={verrou} />
    </FenetreFormulaire>
  );
}

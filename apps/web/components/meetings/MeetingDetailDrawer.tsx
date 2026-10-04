'use client';

import { useState } from 'react';
import { CalendarDays, MapPin, Plus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { cancelMeeting, updateMeeting } from '../../lib/api/meetings';
import type { Meeting, MeetingResponseStatus } from '../../lib/meetings/types';
import { horaire } from '../../lib/meetings/affichage';
import { DecisionsSection } from './DecisionsSection';
import { DocumentsIssus } from '../documents/DocumentsIssus';
import { FenetreDetail } from '../ui/FenetreDetail';
import { Fenetre } from '../ui/Fenetre';
import { Case, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { BTN_DANGER_CONTOUR, BTN_SECONDAIRE, Pastille, SectionFenetre, type TonPastille } from '../ui/Charte';
import { ReponseReunion } from './MeetingCard';

/** Réponse d'un participant (maquette : Présent vert, Sans réponse gris, Absent rouge). */
const REPONSE: Record<MeetingResponseStatus, [TonPastille, string]> = {
  CONFIRME: ['vert', 'Présent'],
  EN_ATTENTE: ['gris', 'Sans réponse'],
  DECLINE: ['rouge', 'Absent'],
};
const PARTICIPANTS_VISIBLES = 6;

/** Ordre du jour numéroté : une ligne par point (puces ou numéros saisis retirés). */
function pointsOrdreDuJour(agenda: string): string[] {
  return agenda
    .split('\n')
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);
}

const dateHeure = (m: Meeting) => `${new Date(m.startAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(new Date(m.startAt).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })}, ${horaire(m)}`;

/** Compte rendu et « réunion ouverte » (PATCH /meetings/:id, organisateur). */
function FenetreModifier({ meeting, onClose, onUpdated }: { meeting: Meeting; onClose: () => void; onUpdated: (m: Meeting) => void }) {
  const [texte, setTexte] = useState(meeting.minutesText ?? '');
  const [ouverte, setOuverte] = useState(!!meeting.isOpen);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();
  return (
    <Fenetre
      titre="Modifier la réunion"
      onClose={onClose}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      pied="Le titre, la date et les participants ne se modifient pas après la création : annulez puis recréez la réunion si besoin."
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return updateMeeting(meeting.id, { minutesText: texte, isOpen: ouverte })
          .then((m) => {
            onUpdated(m);
            toast.succes('Réunion enregistrée', { detail: ouverte ? 'Réunion ouverte : visible de tous les agents.' : 'Compte rendu mis à jour.' });
            onClose();
          })
          .catch((e) => setErreur(messageErreur(e, 'Enregistrement impossible')))
          .finally(() => setEnCours(false));
      }}
    >
      <ZoneTexte id="reunion-compte-rendu" label="Compte rendu" value={texte} onChange={setTexte} lignes={8} placeholder="Points abordés, échanges, suites à donner…" />
      <Case
        id="reunion-ouverte"
        checked={ouverte}
        onChange={setOuverte}
        label={
          <>
            Réunion ouverte
            <span className="block text-[12px] text-text-muted">Visible de tous les agents, avec son relevé de décisions.</span>
          </>
        }
      />
    </Fenetre>
  );
}

/** Annulation d'une réunion par son organisateur, avec un motif facultatif. */
function FenetreAnnuler({ meeting, onClose, onUpdated }: { meeting: Meeting; onClose: () => void; onUpdated: (m: Meeting) => void }) {
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();
  return (
    <Fenetre
      titre="Annuler la réunion"
      onClose={onClose}
      danger
      libelleValider="Confirmer l’annulation"
      enCours={enCours}
      erreur={erreur}
      pied="Les participants sont prévenus immédiatement."
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return cancelMeeting(meeting.id, motif.trim() || undefined)
          .then((m) => {
            onUpdated(m);
            toast.succes('Réunion annulée', { detail: 'Les participants ont été prévenus.' });
            onClose();
          })
          .catch((e) => setErreur(messageErreur(e, 'Impossible d’annuler cette réunion')))
          .finally(() => setEnCours(false));
      }}
    >
      <p className="mb-3 text-[13.5px]">Annuler « {meeting.title} » ? Cette action est définitive.</p>
      <ZoneTexte id="reunion-motif-annulation" label="Motif" facultatif value={motif} onChange={setMotif} placeholder="Communiqué aux participants…" />
    </Fenetre>
  );
}

/**
 * Fenêtre d'une réunion (refonte de l'interface, maquette de l'étape 8) : en-tête « Réunion · organisée
 * par … », date et heure, salle, participants ; à gauche l'ordre du jour numéroté, les décisions et le
 * compte rendu (texte et documents issus) ; à droite la réponse de l'invité ou les actions de
 * l'organisateur, puis les participants et leur réponse. Mêmes droits et mêmes appels qu'auparavant.
 */
export function MeetingDetailDrawer({
  meeting,
  onClose,
  onUpdated,
}: {
  meeting: Meeting;
  onClose: () => void;
  onUpdated: (meeting: Meeting) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel, getUserInitials } = useOrg();
  const [annuler, setAnnuler] = useState(false);
  const [modifier, setModifier] = useState(false);
  const [tous, setTous] = useState(false);

  const isOrganizer = meeting.createdById === currentUser?.id;
  const myParticipation = meeting.participants.find((p) => p.userId === currentUser?.id);
  const canRespond = !isOrganizer && !!myParticipation && meeting.status === 'PLANIFIEE';
  const canCancel = isOrganizer && meeting.status === 'PLANIFIEE';

  const sallePerdue =
    meeting.status === 'PLANIFIEE' && (meeting.reservation?.statut === 'ANNULEE_PRIORITE' || meeting.reservation?.statut === 'REFUSEE' || meeting.reservation?.statut === 'ANNULEE');
  const salle = meeting.location || (meeting.reservation && !sallePerdue ? meeting.reservation.ressource.nom : null);
  const organisateur = isOrganizer ? 'vous' : getUserLabel(meeting.createdById);
  // L'organisateur en tête, puis les autres participants.
  const participants = [...meeting.participants].sort((a, b) => Number(b.userId === meeting.createdById) - Number(a.userId === meeting.createdById));
  const visibles = tous ? participants : participants.slice(0, PARTICIPANTS_VISIBLES);
  const points = meeting.agenda ? pointsOrdreDuJour(meeting.agenda) : [];

  const cote = (
    <>
      <div className="flex flex-col gap-2">
        {canRespond && <ReponseReunion meeting={meeting} onUpdated={onUpdated} grand />}
        {isOrganizer && meeting.status === 'PLANIFIEE' && (
          <button type="button" className={BTN_SECONDAIRE} onClick={() => setModifier(true)}>
            Modifier la réunion
          </button>
        )}
        {canCancel && (
          <button type="button" className={BTN_DANGER_CONTOUR} onClick={() => setAnnuler(true)}>
            Annuler la réunion
          </button>
        )}
        {!canRespond && !isOrganizer && (
          <p className="text-[12.5px] leading-snug text-text-muted">
            {meeting.status === 'ANNULEE' ? 'Réunion annulée : aucune réponse attendue.' : 'Vous consultez cette réunion sans y être invité.'}
          </p>
        )}
        {isOrganizer && meeting.status === 'ANNULEE' && <p className="text-[12.5px] text-text-muted">Réunion annulée : aucune action possible.</p>}
      </div>
      <div className="my-4 h-px bg-line" />
      <SectionFenetre titre="Participants" n={meeting.participants.length} className="mb-0">
        <ul data-testid="participants-reunion">
          {visibles.map((p) => {
            const [ton, libelle] = REPONSE[p.responseStatus];
            return (
              <li key={p.id} className="flex items-center gap-[7px] py-1 text-[13px]">
                <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink-50 text-[10px] font-bold text-ink">
                  {getUserInitials(p.userId)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {p.userId === currentUser?.id ? 'Vous' : getUserLabel(p.userId)}
                  {p.userId === meeting.createdById && <span className="text-text-muted"> (organisateur)</span>}
                </span>
                <Pastille ton={ton}>{libelle}</Pastille>
              </li>
            );
          })}
        </ul>
        {participants.length > PARTICIPANTS_VISIBLES && (
          <button type="button" onClick={() => setTous((t) => !t)} aria-expanded={tous} className="mt-1.5 text-[12.5px] font-semibold text-text-muted hover:text-ink hover:underline">
            {tous ? 'Réduire la liste' : `Voir ${participants.length - PARTICIPANTS_VISIBLES > 1 ? `les ${participants.length - PARTICIPANTS_VISIBLES} autres` : 'l’autre participant'}`}
          </button>
        )}
      </SectionFenetre>
    </>
  );

  return (
    <>
      <FenetreDetail
        titre={meeting.title}
        onClose={onClose}
        largeur={920}
        filAriane={[`Réunion · organisée par ${organisateur}`]}
        testid="fenetre-reunion"
        entete={
          <div className="mt-2.5 flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[12.5px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays aria-hidden size={14} />
              {dateHeure(meeting)}
            </span>
            {salle && (
              <span className="flex items-center gap-1.5">
                <MapPin aria-hidden size={14} />
                {salle}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users aria-hidden size={14} />
              {meeting.participants.length} participant{meeting.participants.length > 1 ? 's' : ''}
            </span>
            {meeting.status === 'ANNULEE' && <Pastille ton="rouge">Annulée</Pastille>}
            {meeting.isOpen && <Pastille ton="encre">Réunion ouverte</Pastille>}
          </div>
        }
        cote={cote}
      >
        {meeting.reservation?.statut === 'EN_ATTENTE' && (
          <p className="mb-3 rounded-md bg-gold-50 px-3 py-2 text-[12.5px] text-ambre">Salle « {meeting.reservation.ressource.nom} » en attente de validation par un gestionnaire.</p>
        )}
        {sallePerdue && meeting.reservation && (
          <p className="mb-3 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay" data-testid="salle-perdue">
            Salle « {meeting.reservation.ressource.nom} » perdue
            {meeting.reservation.statut === 'ANNULEE_PRIORITE' ? ' (priorité hiérarchique)' : meeting.reservation.statut === 'REFUSEE' ? ' (refusée)' : ''} : la réunion n’a plus de salle.
          </p>
        )}
        {meeting.status === 'ANNULEE' && meeting.cancellationReason && (
          <div className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">Motif d’annulation : {meeting.cancellationReason}</div>
        )}

        <SectionFenetre titre="Ordre du jour">
          {points.length ? (
            <ol>
              {points.map((p, i) => (
                <li key={i} className="flex gap-2.5 border-b border-[#F0F1F6] py-[7px] text-[13.5px]">
                  <span className="flex-none text-text-muted">{i + 1}.</span>
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-text-muted">Aucun ordre du jour indiqué.</p>
          )}
        </SectionFenetre>

        <DecisionsSection meetingId={meeting.id} />

        <SectionFenetre titre="Compte rendu" className="mb-2">
          {meeting.minutesText ? (
            <div className="mb-2.5 whitespace-pre-wrap rounded-[10px] bg-bg p-3.5 text-[13.5px] leading-relaxed" data-testid="compte-rendu">
              {meeting.minutesText}
            </div>
          ) : (
            !isOrganizer && <p className="mb-2 text-[13px] text-text-muted">Aucun compte rendu rédigé.</p>
          )}
          {isOrganizer && meeting.status === 'PLANIFIEE' && (
            <button type="button" onClick={() => setModifier(true)} className="mb-2.5 flex w-full items-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-[#C3C8DA] px-3.5 py-2 text-[13px] font-semibold text-text-muted hover:border-ink hover:text-ink">
              <Plus aria-hidden size={15} />
              {meeting.minutesText ? 'Modifier le compte rendu' : 'Rédiger ou déposer le compte rendu'}
            </button>
          )}
        </SectionFenetre>
        <DocumentsIssus source={{ reunionId: meeting.id, libelle: `réunion « ${meeting.title} »`, type: 'PROCES_VERBAL', periodeDebut: meeting.startAt.slice(0, 10), periodeFin: meeting.startAt.slice(0, 10) }} />
      </FenetreDetail>
      {modifier && <FenetreModifier meeting={meeting} onClose={() => setModifier(false)} onUpdated={onUpdated} />}
      {annuler && <FenetreAnnuler meeting={meeting} onClose={() => setAnnuler(false)} onUpdated={onUpdated} />}
    </>
  );
}

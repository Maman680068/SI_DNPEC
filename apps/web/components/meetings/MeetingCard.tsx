'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { respondToMeeting } from '../../lib/api/meetings';
import type { Meeting } from '../../lib/meetings/types';
import { dateCourte, dateLongue, horaire, jourCourt } from '../../lib/meetings/affichage';
import { Pastille } from '../ui/Charte';
import { messageErreur, useToast } from '../ui/Toast';

/** Boutons « Je participe » / « Absent » (même appel que la fenêtre : respondToMeeting). */
export function ReponseReunion({ meeting, onUpdated, grand = false }: { meeting: Meeting; onUpdated: (m: Meeting) => void; grand?: boolean }) {
  const { user } = useAuth();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();
  const moi = meeting.participants.find((p) => p.userId === user?.id);
  if (!moi || meeting.createdById === user?.id || meeting.status !== 'PLANIFIEE') return null;
  const avant = moi.responseStatus;
  const repondre = (status: 'CONFIRME' | 'DECLINE', annulable = true) => {
    setEnCours(true);
    setErreur(null);
    respondToMeeting(meeting.id, status)
      .then((m) => {
        onUpdated(m);
        // « Annuler » : la même route remet la réponse précédente (jamais « sans réponse », que l'API refuse).
        toast.succes(status === 'CONFIRME' ? 'Présence confirmée' : 'Absence signalée', {
          detail: `${meeting.title} · l’organisateur voit votre réponse.`,
          annuler: annulable && (avant === 'CONFIRME' || avant === 'DECLINE') ? () => repondre(avant, false) : undefined,
        });
      })
      .catch((e) => setErreur(messageErreur(e, 'Impossible d’enregistrer votre réponse')))
      .finally(() => setEnCours(false));
  };
  const oui = moi.responseStatus === 'CONFIRME';
  const non = moi.responseStatus === 'DECLINE';
  if (grand)
    // Fenêtre de la réunion (maquette) : « Je participe » vert pleine largeur, « Absent » en contour.
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2" role="group" aria-label={`Votre réponse à « ${meeting.title} »`}>
          <button type="button" disabled={enCours} aria-pressed={oui} onClick={() => !oui && repondre('CONFIRME')} className={`inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] border text-[14px] font-bold disabled:opacity-60 ${oui ? 'border-sage bg-sage text-white' : 'border-sage bg-surface text-sage hover:bg-sage-50'}`}>
            {oui && <Check aria-hidden size={17} />}
            Je participe
          </button>
          <button type="button" disabled={enCours} aria-pressed={non} onClick={() => !non && repondre('DECLINE')} className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border text-[14px] font-bold disabled:opacity-60 ${non ? 'border-clay bg-clay-50 text-clay' : 'border-line bg-surface text-ink hover:bg-bg'}`}>
            {non && <Check aria-hidden size={16} />}
            Absent
          </button>
        </div>
        {erreur && <p role="alert" className="text-[12px] text-clay">{erreur}</p>}
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5" role="group" aria-label={`Votre réponse à « ${meeting.title} »`}>
        <button type="button" disabled={enCours || oui} aria-pressed={oui} onClick={() => repondre('CONFIRME')} className={`h-[30px] rounded-[7px] border px-2.5 text-[12.5px] font-bold disabled:cursor-default ${oui ? 'border-sage bg-sage text-white' : 'border-line text-ink hover:bg-bg'}`}>
          Je participe
        </button>
        <button type="button" disabled={enCours || non} aria-pressed={non} onClick={() => repondre('DECLINE')} className={`h-[30px] rounded-[7px] border px-2.5 text-[12.5px] font-bold disabled:cursor-default ${non ? 'border-clay bg-clay-50 text-clay' : 'border-line text-ink hover:bg-bg'}`}>
          Absent
        </button>
      </div>
      {erreur && <p role="alert" className="text-[12px] text-clay">{erreur}</p>}
    </div>
  );
}

/** Ligne de la liste « À venir » : pavé de date, titre, horaire · lieu · organisateur, participants, réponse. */
export function LigneReunion({ meeting, onSelect, onUpdated }: { meeting: Meeting; onSelect: () => void; onUpdated: (m: Meeting) => void }) {
  const { user } = useAuth();
  const { getUserLabel, getUserInitials } = useOrg();
  const debut = new Date(meeting.startAt);
  const organisateur = meeting.createdById === user?.id;
  const autreMois = debut.getMonth() !== new Date().getMonth() || debut.getFullYear() !== new Date().getFullYear();
  const visibles = meeting.participants.slice(0, 3);
  const reste = meeting.participants.length - visibles.length;
  return (
    <li data-testid="reunion" className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-t border-line-doux px-4 py-3 md:grid-cols-[52px_minmax(0,1fr)_120px_190px]">
      <span aria-hidden className="flex h-[52px] w-[50px] flex-col justify-center rounded-[10px] bg-ink-50 text-center text-ink">
        <b className="font-heading text-[18px] leading-none">{debut.getDate()}</b>
        <small className="text-[10.5px] font-bold">{jourCourt(debut)}</small>
      </span>
      <div className="min-w-0">
        <button type="button" onClick={onSelect} className="relative block max-w-full truncate text-left text-[14px] font-semibold text-text hover:text-ink hover:underline">
          {meeting.title}
          <span className="sr-only"> — {dateLongue(meeting.startAt)}</span>
        </button>
        <span className="block truncate text-[12.5px] text-text-muted">
          {autreMois ? `${debut.getFullYear() !== new Date().getFullYear() ? debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : dateCourte(meeting.startAt)} · ` : ''}
          {horaire(meeting)}
          {meeting.location ? ` · ${meeting.location}` : ''}
          {organisateur ? ' · organisée par vous' : ` · ${getUserLabel(meeting.createdById)}`}
        </span>
      </div>
      <div className="col-start-2 flex items-center md:col-start-auto" aria-label={`${meeting.participants.length} participant${meeting.participants.length > 1 ? 's' : ''}`} role="img">
        {visibles.map((p) => (
          <span key={p.id} title={getUserLabel(p.userId)} className="-ml-1 grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-surface bg-ink-50 text-[10px] font-bold text-ink first:ml-0">
            {getUserInitials(p.userId)}
          </span>
        ))}
        {reste > 0 && <span className="-ml-1 grid h-[26px] min-w-[26px] place-items-center rounded-full border-2 border-surface bg-fond-gris px-1 text-[10px] font-bold text-text-muted">+{reste}</span>}
      </div>
      <div className="col-start-2 md:col-start-auto">
        {meeting.status === 'ANNULEE' ? (
          <Pastille ton="rouge">Annulée</Pastille>
        ) : organisateur ? (
          <Pastille ton="vert">Organisateur</Pastille>
        ) : (
          <ReponseReunion meeting={meeting} onUpdated={onUpdated} />
        )}
      </div>
    </li>
  );
}

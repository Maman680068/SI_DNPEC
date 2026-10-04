'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import type { Meeting } from '../../lib/meetings/types';
import { COULEUR_RELATION, LIBELLE_RELATION, ajouterJours, heure, jourCourt, memeJour, relationDe, semaineCourante, titreSemaine } from '../../lib/meetings/affichage';

const NAV = 'grid h-8 min-w-[32px] place-items-center rounded-[8px] border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink hover:bg-bg';

/** Calendrier de la semaine (5 jours ouvrés), réunions colorées selon la place de la personne. */
export function SemaineReunions({ meetings, lundi, onLundi, onOuvrir }: { meetings: Meeting[]; lundi: Date; onLundi: (d: Date) => void; onOuvrir: (id: string) => void }) {
  const { user } = useAuth();
  const aujourdhui = new Date();
  const jours = [0, 1, 2, 3, 4].map((n) => ajouterJours(lundi, n));
  return (
    <section aria-label="Calendrier de la semaine" data-testid="semaine-reunions" className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
        <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{titreSemaine(lundi)}</h2>
        <div className="flex gap-1.5 sm:ml-auto">
          <button type="button" className={NAV} onClick={() => onLundi(ajouterJours(lundi, -7))} aria-label="Semaine précédente">
            <ChevronLeft aria-hidden size={15} />
          </button>
          <button type="button" className={NAV} onClick={() => onLundi(semaineCourante())} aria-current={memeJour(lundi, semaineCourante()) ? 'date' : undefined}>
            Aujourd’hui
          </button>
          <button type="button" className={NAV} onClick={() => onLundi(ajouterJours(lundi, 7))} aria-label="Semaine suivante">
            <ChevronRight aria-hidden size={15} />
          </button>
        </div>
      </div>
      <ol className="grid border-t border-line md:grid-cols-5">
        {jours.map((j, n) => {
          const duJour = meetings.filter((m) => memeJour(new Date(m.startAt), j)).sort((a, b) => a.startAt.localeCompare(b.startAt));
          const estAujourdhui = memeJour(j, aujourdhui);
          return (
            <li key={n} data-testid="jour-semaine" aria-current={estAujourdhui ? 'date' : undefined} className={`min-h-[64px] p-2 md:min-h-[130px] ${n ? 'border-t border-line md:border-l md:border-t-0' : ''}`}>
              <div className={`mb-2 flex justify-between text-[12px] font-bold ${estAujourdhui ? 'text-ink' : 'text-text-muted'}`}>
                <span className="relative">
                  {jourCourt(j)}
                  <span className="sr-only"> {j.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{estAujourdhui ? ' (aujourd’hui)' : ''}</span>
                </span>
                <span aria-hidden className={estAujourdhui ? 'rounded-[6px] bg-ink px-1.5 text-white' : ''}>
                  {j.getDate()}
                </span>
              </div>
              {duJour.length > 0 && (
                <ul className="space-y-1.5">
                  {duJour.map((m) => {
                    const r = relationDe(m, user?.id);
                    return (
                      <li key={m.id}>
                        <button type="button" data-testid="reunion-calendrier" onClick={() => onOuvrir(m.id)} className={`relative block w-full rounded-[8px] border-l-[3px] px-[9px] py-[7px] text-left text-[12px] text-text hover:brightness-[0.97] ${COULEUR_RELATION[r]}`}>
                          <b className={`block text-[12.5px] font-semibold leading-tight ${r === 'annulee' ? 'line-through' : ''}`}>{m.title}</b>
                          {heure(m.startAt)}
                          {m.location ? ` · ${m.location}` : ''}
                          <span className="sr-only"> — {LIBELLE_RELATION[r]}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[12px] text-text-muted" aria-hidden>
        {(['organisateur', 'confirme', 'attente', 'perimetre'] as const).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <i className={`inline-block h-2.5 w-2.5 rounded-[3px] border-l-[3px] ${COULEUR_RELATION[r]}`} />
            {LIBELLE_RELATION[r].charAt(0).toUpperCase() + LIBELLE_RELATION[r].slice(1)}
          </span>
        ))}
      </p>
    </section>
  );
}

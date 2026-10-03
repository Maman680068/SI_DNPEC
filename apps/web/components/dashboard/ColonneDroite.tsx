'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { Meeting } from '../../lib/meetings/types';
import type { LeaveBalanceView } from '../../lib/leaves/types';
import type { Announcement } from '../../lib/communication/types';
import type { BlocTableau } from '../../lib/api/tableau-de-bord';
import { LIENS_CREATION } from '../../lib/navigation/creer';
import { BarreAvancement } from '../tasks/ElementsTache';

const CONAKRY = 'Africa/Conakry';

/** Boîte compacte de la colonne droite (maquette : titre Montserrat 15 px, lien à droite). */
export function Boite({ titre, lien, libelleLien, children, testid }: { titre: string; lien?: string; libelleLien?: string; children: ReactNode; testid?: string }) {
  return (
    <section data-testid={testid} aria-label={titre} className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <h2 className="mb-2.5 flex items-center justify-between font-heading text-[15px] font-bold text-ink-900">
        {titre}
        {lien && (
          <Link href={lien} className="font-sans text-[12.5px] font-semibold text-ink hover:underline">
            {libelleLien}
          </Link>
        )}
      </h2>
      {children}
    </section>
  );
}

const ligneVide = (texte: string) => <p className="text-[13px] text-text-muted">{texte}</p>;

export function Agenda({ reunions }: { reunions: Meeting[] }) {
  return (
    <Boite titre="Agenda" lien="/reunions" libelleLien="Réunions" testid="boite-agenda">
      {reunions.length === 0
        ? ligneVide('Aucune réunion prévue.')
        : reunions.map((m, i) => {
            const d = new Date(m.startAt);
            return (
              <Link key={m.id} href={`/reunions?id=${m.id}`} className={`flex items-center gap-3 py-[7px] ${i ? 'border-t border-[#F0F1F6]' : ''}`}>
                <span className="flex h-[46px] w-11 flex-none flex-col justify-center rounded-[9px] bg-ink-50 text-center text-ink">
                  <b className="font-heading text-[17px] leading-none">{d.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: CONAKRY })}</b>
                  <small className="text-[10.5px] font-semibold uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: CONAKRY })}</small>
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-[13.5px] font-semibold">{m.title}</b>
                  <small className="block truncate text-[12.5px] text-text-muted">
                    {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: CONAKRY })}
                    {m.reservation?.ressource.nom || m.location ? ` · ${m.reservation?.ressource.nom ?? m.location}` : ` · ${m.participants.length} participant${m.participants.length > 1 ? 's' : ''}`}
                  </small>
                </span>
              </Link>
            );
          })}
    </Boite>
  );
}

export function MesConges({ soldes, demandes }: { soldes: LeaveBalanceView[]; demandes: BlocTableau | undefined }) {
  // Solde principal : le type le plus doté (congé annuel en pratique).
  const principal = [...soldes].sort((a, b) => b.totalDays - a.totalDays)[0];
  const enCours = demandes?.valeur ?? 0;
  return (
    <Boite titre="Mes congés" lien="/leaves" libelleLien="Historique" testid="boite-conges">
      {principal ? (
        <>
          <div className="flex items-baseline gap-2">
            <b className="font-heading text-[26px] font-extrabold text-sage">{principal.remainingDays} j</b>
            <span className="text-[13px] text-text-muted">
              restants sur {principal.totalDays} en {principal.year}
            </span>
          </div>
          <div className="mb-1 mt-2.5 flex">
            <BarreAvancement valeur={principal.totalDays ? Math.round((principal.usedDays / principal.totalDays) * 100) : 0} couleur="#F0B429" />
          </div>
        </>
      ) : (
        ligneVide('Aucun solde provisionné pour l’année.')
      )}
      <p className="text-[13px] text-text-muted">
        {enCours ? `${enCours} demande${enCours > 1 ? 's' : ''} en cours : ${demandes?.elements?.[0]?.detail ?? ''}` : 'Aucune demande en cours.'}
      </p>
      <Link href={LIENS_CREATION.conge} className="mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-[9px] border border-line bg-surface text-[13.5px] font-semibold text-ink hover:bg-bg">
        <Plus aria-hidden size={16} /> Demander un congé
      </Link>
    </Boite>
  );
}

export function StagiaireEncadre({ bloc }: { bloc: BlocTableau }) {
  const aValider = (bloc.elements ?? []).filter((e) => e.detail).length;
  return (
    <Boite titre={bloc.valeur && bloc.valeur > 1 ? 'Stagiaires encadrés' : 'Stagiaire encadré'} lien="/stages" libelleLien="Ouvrir" testid="boite-stagiaire">
      {(bloc.elements ?? []).map((e, i) => (
        <div key={i} className={`flex items-center justify-between py-1.5 text-[13px] ${i ? 'border-t border-[#F0F1F6]' : ''}`}>
          <Link href={e.lien ?? '/stages'} className="flex min-w-0 items-center gap-2.5 hover:underline">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink-50 text-[11px] font-bold text-ink">
              {e.libelle
                .split(' ')
                .map((x) => x.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="truncate">{e.libelle}</span>
          </Link>
          <span className={`inline-flex h-[22px] flex-none items-center rounded-md px-2 text-[12px] font-semibold ${e.detail ? 'bg-gold-50 text-ambre' : 'bg-sage-50 text-sage'}`}>{e.detail ? 'Rapport à valider' : 'À jour'}</span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-[#F0F1F6] py-1.5 text-[13px]">
        <span className="text-text-muted">Rapports à valider</span>
        <b>{aValider}</b>
      </div>
    </Boite>
  );
}

function ilYA(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}

export function DerniereAnnonce({ annonce }: { annonce: Announcement }) {
  return (
    <Boite titre="Dernière annonce" lien="/communication" libelleLien="Toutes" testid="boite-annonce">
      <Link href={`/communication?announcementId=${annonce.id}`} className="block text-[13.5px] font-semibold hover:underline">
        {annonce.title}
      </Link>
      <div className="mt-[3px] text-[13px] text-text-muted">
        {annonce.scope === 'DNPEC' ? 'Direction' : 'Mon unité'} · {ilYA(annonce.createdAt)}
      </div>
    </Boite>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getNombreNonLues, getNotifications, marquerLue, marquerToutLu } from '../../lib/api/notifications';
import type { NotificationItem } from '../../lib/notifications/types';

const INTERVALLE_MS = 60_000;

function quand(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Cloche de la barre du haut : compteur des non lues (rafraîchi chaque minute
 * et à chaque changement de page), liste des 50 dernières, ouverture de
 * l'élément concerné (qui marque la notification lue). */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [nonLues, setNonLues] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState<NotificationItem[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const racine = useRef<HTMLDivElement>(null);
  const requete = useRef(0);

  const compter = useCallback(() => {
    getNombreNonLues()
      .then(setNonLues)
      .catch(() => {
        // Compteur seulement : une erreur réseau passagère ne doit rien afficher.
      });
  }, []);

  const charger = useCallback(() => {
    const n = ++requete.current;
    setErreur(null);
    getNotifications()
      .then((l) => n === requete.current && setListe(l))
      .catch((err) => n === requete.current && setErreur(err instanceof Error ? err.message : 'Impossible de charger les notifications'));
    compter();
  }, [compter]);

  useEffect(() => {
    compter();
    // Onglet caché : pas d'interrogation (charge du serveur, performance 2026-10) ; le compteur
    // se remet à jour au retour sur la page (navigation) ou à l'intervalle suivant.
    const t = window.setInterval(() => document.hidden || compter(), INTERVALLE_MS);
    return () => window.clearInterval(t);
  }, [compter]);

  useEffect(() => {
    compter();
    setOuvert(false);
  }, [pathname, compter]);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [ouvert]);

  function basculer() {
    if (!ouvert) charger();
    setOuvert(!ouvert);
  }

  async function ouvrir(n: NotificationItem) {
    if (!n.isRead) {
      setListe((l) => l?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? l);
      setNonLues((c) => Math.max(0, c - 1));
      await marquerLue(n.id).catch(() => undefined);
    }
    setOuvert(false);
    if (n.link) router.push(n.link);
  }

  async function toutLire() {
    try {
      await marquerToutLu();
      charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Action impossible');
    }
  }

  return (
    <div ref={racine} className="relative">
      <button
        onClick={basculer}
        aria-label={nonLues > 0 ? `Notifications : ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Notifications'}
        aria-expanded={ouvert}
        className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] text-ink hover:bg-bg"
      >
        <Bell aria-hidden size={20} strokeWidth={1.8} />
        {nonLues > 0 && (
          <span data-testid="compteur-notifications" className="absolute right-1 top-[5px] grid h-[17px] min-w-[17px] place-items-center rounded-[9px] border-2 border-white bg-clay px-1 text-[10.5px] font-bold leading-none text-white">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>
      {ouvert && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-[62px] z-50 max-h-[75vh] overflow-y-auto rounded-lg border border-line bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <span className="text-[13.5px] font-bold">Notifications</span>
            {nonLues > 0 && (
              <button onClick={toutLire} className="text-[12px] font-semibold text-accent">
                Tout marquer comme lu
              </button>
            )}
          </div>
          {erreur && (
            <div role="alert" className="m-3 rounded-md bg-clay-soft px-3 py-2.5 text-[12.5px] text-clay">
              {erreur}
            </div>
          )}
          {!liste ? (
            !erreur && <p className="px-4 py-5 text-[13px] text-text-muted">Chargement…</p>
          ) : liste.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-text-faint">Aucune notification.</p>
          ) : (
            <ul>
              {liste.map((n) => (
                <li key={n.id} className="border-b border-line last:border-b-0">
                  <button onClick={() => ouvrir(n)} className={`flex w-full gap-2.5 px-4 py-3 text-left hover:bg-bg ${n.isRead ? '' : 'bg-accent-soft'}`} data-testid="notification">
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-clay'}`} aria-hidden />
                    <span className="min-w-0">
                      <span className={`block text-[13px] ${n.isRead ? 'font-medium' : 'font-bold'}`}>{n.title}</span>
                      <span className="line-clamp-2 block text-[12.5px] text-text-muted">{n.body}</span>
                      <span className="block text-[11.5px] text-text-faint">
                        {quand(n.createdAt)}
                        {n.isRead ? '' : ' · non lue'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

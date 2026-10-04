'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  FileSignature,
  FileText,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  SquareCheck,
  Sun,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { getNombreNonLues, getNotifications, marquerLue, marquerToutLu } from '../../lib/api/notifications';
import type { NotificationItem } from '../../lib/notifications/types';

const INTERVALLE_MS = 60_000;

/** Icône d'un type de notification (famille du module). */
function iconeDe(type: string): LucideIcon {
  if (type.startsWith('TACHE_')) return SquareCheck;
  if (type.startsWith('CONGE_')) return Sun;
  if (type.startsWith('COURRIER_') || type.startsWith('IMPUTATION_') || type === 'PLI_PERSONNEL_RECU') return Mail;
  if (type.startsWith('ACTE_')) return FileSignature;
  if (type.startsWith('REUNION_')) return CalendarDays;
  if (type === 'MESSAGE_DIRECT' || type === 'MENTION_COMMENTAIRE') return MessageSquare;
  if (type === 'ANNONCE') return Megaphone;
  if (type === 'SONDAGE_CREE') return BarChart3;
  if (type === 'DOCUMENT_PUBLIE') return FileText;
  if (type.startsWith('SUGGESTION_')) return Lightbulb;
  if (type.startsWith('STAGE_')) return GraduationCap;
  if (type.startsWith('LOGISTIQUE_') || type.startsWith('RESERVATION_') || type === 'BIEN_A_RECUPERER') return Package;
  if (type.startsWith('SUPPLEANCE_') || type === 'ROLE_MODIFIE') return UserCog;
  if (type === 'DECISION_RELANCE') return ListChecks;
  if (type === 'DOSSIER_ERREUR_SIGNALEE') return AlertTriangle;
  return Bell;
}

/**
 * Filtre « À traiter » de la cloche : notifications qui appellent une action de la personne
 * (classement d'affichage par type, sans aucun droit : l'écran visé décide de ce qui est possible).
 */
const A_TRAITER = new Set([
  'TACHE_ASSIGNEE', 'TACHE_SOUMISE_VALIDATION', 'TACHE_EN_RETARD', 'TACHE_REJETEE', 'TACHE_ECHEANCE_PROCHE',
  'CONGE_SOUMIS', 'COURRIER_A_IMPUTER', 'COURRIER_IMPUTE', 'IMPUTATION_ECHEANCE_PROCHE', 'IMPUTATION_EN_RETARD',
  'ACTE_A_VISER', 'ACTE_A_SIGNER', 'ACTE_RENVOYE', 'ACTE_PRISE_CONNAISSANCE', 'DECISION_RELANCE', 'MENTION_COMMENTAIRE',
  'STAGE_PERIODE_A_ACCEPTER', 'STAGE_EVALUATION_A_FAIRE', 'STAGE_EVALUATION_A_VISER', 'STAGE_EVALUATION_RENVOYEE', 'STAGE_ALERTE',
  'LOGISTIQUE_DEMANDE_A_VALIDER', 'LOGISTIQUE_DEMANDE_A_TRAITER', 'LOGISTIQUE_STOCK_BAS', 'RESERVATION_A_VALIDER', 'BIEN_A_RECUPERER',
  'SUGGESTION_RECUE', 'DOSSIER_ERREUR_SIGNALEE',
]);

type Filtre = 'toutes' | 'non-lues' | 'a-traiter';

/** Jour d'une notification : « Aujourd’hui », « Hier », puis « lundi 28 septembre ». */
function jourDe(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  const cle = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (cle(d) === cle(maintenant)) return 'Aujourd’hui';
  if (cle(d) === cle(hier)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

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
  const [filtre, setFiltre] = useState<Filtre>('toutes');
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
      setListe((l) => l?.map((x) => ({ ...x, isRead: true })) ?? l);
      setNonLues(0);
      charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Action impossible');
    }
  }

  const visibles = (liste ?? []).filter((n) => (filtre === 'non-lues' ? !n.isRead : filtre === 'a-traiter' ? A_TRAITER.has(n.type) : true));
  const groupes: { jour: string; items: NotificationItem[] }[] = [];
  for (const n of visibles) {
    const j = jourDe(n.createdAt);
    const g = groupes[groupes.length - 1];
    if (g && g.jour === j) g.items.push(n);
    else groupes.push({ jour: j, items: [n] });
  }
  const FILTRES: [Filtre, string][] = [
    ['toutes', 'Toutes'],
    ['non-lues', 'Non lues'],
    ['a-traiter', 'À traiter'],
  ];

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
          className="fixed inset-x-2 top-[62px] z-50 flex max-h-[78vh] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_40px_rgba(18,28,77,0.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[400px]"
        >
          <div className="flex items-center gap-2.5 border-b border-line px-4 pb-2.5 pt-3.5">
            <b className="font-heading text-[15px] font-extrabold text-ink-900">Notifications</b>
            {nonLues > 0 && <span className="rounded-[10px] bg-gold-50 px-2 py-0.5 text-[11.5px] font-bold text-ambre">{nonLues} non lue{nonLues > 1 ? 's' : ''}</span>}
            {nonLues > 0 && (
              <button onClick={toutLire} className="ml-auto text-[12.5px] font-bold text-ink hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div role="group" aria-label="Filtrer les notifications" className="flex gap-1 border-b border-line px-3 py-2">
            {FILTRES.map(([cle, libelle]) => (
              <button
                key={cle}
                type="button"
                aria-pressed={filtre === cle}
                onClick={() => setFiltre(cle)}
                className={`rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold ${filtre === cle ? 'bg-ink text-white' : 'text-text-muted hover:bg-bg'}`}
              >
                {libelle}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {erreur && (
              <div role="alert" className="m-3 rounded-md bg-clay-soft px-3 py-2.5 text-[12.5px] text-clay">
                {erreur}
              </div>
            )}
            {!liste ? (
              !erreur && (
                <div className="space-y-3 px-4 py-4" role="status" aria-label="Chargement en cours">
                  <span className="sr-only">Chargement en cours</span>
                  {[70, 55, 62].map((l) => (
                    <span key={l} aria-hidden className="block h-3 animate-pulse rounded bg-[#ECEEF4]" style={{ width: `${l}%` }} />
                  ))}
                </div>
              )
            ) : visibles.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-text-muted">
                {filtre === 'non-lues' ? 'Tout est lu.' : filtre === 'a-traiter' ? 'Rien à traiter pour le moment.' : 'Aucune notification.'}
              </p>
            ) : (
              groupes.map((g) => (
                <section key={g.jour} aria-label={g.jour}>
                  <h3 className="bg-[#FBFBFD] px-4 pb-1 pt-2.5 font-sans text-[11.5px] font-semibold tracking-normal text-text-muted">{g.jour}</h3>
                  <ul>
                    {g.items.map((n) => {
                      const Icone = iconeDe(n.type);
                      return (
                        <li key={n.id}>
                          <button onClick={() => ouvrir(n)} className={`flex w-full gap-3 px-4 py-2.5 text-left hover:bg-bg ${n.isRead ? '' : 'bg-[#F6F7FC]'}`} data-testid="notification" data-type={n.type}>
                            <span aria-hidden className={`grid h-8 w-8 flex-none place-items-center rounded-[9px] ${A_TRAITER.has(n.type) ? 'bg-gold-50 text-ambre' : 'bg-ink-50 text-ink'}`}>
                              <Icone size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-[13px] ${n.isRead ? 'font-medium' : 'font-bold'} text-text`}>{n.title}</span>
                              <span className="line-clamp-2 block text-[12.5px] text-text-muted">{n.body}</span>
                              <span className="block text-[11.5px] text-text-faint">
                                {quand(n.createdAt)}
                                {n.isRead ? '' : ' · non lue'}
                              </span>
                            </span>
                            {!n.isRead && <span aria-hidden className="mt-1.5 h-2 w-2 flex-none rounded-full bg-gold" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Children, isValidElement, useEffect, useId, useState, type ReactNode } from 'react';
import { Check, Search, SlidersHorizontal } from 'lucide-react';

/**
 * Composants communs de la refonte de l'interface (étapes 3 à 7, maquettes validées) : en-tête de
 * page, onglets à compteur, bande de compteurs, recherche et filtres compacts, tableau compact,
 * pastilles de statut, circuit en étapes, anneau d'avancement, bandeau, panneau, état vide.
 * Mêmes valeurs que `shell.css` des maquettes ; à réutiliser plutôt que recopier.
 */

/** Boutons de la charte : principal (bleu nuit), secondaire (contour), danger (lien rouge). */
export const BTN_PRINCIPAL =
  'inline-flex h-[38px] items-center justify-center gap-2 rounded-[10px] bg-ink px-3.5 text-[14px] font-bold text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_SECONDAIRE =
  'inline-flex h-[38px] items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 text-[14px] font-bold text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_SUCCES =
  'inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-sage px-3.5 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_DANGER_CONTOUR =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#E7B3BB] bg-surface px-3.5 text-[14px] font-bold text-clay disabled:cursor-not-allowed disabled:opacity-50';
/** Petit bouton d'action sur une ligne de tableau. */
export const BTN_LIGNE = 'inline-flex h-[30px] flex-none items-center whitespace-nowrap justify-center rounded-[7px] border border-line px-3 text-[12.5px] font-bold text-ink hover:bg-bg';
export const BTN_LIGNE_PRINCIPAL = 'inline-flex h-[30px] flex-none items-center whitespace-nowrap justify-center rounded-[7px] border border-ink bg-ink px-3 text-[12.5px] font-bold text-white';

/** En-tête de page : titre (Montserrat 800, 24 px), sous-titre, actions à droite. */
export function EnTetePage({ titre, sousTitre, actions, avantActions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode; avantActions?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
      <h1 className="font-heading text-[24px] font-extrabold text-ink-900">{titre}</h1>
      {sousTitre && <span className="text-[14px] text-text-muted">{sousTitre}</span>}
      {avantActions}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface Onglet<T extends string> {
  cle: T;
  label: string;
  n?: number | null;
  /** Pastille dorée (éléments qui attendent la personne). */
  chaud?: boolean;
}

/** Onglets soulignés avec compteur (maquette : `.tabs`). */
export function Onglets<T extends string>({ onglets, actif, onChange, label }: { onglets: Onglet<T>[]; actif: T; onChange: (cle: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-3.5 flex gap-1 overflow-x-auto border-b border-line">
      {onglets.map((o) => {
        const on = o.cle === actif;
        return (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.cle)}
            className={`-mb-px flex flex-none items-center gap-2 border-b-2 px-3 py-[9px] text-[14px] font-semibold ${on ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-ink'}`}
          >
            {o.label}
            {o.n !== undefined && o.n !== null && (o.n > 0 || on) && (
              <span className={`rounded-[10px] px-[7px] py-px text-[11.5px] font-bold ${on ? 'bg-ink text-white' : o.chaud && o.n > 0 ? 'bg-gold text-ink-900' : 'bg-[#ECEEF5] text-text-muted'}`}>{o.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type Ton = 'encre' | 'rouge' | 'ambre' | 'vert' | 'gris';
const COULEUR_CHIFFRE: Record<Ton, string> = { encre: 'text-ink-900', rouge: 'text-clay', ambre: 'text-ambre-vif', vert: 'text-sage', gris: 'text-text-muted' };

export interface Compteur {
  valeur: ReactNode;
  label: string;
  sous?: ReactNode;
  ton?: Ton;
  href?: string;
  onClick?: () => void;
  actif?: boolean;
  testid?: string;
}

/**
 * Bande de compteurs. `empile` (par défaut) : chiffre au-dessus du libellé, cellules séparées par un
 * trait (Plan, Personnel, Logistique) ; `cartes` : cartes séparées, chiffre à gauche, cliquables (Courrier).
 */
export function BandeCompteurs({ items, variante = 'empile', label }: { items: Compteur[]; variante?: 'empile' | 'cartes'; label: string }) {
  const cellule = (c: Compteur, i: number) => {
    const contenu =
      variante === 'cartes' ? (
        <>
          <span className={`min-w-[28px] font-heading text-[24px] font-extrabold leading-none ${COULEUR_CHIFFRE[c.ton ?? 'encre']}`}>{c.valeur}</span>
          <span className="min-w-0">
            <b className="block text-[13.5px] font-semibold text-text">{c.label}</b>
            {c.sous && <small className="block text-[12px] text-text-muted">{c.sous}</small>}
          </span>
        </>
      ) : (
        <>
          <span className={`block font-heading text-[24px] font-extrabold leading-tight ${COULEUR_CHIFFRE[c.ton ?? 'encre']}`}>{c.valeur}</span>
          <b className="block text-[13px] font-semibold text-text">{c.label}</b>
          {c.sous && <small className="block text-[12.5px] text-text-muted">{c.sous}</small>}
        </>
      );
    const classe =
      variante === 'cartes'
        ? `flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 text-left ${c.actif ? 'border-ink shadow-[inset_0_0_0_1px_theme(colors.ink.DEFAULT)]' : 'border-line'} ${c.href || c.onClick ? 'hover:bg-bg' : ''}`
        : `block px-[18px] py-3.5 text-left ${i ? 'border-t border-line sm:border-l sm:border-t-0' : ''} ${c.href || c.onClick ? 'hover:bg-bg' : ''}`;
    if (c.href)
      return (
        <Link key={i} href={c.href} className={classe} data-testid={c.testid} aria-current={c.actif ? 'true' : undefined}>
          {contenu}
        </Link>
      );
    if (c.onClick)
      return (
        <button key={i} type="button" onClick={c.onClick} className={classe} data-testid={c.testid} aria-pressed={c.actif}>
          {contenu}
        </button>
      );
    return (
      <div key={i} className={classe} data-testid={c.testid}>
        {contenu}
      </div>
    );
  };
  return variante === 'cartes' ? (
    <section aria-label={label} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(cellule)}
    </section>
  ) : (
    <section aria-label={label} className={`mb-4 grid overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-2 ${items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : ''}`}>
      {items.map(cellule)}
    </section>
  );
}

/** Champ de recherche compact (maquette : `.find`, 280 px). */
export function Recherche({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="flex h-9 w-full items-center gap-2 rounded-[9px] border border-line bg-surface px-[11px] text-text-faint focus-within:border-ink sm:w-[280px]">
      <Search aria-hidden size={16} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-text placeholder:text-text-faint focus:outline-none" />
    </label>
  );
}

/** Filtre compact (liste déroulante) ; encadré en bleu quand il n'est pas à sa valeur par défaut. */
export function FiltreSelect<T extends string>({ label, value, defaut, onChange, options }: { label: string; value: T; defaut: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const actif = value !== defaut;
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={`h-9 w-full max-w-full rounded-[9px] border px-2.5 text-[13px] font-semibold md:w-auto md:max-w-[220px] ${actif ? 'border-ink bg-ink-50 text-ink' : 'border-line bg-surface text-text'}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Barre d'outils au-dessus d'un tableau (recherche, filtres, actions à droite). */
export function BarreOutils({ children, droite }: { children: ReactNode; droite?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      {children}
      {droite && <div className="ml-auto flex items-center gap-2">{droite}</div>}
    </div>
  );
}

/**
 * Filtres d'une barre d'outils (refonte, étape 9) : en ligne sur ordinateur ; sur téléphone, repliés
 * derrière un bouton « Filtres (N) » (N = filtres actifs) qui ouvre un panneau, refermé par
 * « Appliquer », Échap ou un clic à côté. Les filtres eux-mêmes ne changent pas.
 */
export function Filtres({ actifs = 0, children, onEffacer }: { actifs?: number; children: ReactNode; onEffacer?: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouvert]);
  return (
    <>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert(true)}
        data-testid="bouton-filtres"
        className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold md:hidden ${actifs ? 'border-ink bg-ink-50 text-ink' : 'border-line bg-surface text-text'}`}
      >
        <SlidersHorizontal aria-hidden size={15} /> Filtres{actifs ? ` (${actifs})` : ''}
      </button>
      {ouvert && <div aria-hidden className="fixed inset-0 z-40 bg-[rgba(20,26,38,0.42)] md:hidden" onClick={() => setOuvert(false)} />}
      <div
        id={id}
        role={ouvert ? 'dialog' : undefined}
        aria-label={ouvert ? 'Filtres' : undefined}
        className={
          ouvert
            ? 'fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col gap-2.5 overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-[0_-12px_30px_rgba(18,28,77,0.2)] md:static md:contents'
            : 'hidden md:contents'
        }
      >
        {ouvert && (
          <div className="mb-1 flex items-center justify-between md:hidden">
            <b className="font-heading text-[16px] font-extrabold text-ink-900">Filtres</b>
            {onEffacer && actifs > 0 && (
              <button type="button" className="text-[13px] font-semibold text-ink underline" onClick={onEffacer}>
                Effacer les filtres
              </button>
            )}
          </div>
        )}
        {children}
        {ouvert && (
          <button type="button" className={`${BTN_PRINCIPAL} mt-1 w-full md:hidden`} onClick={() => setOuvert(false)}>
            Appliquer
          </button>
        )}
      </div>
    </>
  );
}

export type TonPastille = 'gris' | 'encre' | 'ambre' | 'vert' | 'rouge' | 'bleu';
const PASTILLE: Record<TonPastille, string> = {
  gris: 'bg-[#F0F1F5] text-[#4B5263]',
  encre: 'bg-ink-50 text-ink',
  ambre: 'bg-gold-50 text-ambre',
  vert: 'bg-sage-50 text-sage',
  rouge: 'bg-clay-50 text-clay',
  bleu: 'bg-[#E6F0FA] text-[#1D5FA0]',
};
/** Pastille de statut avec point (maquette : `.pill`). */
export function Pastille({ ton, children, testid }: { ton: TonPastille; children: ReactNode; testid?: string }) {
  return (
    <span data-testid={testid} className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xl px-[9px] text-[12px] font-semibold ${PASTILLE[ton]}`}>
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Marque « Final » (document). */
export function MarqueFinal() {
  return <span className="rounded-[5px] border border-[#A9D5B7] px-1.5 py-px text-[11px] font-bold text-sage">Final</span>;
}

/** Vignette de type de fichier (PDF rouge, tableur vert, texte bleu, autre gris). */
export function IconeFichier({ nom, grand = false }: { nom: string; grand?: boolean }) {
  const ext = (nom.split('.').pop() ?? '').toLowerCase();
  const [libelle, couleur] =
    ext === 'pdf'
      ? ['PDF', '#C8102E']
      : ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
        ? ['XLS', '#197C43']
        : ['doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext)
          ? ['DOC', '#2B5CAB']
          : ['ppt', 'pptx', 'odp'].includes(ext)
            ? ['PPT', '#B4561C']
            : [ext.slice(0, 4).toUpperCase() || 'FIC', '#5C6270'];
  return (
    <span aria-hidden className={`grid flex-none place-items-center rounded-[6px] font-extrabold text-white ${grand ? 'h-[38px] w-8 text-[9.5px]' : 'h-[34px] w-[30px] text-[9.5px]'}`} style={{ background: couleur }}>
      {libelle}
    </span>
  );
}

/**
 * Tableau compact (maquettes : en-tête 38 px gris, lignes séparées). `grille` : classes de colonnes
 * Tailwind pour grand écran (ex. `lg:grid-cols-[118px_84px_minmax(0,1fr)]`) ; sur téléphone chaque
 * ligne passe en pile. Les cellules sont les enfants directs de `LigneTableau`.
 */
export function Tableau({ label, colonnes, grille, children, pied, vide, testid }: { label: string; colonnes: ReactNode[]; grille: string; children: ReactNode; pied?: ReactNode; vide?: ReactNode; testid?: string }) {
  const lignes = Children.toArray(children).filter(isValidElement);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" data-testid={testid}>
      {lignes.length === 0 ? (
        vide
      ) : (
        <div role="table" aria-label={label}>
          <div role="rowgroup">
            <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-[#F7F8FB] px-4 text-[12px] font-semibold text-text-muted lg:grid ${grille}`}>
              {colonnes.map((c, i) => (
                <span key={i} role="columnheader">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div role="rowgroup">{lignes}</div>
        </div>
      )}
      {pied && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[13px] text-text-muted">{pied}</div>}
    </div>
  );
}

export function LigneTableau({ grille, children, onClick, label, actif, testid }: { grille: string; children: ReactNode; onClick?: () => void; label?: string; actif?: boolean; testid?: string }) {
  return (
    <div
      role="row"
      data-testid={testid}
      aria-label={label}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onClick()) : undefined}
      className={`grid grid-cols-1 items-center gap-x-3 gap-y-1 border-b border-[#F0F1F6] px-4 py-2.5 text-[13.5px] last:border-b-0 lg:min-h-[54px] lg:py-1.5 ${grille} ${onClick ? 'cursor-pointer hover:bg-[#F6F7FC] focus:bg-[#F6F7FC] focus:outline-none' : ''} ${actif ? 'bg-[#F6F7FC]' : ''}`}
    >
      {Children.map(children, (c) => (
        <span role="cell" className="min-w-0">
          {c}
        </span>
      ))}
    </div>
  );
}

export type EtatEtape = 'fait' | 'courant' | 'avenir';
/** Circuit en étapes horizontales (en-tête des fenêtres : rond numéroté ou coché, trait). */
export function Etapes({ etapes, label = 'Étapes du circuit' }: { etapes: { label: string; etat: EtatEtape }[]; label?: string }) {
  return (
    <ol aria-label={label} className="mt-3.5 flex flex-wrap items-center gap-y-2">
      {etapes.map((e, i) => (
        <li key={i} className="flex items-center" aria-current={e.etat === 'courant' ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className={`mx-2.5 h-0.5 w-6 sm:w-14 ${e.etat !== 'avenir' ? 'bg-sage' : 'bg-[#E1E4EE]'}`} />}
          <span className={`flex items-center gap-[7px] text-[12.5px] font-semibold ${e.etat === 'fait' ? 'text-sage' : e.etat === 'courant' ? 'text-ink-900' : 'text-text-muted'}`}>
            <b className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11px] ${e.etat === 'fait' ? 'bg-sage text-white' : e.etat === 'courant' ? 'bg-gold text-ink-900' : 'bg-[#ECEEF5] text-text-muted'}`}>
              {e.etat === 'fait' ? <Check aria-hidden size={12} strokeWidth={3} /> : i + 1}
            </b>
            {e.label}
            {e.etat === 'fait' && <span className="sr-only"> (fait)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Circuit d'une demande sur une ligne de progression (congés : 4 étapes avec détail sous le libellé). */
export function Circuit({ etapes, label }: { etapes: { label: string; detail?: ReactNode; etat: EtatEtape }[]; label: string }) {
  return (
    <ol aria-label={label} className="my-4 grid gap-y-3 sm:grid-cols-4">
      {etapes.map((e, i) => (
        <li key={i} className="relative pt-[30px] text-[12.5px] text-text-muted" aria-current={e.etat === 'courant' ? 'step' : undefined}>
          <span aria-hidden className={`absolute top-[10px] h-[3px] ${i === 0 ? 'left-3' : 'left-0'} ${i === etapes.length - 1 ? 'w-3' : 'right-0'} ${e.etat === 'fait' ? 'bg-sage' : 'bg-[#E3E6EF]'}`} />
          <i aria-hidden className={`absolute left-0 top-0.5 h-[19px] w-[19px] rounded-full border-[3px] ${e.etat === 'fait' ? 'border-sage bg-sage' : e.etat === 'courant' ? 'border-gold bg-surface shadow-[0_0_0_4px_theme(colors.gold.50)]' : 'border-[#CDD1DF] bg-surface'}`} />
          <b className={`block text-[13px] ${e.etat === 'courant' ? 'text-ambre' : 'text-text'}`}>
            {e.label}
            {e.etat === 'fait' && <span className="sr-only"> (fait)</span>}
            {e.etat === 'courant' && <span className="sr-only"> (en cours)</span>}
          </b>
          {e.detail}
        </li>
      ))}
    </ol>
  );
}

/** Anneau d'avancement (pourcentage au centre). */
export function Anneau({ valeur, taille = 62, couleur = 'var(--couleur-sage)', label }: { valeur: number; taille?: number; couleur?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(valeur)));
  const interieur = Math.round(taille * 0.77);
  return (
    <span role="img" aria-label={label ?? `${v} %`} className="grid flex-none place-items-center rounded-full" style={{ width: taille, height: taille, background: `conic-gradient(${couleur} 0 ${v}%, #E8EAF2 ${v}% 100%)` }}>
      <span className="grid place-items-center rounded-full bg-surface font-heading font-extrabold text-ink-900" style={{ width: interieur, height: interieur, fontSize: taille >= 60 ? 16 : 13 }}>
        {v}%
      </span>
    </span>
  );
}

/** Bandeau d'information (ambre par défaut) avec action à droite. */
export function Bandeau({ children, action, icone, ton = 'ambre', testid }: { children: ReactNode; action?: ReactNode; icone?: ReactNode; ton?: 'ambre' | 'vert' | 'rouge'; testid?: string }) {
  const couleurs = ton === 'ambre' ? 'border-[#F2D58A] bg-gold-50' : ton === 'vert' ? 'border-[#A9D5B7] bg-sage-50' : 'border-[#E7B3BB] bg-clay-50';
  return (
    <div role="status" data-testid={testid} className={`mb-3.5 flex flex-wrap items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-[13.5px] ${couleurs}`}>
      {icone}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/** Panneau blanc avec en-tête (titre Montserrat, compteur, action à droite). */
export function Panneau({ titre, compteur, action, children, testid, className = '' }: { titre: ReactNode; compteur?: ReactNode; action?: ReactNode; children: ReactNode; testid?: string; className?: string }) {
  return (
    <section data-testid={testid} aria-label={typeof titre === 'string' ? titre : undefined} className={`rounded-xl border border-line bg-surface ${className}`}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] py-3">
        <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{titre}</h2>
        {compteur}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Section d'une fenêtre de détail (titre 13 px, compteur discret). */
export function SectionFenetre({ titre, n, children, className = 'mb-[18px]' }: { titre: string; n?: number; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900">
        {titre} {n !== undefined && <span className="font-semibold text-text-faint">{n}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Liste clé / valeur des fenêtres (colonne de libellés de 110 px). */
export function CleValeur({ lignes, largeur = 110 }: { lignes: [ReactNode, ReactNode][]; largeur?: number }) {
  return (
    <dl className="grid items-center gap-x-3 gap-y-[11px] text-[13px]" style={{ gridTemplateColumns: `${largeur}px minmax(0,1fr)` }}>
      {lignes.map(([c, v], i) => (
        <div key={i} className="contents">
          <dt className="text-text-muted">{c}</dt>
          <dd className="min-w-0 font-semibold text-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** État vide qui propose une action (jamais de grande carte vide). */
export function EtatVide({ texte, action }: { texte: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-6 text-center text-[13.5px] text-text-muted">
      <span>{texte}</span>
      {action}
    </div>
  );
}

/** Initiales dans un rond (avatar sans photo). */
export function Initiales({ texte, taille = 34 }: { texte: string; taille?: number }) {
  return (
    <span aria-hidden className="grid flex-none place-items-center rounded-full bg-ink-50 font-bold text-ink" style={{ width: taille, height: taille, fontSize: taille >= 34 ? 12 : 10.5 }}>
      {texte}
    </span>
  );
}

export const initialesDe = (prenom?: string | null, nom?: string | null) => `${(prenom ?? '').replace(/^TEST — /, '').charAt(0)}${(nom ?? '').charAt(0)}`.toUpperCase();

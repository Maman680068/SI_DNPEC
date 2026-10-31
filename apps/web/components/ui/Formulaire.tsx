'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Paperclip, Search, X } from 'lucide-react';
import { BTN_PRINCIPAL, BTN_SECONDAIRE } from './Charte';
import { messageErreur } from './Toast';

/**
 * Formulaires de l'application (refonte, étape 9, maquettes `apres-form-tache` et `apres-form-conge`) :
 * fenêtre large en deux colonnes, champs validés dans la fenêtre avant l'envoi, date en français avec
 * calendrier et raccourcis, zone de dépôt de fichiers, sélecteur de personnes avec recherche et
 * étiquettes, choix en un clic, bouton principal à droite.
 *
 * Validation : à l'envoi, chaque champ obligatoire (`required`) vide ou invalide reçoit un message
 * sous lui (« Ce champ est obligatoire. »), le premier est mis au point et rien n'est envoyé ;
 * `valider` ajoute des règles propres au formulaire ({ idDuChamp: 'message' }). Les messages de
 * l'API (refus métier) s'affichent en bas de la fenêtre, jamais un message technique.
 */

type Erreurs = Record<string, string>;
const ContexteFormulaire = createContext<{ erreurs: Erreurs; effacer: (id: string) => void } | null>(null);

/** Message d'erreur d'un champ (validation de la fenêtre), ou celui passé explicitement. */
function useErreurChamp(id: string | undefined, erreur?: string | null): string | null {
  const c = useContext(ContexteFormulaire);
  return erreur ?? (id && c?.erreurs[id]) ?? null;
}
function useEffacerErreur(id: string | undefined) {
  const c = useContext(ContexteFormulaire);
  return useCallback(() => id && c?.effacer(id), [c, id]);
}

const MESSAGES: [keyof ValidityState, string][] = [
  ['valueMissing', 'Ce champ est obligatoire.'],
  ['typeMismatch', 'Le format n’est pas valide.'],
  ['tooShort', 'Le texte est trop court.'],
  ['tooLong', 'Le texte est trop long.'],
  ['rangeUnderflow', 'La valeur est trop petite.'],
  ['rangeOverflow', 'La valeur est trop grande.'],
  ['stepMismatch', 'La valeur n’est pas valide.'],
  ['patternMismatch', 'Le format n’est pas valide.'],
  ['badInput', 'La valeur n’est pas valide.'],
];

function erreursNatives(form: HTMLFormElement): Erreurs {
  const e: Erreurs = {};
  for (const el of Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
    if (!('validity' in el) || el.validity.valid || el.disabled) continue;
    const id = el.dataset.champ || el.id;
    if (!id || e[id]) continue;
    if (el.validity.customError) {
      e[id] = el.validationMessage;
      continue;
    }
    const libre = el.dataset.messageObligatoire;
    const m = MESSAGES.find(([k]) => el.validity[k]);
    e[id] = m?.[0] === 'valueMissing' && libre ? libre : m?.[1] ?? 'La valeur n’est pas valide.';
  }
  return e;
}

/**
 * Fenêtre de formulaire : en-tête (titre, sous-titre, croix), contenu qui défile, pied avec une
 * phrase d'explication à gauche et « Annuler » puis le bouton principal à droite.
 */
export function FenetreFormulaire({
  titre,
  sousTitre,
  children,
  onClose,
  onSubmit,
  libelleValider = 'Enregistrer',
  enCours = false,
  erreur,
  largeur = 880,
  danger = false,
  pied,
  valider,
  testid,
  sansPied = false,
}: {
  titre: string;
  sousTitre?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  onSubmit?: () => void | Promise<void>;
  libelleValider?: string;
  enCours?: boolean;
  erreur?: string | null;
  largeur?: number;
  danger?: boolean;
  /** Phrase d'explication en bas à gauche (qui est prévenu, délai…). */
  pied?: ReactNode;
  /** Règles propres au formulaire : { idDuChamp: message } pour chaque champ en défaut (undefined = valide). */
  valider?: () => Record<string, string | null | undefined | false>;
  testid?: string;
  sansPied?: boolean;
}) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const effacer = useCallback((id: string) => setErreurs((e) => (e[id] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)) : e)), []);
  const contexte = useMemo(() => ({ erreurs, effacer }), [erreurs, effacer]);
  // Un champ retiré du formulaire (choix qui change les champs affichés) emporte son message : un
  // message déjà vu affiché puis disparu est oublié, et « Vérifiez les champs… » avec lui.
  const vus = useRef(new Set<string>());
  useEffect(() => {
    const ids = Object.keys(erreurs);
    if (!ids.length || !boite.current) return;
    const affiche = (id: string) => !!boite.current!.querySelector(`[id="${CSS.escape(id)}-erreur"], [data-erreur-de="${CSS.escape(id)}"]`);
    const retires = ids.filter((id) => {
      if (affiche(id)) {
        vus.current.add(id);
        return false;
      }
      return vus.current.has(id);
    });
    if (retires.length) {
      retires.forEach((id) => vus.current.delete(id));
      setErreurs((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !retires.includes(k))));
    }
  });

  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      // Échap ferme d'abord un calendrier ou une liste ouverts (ils l'arrêtent), puis la fenêtre.
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', echap);
    boite.current?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not(.sr-only), select, textarea, button:not([aria-label="Fermer"])')?.focus();
    return () => window.removeEventListener('keydown', echap);
  }, [onClose]);

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onSubmit) return;
    const propres = Object.fromEntries(Object.entries(valider?.() ?? {}).filter((x): x is [string, string] => typeof x[1] === 'string' && x[1] !== ''));
    const toutes: Erreurs = { ...erreursNatives(e.currentTarget), ...propres };
    vus.current.clear();
    setErreurs(toutes);
    const premier = Object.keys(toutes)[0];
    if (premier) {
      const cible = boite.current?.querySelector<HTMLElement>(`[data-cible-champ="${CSS.escape(premier)}"]`) ?? document.getElementById(premier);
      cible?.focus();
      return;
    }
    void onSubmit();
  }

  const corps = (
    <>
      <div className="flex items-start gap-4 border-b border-line px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={idTitre} className="font-heading text-[19px] font-extrabold leading-tight text-ink-900 sm:text-[21px]">
            {titre}
          </h2>
          {sousTitre && <div className="mt-1 text-[13px] text-text-muted">{sousTitre}</div>}
        </div>
        <button type="button" aria-label="Fermer" onClick={onClose} className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-line text-text-muted hover:bg-bg">
          <X aria-hidden size={17} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      {!sansPied && (
        <div className="border-t border-line bg-fond-doux px-5 py-3.5 sm:px-6">
          {Object.keys(erreurs).length > 0 && !erreur && (
            <div role="alert" data-testid="erreurs-champs" className="mb-3 text-[13px] font-semibold text-clay">
              Vérifiez les champs signalés en rouge.
            </div>
          )}
          {erreur && (
            <div role="alert" data-testid="erreur-formulaire" className="mb-3 rounded-[9px] border border-clay-bord bg-clay-50 px-3 py-2.5 text-[13px] font-semibold text-clay">
              {messageErreur(new Error(erreur))}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-muted">{pied}</div>
            <div className="flex flex-none justify-end gap-2.5">
              <button type="button" className={BTN_SECONDAIRE} onClick={onClose}>
                {onSubmit ? 'Annuler' : 'Fermer'}
              </button>
              {onSubmit && (
                <button type="submit" disabled={enCours} className={`${BTN_PRINCIPAL} ${danger ? '!bg-clay hover:!bg-clay' : ''}`}>
                  {!danger && <Check aria-hidden size={16} strokeWidth={2.5} />}
                  {enCours ? 'Enregistrement…' : libelleValider}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        data-testid={testid}
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_24px_60px_rgba(18,28,77,0.35)] sm:max-h-[90vh] sm:rounded-2xl"
        style={{ maxWidth: largeur }}
      >
        <ContexteFormulaire.Provider value={contexte}>
          {onSubmit ? (
            <form noValidate onSubmit={soumettre} className="flex min-h-0 flex-1 flex-col">
              {corps}
            </form>
          ) : (
            corps
          )}
        </ContexteFormulaire.Provider>
      </div>
    </div>
  );
}

/** Message d'erreur de la fenêtre pour un champ qui n'utilise pas `Champ` (anciens composants). */
export function MessageErreurChamp({ id }: { id?: string }) {
  const message = useErreurChamp(id);
  if (!message) return null;
  return (
    <p id={`${id}-erreur`} className="mt-1 text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
      {message}
    </p>
  );
}

/** Deux colonnes sur ordinateur, une sur téléphone. */
export function Grille2({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-x-4 sm:grid-cols-2 ${className}`}>{children}</div>;
}

export const CLASSE_SAISIE =
  'w-full rounded-[10px] border bg-surface px-3 text-[14px] text-text placeholder:text-text-faint focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 disabled:bg-bg';

/** Champ avec libellé, mention « (facultatif) », aide et message d'erreur sous le champ. */
export function Champ({
  id,
  label,
  facultatif,
  aide,
  erreur,
  children,
  className = '',
}: {
  id?: string;
  label: ReactNode;
  facultatif?: boolean;
  aide?: ReactNode;
  erreur?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const message = useErreurChamp(id, erreur);
  return (
    <div className={`mb-3.5 min-w-0 ${className}`} data-champ-erreur={message ? 'oui' : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
        {label}
        {facultatif && <span className="font-normal text-text-muted"> (facultatif)</span>}
      </label>
      {children}
      {aide && !message && <p className="mt-1 text-[12px] text-text-muted">{aide}</p>}
      {message && (
        <p id={id ? `${id}-erreur` : undefined} className="mt-1 text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
          {message}
        </p>
      )}
    </div>
  );
}

/** Attributs d'accessibilité d'une saisie reliée à son message d'erreur. */
export function useSaisie(id: string, erreur?: string | null) {
  const message = useErreurChamp(id, erreur);
  const effacer = useEffacerErreur(id);
  return {
    'aria-invalid': message ? true : undefined,
    'aria-describedby': message ? `${id}-erreur` : undefined,
    className: `${CLASSE_SAISIE} ${message ? 'border-clay' : 'border-line'}`,
    onInput: effacer,
  } as const;
}

/** Zone de texte d'une ligne (input) avec libellé et validation. */
export function Saisie({
  id,
  label,
  value,
  onChange,
  facultatif,
  required,
  placeholder,
  type = 'text',
  aide,
  maxLength,
  min,
  max,
  step,
  inputMode,
  messageObligatoire,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  facultatif?: boolean;
  required?: boolean;
  placeholder?: string;
  type?: 'text' | 'email' | 'number' | 'time' | 'tel' | 'password';
  aide?: ReactNode;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number | 'any';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  messageObligatoire?: string;
}) {
  const a = useSaisie(id);
  return (
    <Champ id={id} label={label} facultatif={facultatif} aide={aide}>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        data-message-obligatoire={messageObligatoire}
        onChange={(e) => onChange(e.target.value)}
        {...a}
        className={`${a.className} h-10`}
      />
    </Champ>
  );
}

/** Texte sur plusieurs lignes avec libellé et validation. */
export function ZoneTexte({
  id,
  label,
  value,
  onChange,
  facultatif,
  required,
  placeholder,
  lignes = 3,
  maxLength,
  messageObligatoire,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  facultatif?: boolean;
  required?: boolean;
  placeholder?: string;
  lignes?: number;
  maxLength?: number;
  messageObligatoire?: string;
}) {
  const a = useSaisie(id);
  return (
    <Champ id={id} label={label} facultatif={facultatif}>
      <textarea
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        rows={lignes}
        maxLength={maxLength}
        data-message-obligatoire={messageObligatoire}
        onChange={(e) => onChange(e.target.value)}
        {...a}
        className={`${a.className} py-2.5`}
      />
    </Champ>
  );
}

/** Liste déroulante avec libellé et validation. */
export function Liste({
  id,
  label,
  value,
  onChange,
  options,
  vide,
  facultatif,
  required,
  messageObligatoire,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  vide?: string;
  facultatif?: boolean;
  required?: boolean;
  messageObligatoire?: string;
}) {
  const a = useSaisie(id);
  return (
    <Champ id={id} label={label} facultatif={facultatif}>
      <select id={id} value={value} required={required} data-message-obligatoire={messageObligatoire} onChange={(e) => { onChange(e.target.value); a.onInput(); }} {...a} className={`${a.className} h-10`}>
        {vide !== undefined && <option value="">{vide}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Champ>
  );
}

// ------------------------------------------------------------------ choix en un clic

/** Choix en un clic (priorité, type de congé…) : groupe de boutons radio, flèches au clavier. */
export function ChoixSegment<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  required,
}: {
  id: string;
  label: ReactNode;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
  required?: boolean;
}) {
  const message = useErreurChamp(id);
  const effacer = useEffacerErreur(id);
  const idLabel = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const actif = Math.max(0, options.findIndex((o) => o.value === value));
  function clavier(e: ReactKeyboardEvent, i: number) {
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    const n = (i + pas + options.length) % options.length;
    onChange(options[n]!.value);
    effacer();
    refs.current[n]?.focus();
  }
  return (
    <div className="mb-3.5 min-w-0">
      <div id={idLabel} className="mb-1.5 text-[13px] font-semibold text-text">
        {label}
      </div>
      <div role="radiogroup" aria-labelledby={idLabel} aria-describedby={message ? `${id}-erreur` : undefined} className="flex flex-wrap gap-1.5">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={i === actif ? 0 : -1}
              data-cible-champ={i === actif ? id : undefined}
              onClick={() => {
                onChange(o.value);
                effacer();
              }}
              onKeyDown={(e) => clavier(e, i)}
              className={`h-[38px] min-w-[88px] flex-1 rounded-[9px] border px-3 text-[13px] font-semibold ${on ? 'border-ink bg-ink-50 text-ink' : 'border-line bg-surface text-text-muted hover:bg-bg'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {/* Témoin pour la validation de la fenêtre (choix obligatoire). */}
      {required && <input tabIndex={-1} aria-hidden className="sr-only" required value={value} onChange={() => {}} data-champ={id} />}
      {message && (
        <p id={`${id}-erreur`} className="mt-1 text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
          {message}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ date

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateDe = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a!, m! - 1, j!);
};
/** « jeudi 12 novembre 2026 ». */
export function dateLongue(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = dateDe(iso);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
/** Lit « 2026-11-12 », « 12/11/2026 », « 12-11-2026 », « 12 11 2026 » ; null sinon. */
export function lireDate(texte: string): string | null {
  const t = texte.trim();
  let a: number, m: number, j: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  const fr = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/.exec(t);
  if (iso) [a, m, j] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (fr) [j, m, a] = [Number(fr[1]), Number(fr[2]), Number(fr[3])];
  else return null;
  const d = new Date(a, m - 1, j);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j ? isoDe(d) : null;
}

/**
 * Date en français (AAAA-MM-JJ en valeur) : un champ qui accepte la saisie au clavier (jj/mm/aaaa)
 * et affiche « jeudi 12 novembre 2026 », un calendrier (lundi en premier, flèches, Entrée, Échap)
 * et des raccourcis (Aujourd'hui, Dans 1 semaine, Fin du mois).
 */
const dateCourte = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Date tapée hors des bornes : message sous le champ à l'envoi. */
function messageBornes(min?: string, max?: string): string {
  if (min && max) return `La date doit être comprise entre le ${dateCourte(min)} et le ${dateCourte(max)}.`;
  if (min) return `La date doit être au plus tôt le ${dateCourte(min)}.`;
  return `La date doit être au plus tard le ${dateCourte(max ?? '')}.`;
}

export function ChampDate({
  id,
  label,
  value,
  onChange,
  required,
  facultatif,
  min,
  max,
  raccourcis = true,
  aide,
  messageObligatoire,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  facultatif?: boolean;
  min?: string;
  max?: string;
  raccourcis?: boolean;
  aide?: ReactNode;
  messageObligatoire?: string;
}) {
  const a = useSaisie(id);
  const [focus, setFocus] = useState(false);
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [vue, setVue] = useState(() => (value ? dateDe(value) : new Date()));
  const [actif, setActif] = useState<string>(value || isoDe(new Date()));
  const zone = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const grille = useRef<HTMLDivElement>(null);
  const idCal = useId();
  const horsBornes = (iso: string) => (min && iso < min) || (max && iso > max);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => zone.current && !zone.current.contains(e.target as Node) && setOuvert(false);
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);
  useEffect(() => {
    if (ouvert) grille.current?.querySelector<HTMLButtonElement>(`[data-jour="${actif}"]`)?.focus();
  }, [ouvert, actif]);
  // Texte saisi : recalé sur la valeur tant que le champ n'a pas le focus (pas de mise à jour au focus,
  // qui pourrait écraser une saisie immédiate).
  useEffect(() => {
    if (!focus) setTexte(value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '');
  }, [value, focus]);
  // Calendrier en position fixe : jamais coupé par le défilement d'une fenêtre ; au-dessus du champ
  // quand la place manque en dessous.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!ouvert) return;
    const placer = () => {
      const r = zone.current?.getBoundingClientRect();
      if (!r) return;
      const hauteur = 340;
      const top = r.bottom + 6 + hauteur > window.innerHeight && r.top - 6 - hauteur > 0 ? r.top - 6 - hauteur : r.bottom + 6;
      setPosition({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - 292)) });
    };
    placer();
    window.addEventListener('resize', placer);
    window.addEventListener('scroll', placer, true);
    return () => {
      window.removeEventListener('resize', placer);
      window.removeEventListener('scroll', placer, true);
    };
  }, [ouvert]);

  function choisir(iso: string) {
    if (horsBornes(iso)) return;
    champ.current?.setCustomValidity('');
    onChange(iso);
    a.onInput();
    setOuvert(false);
    champ.current?.focus();
  }
  function ouvrir() {
    const base = value ? dateDe(value) : new Date();
    setVue(new Date(base.getFullYear(), base.getMonth(), 1));
    setActif(value || isoDe(new Date()));
    setOuvert(true);
  }
  function deplacer(jours: number) {
    const d = dateDe(actif);
    d.setDate(d.getDate() + jours);
    const iso = isoDe(d);
    setActif(iso);
    setVue(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function clavierGrille(e: ReactKeyboardEvent) {
    const pas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (pas[e.key] !== undefined) {
      e.preventDefault();
      deplacer(pas[e.key]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.nativeEvent.preventDefault();
      setOuvert(false);
      champ.current?.focus();
    }
  }

  const premier = new Date(vue.getFullYear(), vue.getMonth(), 1);
  const decalage = (premier.getDay() + 6) % 7;
  const debutGrille = new Date(premier);
  debutGrille.setDate(1 - decalage);
  const cases = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille);
    d.setDate(debutGrille.getDate() + i);
    return d;
  });
  const aujourdhui = isoDe(new Date());
  const finMois = (() => {
    const d = new Date();
    return isoDe(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  })();
  const dansSemaine = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return isoDe(d);
  })();

  return (
    <Champ id={id} label={label} facultatif={facultatif} aide={aide}>
      <div ref={zone} className="relative">
        <div className="relative">
          <CalendarDays aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            ref={champ}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="jj/mm/aaaa"
            required={required}
            data-message-obligatoire={messageObligatoire}
            value={focus ? texte : value ? dateLongue(value) : ''}
            onFocus={(e) => {
              // Le texte court remplace la date longue dès le focus, sans attendre le rendu : une
              // sélection faite aussitôt (clavier, saisie automatique) porte sur le bon texte.
              e.currentTarget.value = texte;
              setFocus(true);
            }}
            onBlur={() => setFocus(false)}
            onChange={(e) => {
              setTexte(e.target.value);
              const iso = lireDate(e.target.value);
              e.target.setCustomValidity(iso && horsBornes(iso) ? messageBornes(min, max) : '');
              if (iso && !horsBornes(iso)) onChange(iso);
              else if (iso || !e.target.value.trim()) onChange('');
              a.onInput();
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                ouvrir();
              }
            }}
            aria-invalid={a['aria-invalid']}
            aria-describedby={a['aria-describedby']}
            className={`${a.className} h-10 pl-9 pr-11`}
          />
          <button
            type="button"
            aria-label="Ouvrir le calendrier"
            aria-haspopup="dialog"
            aria-expanded={ouvert}
            aria-controls={ouvert ? idCal : undefined}
            onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-text-muted hover:bg-bg"
          >
            <ChevronRight aria-hidden size={16} className={`transition-transform ${ouvert ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>
        {ouvert && (
          <div id={idCal} role="dialog" aria-label="Choisir une date" style={position ?? undefined} className={`fixed z-[80] w-[284px] rounded-xl border border-line bg-surface p-3 shadow-[0_12px_30px_rgba(18,28,77,0.18)] ${position ? '' : 'invisible'}`} onKeyDown={clavierGrille}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label="Mois précédent" className="grid h-7 w-7 place-items-center rounded-md hover:bg-bg" onClick={() => setVue(new Date(vue.getFullYear(), vue.getMonth() - 1, 1))}>
                <ChevronLeft aria-hidden size={16} />
              </button>
              <b className="text-[13.5px] font-bold text-ink-900" aria-live="polite">
                {MOIS[vue.getMonth()]} {vue.getFullYear()}
              </b>
              <button type="button" aria-label="Mois suivant" className="grid h-7 w-7 place-items-center rounded-md hover:bg-bg" onClick={() => setVue(new Date(vue.getFullYear(), vue.getMonth() + 1, 1))}>
                <ChevronRight aria-hidden size={16} />
              </button>
            </div>
            <div ref={grille} className="grid grid-cols-7 gap-0.5 text-center text-[12px]">
              {JOURS_COURTS.map((j, i) => (
                <span key={i} aria-hidden className="grid h-[22px] place-items-center text-[11px] font-semibold text-text-faint">
                  {j}
                </span>
              ))}
              {cases.map((d) => {
                const iso = isoDe(d);
                const dehors = d.getMonth() !== vue.getMonth();
                const choisi = iso === value;
                const interdit = !!horsBornes(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    data-jour={iso}
                    tabIndex={iso === actif ? 0 : -1}
                    disabled={interdit}
                    aria-label={dateLongue(iso)}
                    aria-pressed={choisi}
                    onClick={() => choisir(iso)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        choisir(iso);
                      }
                    }}
                    className={`grid h-[30px] place-items-center rounded-[7px] ${
                      choisi ? 'bg-ink font-bold text-white' : iso === aujourdhui ? 'border border-ink font-semibold text-ink' : dehors ? 'text-text-faint' : 'text-text hover:bg-bg'
                    } disabled:cursor-not-allowed disabled:opacity-35`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            {raccourcis && (
              <div className="mt-2 flex gap-1.5">
                {[
                  ['Aujourd’hui', aujourdhui],
                  ['Dans 1 semaine', dansSemaine],
                  ['Fin du mois', finMois],
                ].map(([l, iso]) => (
                  <button key={l} type="button" disabled={!!horsBornes(iso!)} onClick={() => choisir(iso!)} className="flex-1 rounded-[7px] bg-ink-50 px-1.5 py-1.5 text-[11.5px] font-bold text-ink hover:bg-fond-gris disabled:opacity-40">
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Champ>
  );
}

// ------------------------------------------------------------------ fichiers

const taille = (o: number) => (o < 1024 ? `${o} o` : o < 1024 * 1024 ? `${Math.round(o / 1024)} Ko` : `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);

/**
 * Zone de dépôt de fichiers : glisser-déposer ou « parcourez votre ordinateur » ; la saisie de
 * fichier reste un vrai champ (libellé, clavier), seulement masqué visuellement.
 */
export function ZoneDepot({
  id,
  label,
  fichiers,
  onChange,
  multiple = false,
  accept,
  facultatif,
  required,
  aide = 'PDF, Word, Excel, images · 25 Mo au plus par fichier',
}: {
  id: string;
  label: ReactNode;
  fichiers: File[];
  onChange: (f: File[]) => void;
  multiple?: boolean;
  accept?: string;
  facultatif?: boolean;
  required?: boolean;
  aide?: string;
}) {
  const message = useErreurChamp(id);
  const effacer = useEffacerErreur(id);
  const saisie = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const ajouter = (liste: FileList | null) => {
    if (!liste?.length) return;
    const nouveaux = Array.from(liste);
    onChange(multiple ? [...fichiers, ...nouveaux] : nouveaux.slice(0, 1));
    effacer();
  };
  const deposer = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    ajouter(e.dataTransfer.files);
  };
  return (
    <div className="mb-3.5 min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
        {label}
        {facultatif && <span className="font-normal text-text-muted"> (facultatif)</span>}
      </label>
      {/* Tout le cadre ouvre le choix du fichier (clic, Entrée, Espace) ; un clic venu d'un bouton ou du
          champ lui-même est ignoré, pour ne jamais ouvrir l'explorateur deux fois. */}
      <div
        role="button"
        tabIndex={0}
        // Nom propre au cadre (sans le libellé du champ, porté par le champ de fichier lui-même).
        aria-label={`Glissez ${multiple ? 'vos fichiers' : 'votre fichier'} ici ou parcourez votre ordinateur`}
        aria-describedby={`${id}-aide`}
        data-testid="zone-depot"
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest('button, input') && t.closest('button, input') !== e.currentTarget) return;
          saisie.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          saisie.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
        className={`flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] border-dashed px-3.5 py-3 hover:border-ink hover:bg-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${survol ? 'border-ink bg-ink-50' : message ? 'border-clay' : 'border-line-fort'}`}
      >
        <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-ink-50 text-ink" data-testid="zone-depot-icone">
          <Paperclip size={17} />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-ink-900">Glissez {multiple ? 'vos fichiers' : 'votre fichier'} ici</span> ou{' '}
          <span className="font-bold text-ink underline-offset-2 hover:underline">parcourez votre ordinateur</span>
          <span id={`${id}-aide`} className="block text-[12px] text-text-muted">{aide}</span>
        </span>
      </div>
      {/* Champ hors du cadre : aucun élément interactif imbriqué dans le bouton. */}
      <input
        ref={saisie}
        id={id}
        type="file"
        tabIndex={-1}
        multiple={multiple}
        accept={accept}
        required={required && fichiers.length === 0}
        aria-describedby={message ? `${id}-erreur` : undefined}
        className="sr-only"
        data-cible-champ={id}
        onChange={(e) => {
          ajouter(e.target.files);
          e.target.value = '';
        }}
      />
      {fichiers.length > 0 && (
        <ul className="mt-2 space-y-1.5" data-testid="fichiers-choisis">
          {fichiers.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-[9px] border border-line px-3 py-2 text-[13px]">
              <FileText aria-hidden size={16} className="flex-none text-text-muted" />
              <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
              <span className="flex-none text-[12px] text-text-muted">{taille(f.size)}</span>
              <button type="button" aria-label={`Retirer ${f.name}`} className="grid h-7 w-7 flex-none place-items-center rounded-md text-text-muted hover:bg-bg" onClick={() => onChange(fichiers.filter((_, j) => j !== i))}>
                <X aria-hidden size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p id={`${id}-erreur`} className="mt-1 text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
          {message}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ personnes

export type Personne = { id: string; nom: string; detail?: string | null };
const initiales = (nom: string) =>
  nom
    .replace(/^TEST\s*[—–-]\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('');

/**
 * Sélecteur de personnes : étiquettes des personnes choisies (avec « Retirer »), recherche avec
 * liste de suggestions (↑ ↓ Entrée, Échap), à la place des cases à cocher. `multiple=false` : une
 * seule personne. Les personnes proposées viennent de l'API (liste des personnes possibles).
 */
export function SelecteurPersonnes({
  id,
  label,
  options,
  valeurs,
  onChange,
  multiple = true,
  facultatif,
  required,
  placeholder = 'Rechercher une personne…',
  aide,
  messageObligatoire,
}: {
  id: string;
  label: ReactNode;
  options: Personne[];
  valeurs: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  facultatif?: boolean;
  required?: boolean;
  placeholder?: string;
  aide?: ReactNode;
  messageObligatoire?: string;
}) {
  const message = useErreurChamp(id);
  const effacer = useEffacerErreur(id);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const zone = useRef<HTMLDivElement>(null);
  const idListe = useId();
  const choisis = valeurs.map((v) => options.find((o) => o.id === v)).filter((p): p is Personne => !!p);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const proposes = options.filter((o) => !valeurs.includes(o.id) && (!q.trim() || norm(`${o.nom} ${o.detail ?? ''}`).includes(norm(q.trim())))).slice(0, 30);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => zone.current && !zone.current.contains(e.target as Node) && setOuvert(false);
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  function prendre(p: Personne) {
    onChange(multiple ? [...valeurs, p.id] : [p.id]);
    effacer();
    setQ('');
    setActif(0);
    if (!multiple) setOuvert(false);
  }
  function clavier(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOuvert(true);
      setActif((a) => Math.min(a + 1, Math.max(0, proposes.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && ouvert) {
      e.preventDefault();
      if (proposes[actif]) prendre(proposes[actif]!);
    } else if (e.key === 'Escape' && ouvert) {
      e.preventDefault();
      e.nativeEvent.preventDefault();
      setOuvert(false);
    } else if (e.key === 'Backspace' && !q && choisis.length) {
      onChange(valeurs.slice(0, -1));
    }
  }

  return (
    <div className="mb-3.5 min-w-0" ref={zone}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
        {label}
        {facultatif && <span className="font-normal text-text-muted"> (facultatif)</span>}
      </label>
      <div className={`relative flex min-h-10 flex-wrap items-center gap-1.5 rounded-[10px] border bg-surface px-2 py-1.5 focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15 ${message ? 'border-clay' : 'border-line'}`}>
        {choisis.map((p) => (
          <span key={p.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink-50 py-0.5 pl-1 pr-1.5 text-[12.5px] font-semibold text-ink" data-testid="personne-choisie">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-surface text-[9.5px] font-bold">
              {initiales(p.nom)}
            </span>
            <span className="truncate">{p.nom}</span>
            <button type="button" aria-label={`Retirer ${p.nom}`} onClick={() => onChange(valeurs.filter((v) => v !== p.id))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-surface">
              <X aria-hidden size={12} />
            </button>
          </span>
        ))}
        {(multiple || choisis.length === 0) && (
          <span className="relative flex min-w-[160px] flex-1 items-center">
            <Search aria-hidden size={14} className="pointer-events-none absolute left-1 text-text-faint" />
            <input
              id={id}
              role="combobox"
              aria-expanded={ouvert}
              aria-controls={idListe}
              aria-autocomplete="list"
              aria-activedescendant={ouvert && proposes[actif] ? `${idListe}-${proposes[actif]!.id}` : undefined}
              aria-describedby={message ? `${id}-erreur` : undefined}
              aria-invalid={message ? true : undefined}
              autoComplete="off"
              value={q}
              placeholder={placeholder}
              onChange={(e) => {
                setQ(e.target.value);
                setOuvert(true);
                setActif(0);
              }}
              onMouseDown={() => setOuvert(true)}
              onKeyDown={clavier}
              className="h-7 w-full bg-transparent pl-6 text-[13.5px] text-text placeholder:text-text-faint focus:outline-none"
            />
          </span>
        )}
        {required && <input tabIndex={-1} aria-hidden className="sr-only" required value={valeurs.join(',')} onChange={() => {}} data-champ={id} data-message-obligatoire={messageObligatoire ?? 'Choisissez au moins une personne.'} />}
        {ouvert && (
          <ul id={idListe} role="listbox" aria-label="Personnes proposées" className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-[240px] overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-[0_12px_30px_rgba(18,28,77,0.18)]">
            {proposes.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-text-muted">{options.length === valeurs.length ? 'Toutes les personnes sont choisies.' : 'Aucune personne ne correspond.'}</li>
            ) : (
              proposes.map((p, i) => (
                <li
                  key={p.id}
                  id={`${idListe}-${p.id}`}
                  role="option"
                  aria-selected={i === actif}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    prendre(p);
                  }}
                  onMouseEnter={() => setActif(i)}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${i === actif ? 'bg-ink-50' : ''}`}
                >
                  <span aria-hidden className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink-50 text-[10.5px] font-bold text-ink">
                    {initiales(p.nom)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold">{p.nom}</b>
                    {p.detail && <span className="block truncate text-[12px] text-text-muted">{p.detail}</span>}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {aide && !message && <p className="mt-1 text-[12px] text-text-muted">{aide}</p>}
      {message && (
        <p id={`${id}-erreur`} className="mt-1 text-[12.5px] font-semibold text-clay" data-testid="erreur-champ">
          {message}
        </p>
      )}
    </div>
  );
}

/** Case à cocher avec libellé (même style que la maquette). */
export function Case({ id, label, checked, onChange }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5 text-[13.5px]">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-ink" />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

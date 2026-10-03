'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Vrai si cette fenêtre est la dernière fenêtre modale ouverte (une fenêtre ouverte depuis elle passe devant). */
function auPremierPlan(boite: HTMLElement | null): boolean {
  const modales = document.querySelectorAll('[aria-modal="true"]');
  return !!boite && modales[modales.length - 1] === boite;
}

/**
 * Fenêtre de détail centrée (refonte de l'interface), qui remplace les panneaux latéraux : 960 px
 * au plus, fond assombri, fermeture par la croix, Échap ou un clic sur le fond, focus gardé dans la
 * fenêtre (et rendu à l'élément d'origine à la fermeture), plein écran sur téléphone.
 *
 * - `titre` + `filAriane` + `entete` : en-tête de la maquette (fil d'Ariane, titre, étapes…).
 * - `sansEntete` : le contenu porte déjà son titre et sa croix (panneaux migrés tels quels) ;
 *   `titre` sert alors de nom accessible.
 * - `cote` : colonne de droite (actions, informations), 290 px sur grand écran.
 */
export function FenetreDetail({
  titre,
  onClose,
  children,
  filAriane,
  entete,
  cote,
  largeur = 960,
  sansEntete = false,
  testid,
}: {
  titre: string;
  onClose: () => void;
  children: ReactNode;
  filAriane?: (string | null | undefined)[];
  entete?: ReactNode;
  cote?: ReactNode;
  largeur?: number;
  sansEntete?: boolean;
  testid?: string;
}) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  const fermer = useRef(onClose);
  fermer.current = onClose;

  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null;
    // Focus initial : la fenêtre elle-même (le lecteur d'écran annonce son titre).
    boite.current?.focus();
    const clavier = (e: KeyboardEvent) => {
      if (!auPremierPlan(boite.current)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        fermer.current();
        return;
      }
      if (e.key !== 'Tab' || !boite.current) return;
      const elements = [...boite.current.querySelectorAll<HTMLElement>(FOCALISABLES)].filter((el) => el.offsetParent !== null);
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }
      const premier = elements[0]!;
      const dernier = elements[elements.length - 1]!;
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || actif === boite.current)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      } else if (!boite.current.contains(actif)) {
        e.preventDefault();
        premier.focus();
      }
    };
    window.addEventListener('keydown', clavier);
    return () => {
      window.removeEventListener('keydown', clavier);
      if (origine && document.contains(origine)) origine.focus();
    };
  }, []);

  const ariane = (filAriane ?? []).filter((x): x is string => !!x);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgba(18,28,77,0.45)] backdrop-blur-[2px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={sansEntete ? undefined : idTitre}
        aria-label={sansEntete ? titre : undefined}
        tabIndex={-1}
        data-testid={testid ?? 'fenetre-detail'}
        className="flex h-full w-full flex-col overflow-hidden bg-surface shadow-[0_24px_60px_rgba(18,28,77,0.35)] outline-none sm:h-auto sm:max-h-[min(820px,calc(100vh-48px))] sm:rounded-2xl"
        style={{ maxWidth: largeur }}
      >
        {sansEntete ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-5 sm:px-[26px] sm:pt-[22px]">{children}</div>
        ) : (
          <>
            <div className="flex-none border-b border-line px-5 pb-4 pt-5 sm:px-6">
              {ariane.length > 0 && (
                <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-muted">
                  {ariane.map((x, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight aria-hidden size={13} />}
                      {x}
                    </span>
                  ))}
                </nav>
              )}
              <div className="mt-1.5 flex items-start gap-4">
                <h2 id={idTitre} className="flex-1 font-heading text-[19px] font-extrabold leading-tight text-ink-900 sm:text-[21px]">
                  {titre}
                </h2>
                <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-line text-text-muted hover:bg-bg">
                  <X aria-hidden size={18} />
                </button>
              </div>
              {entete}
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto ${cote ? 'md:grid md:grid-cols-[minmax(0,1fr)_290px] md:overflow-hidden' : ''}`}>
              <div className={`px-5 py-[18px] sm:px-6 ${cote ? 'md:overflow-y-auto md:border-r md:border-line' : ''}`}>{children}</div>
              {cote && <div className="border-t border-line bg-[#FAFBFD] px-5 py-[18px] md:overflow-y-auto md:border-t-0">{cote}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

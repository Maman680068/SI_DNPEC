'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';

const MODULES = [
  { icon: '✎', title: 'Tâches', description: 'Suivi de bout en bout, avec validation hiérarchique.' },
  { icon: '✉', title: 'Communication', description: 'Messagerie directe et annonces internes.' },
  { icon: '🌴', title: 'Congés', description: 'Demandes et suivi des soldes par agent.' },
  { icon: '🗂', title: 'Archives', description: 'Documents classés par division, publiés ou privés.' },
  { icon: '☰', title: 'Annuaire', description: 'Tout le personnel, relié à l’organigramme.' },
];

/** Taille fluide : `n` px sur l'écran de référence 1920×1080 de la maquette validée,
 * réduite proportionnellement (unité --u de globals.css, classe .accueil), jamais sous `min`. */
const f = (n: number, min: number) => `clamp(${min}px, calc(${n} * var(--u)), ${n}px)`;

const CTA_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors';

/**
 * Accueil public, compact : exactement la hauteur de la fenêtre sur ordinateur (≥ 900px de
 * large), sans défilement — bande tricolore, en-tête, zone centrale aux blocs répartis
 * régulièrement, pied de page sur une ligne. Téléphone et tablette : défilement autorisé,
 * cartes sur 2 colonnes (1 sous 480px), pied de page empilé.
 */
export default function RootPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  // Rien pendant le chargement initial ou juste avant la redirection d'un
  // utilisateur déjà connecté — évite un flash de la page publique pour lui.
  if (status !== 'unauthenticated') return null;

  const gouttiere = { paddingLeft: f(80, 16), paddingRight: f(80, 16) };

  return (
    <div className="accueil flex min-h-[100dvh] flex-col bg-bg min-[900px]:h-[100dvh] min-[900px]:overflow-hidden">
      <div className="flag-stripe shrink-0">
        <span className="flag-r" />
        <span className="flag-y" />
        <span className="flag-g" />
      </div>

      <header
        className="flex shrink-0 items-center justify-between gap-4"
        style={{ ...gouttiere, paddingTop: f(22, 14), paddingBottom: f(22, 14) }}
      >
        <div className="flex items-center" style={{ gap: f(16, 10) }}>
          <img
            src="/logo-dnpec.png"
            alt="DNPEC"
            className="flex-shrink-0 object-contain"
            style={{ height: f(60, 40), width: f(60, 40) }}
          />
          <div>
            <div className="font-semibold tracking-wide text-text-faint" style={{ fontSize: f(15, 11) }}>
              RÉPUBLIQUE DE GUINÉE
            </div>
            <div className="font-heading font-bold text-ink" style={{ fontSize: f(22, 14) }}>
              DNPEC · Système Interne
            </div>
          </div>
        </div>
        <Link href="/login" className="whitespace-nowrap font-semibold text-ink hover:text-accent" style={{ fontSize: f(19, 14) }}>
          Se connecter →
        </Link>
      </header>

      <main
        data-testid="accueil-centre"
        className="flex min-h-0 flex-1 flex-col justify-evenly gap-8 py-6 min-[900px]:gap-0 min-[900px]:py-0"
        style={gouttiere}
      >
        <section className="text-center">
          <h1 className="leading-[1.2] text-ink" style={{ fontSize: f(66, 30) }}>
            La coordination de la Direction,
            <br className="hidden min-[900px]:inline" /> en un seul endroit.
          </h1>
          <p
            className="mx-auto leading-relaxed text-text-muted"
            style={{ fontSize: f(21, 15), marginTop: f(20, 14), maxWidth: f(1060, 640) }}
          >
            Le système d&apos;information interne de la DNPEC réunit la gestion des tâches, la
            communication, les congés et l&apos;archivage électronique des cinq divisions —
            organisé selon la hiérarchie de la Direction.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-center" style={{ gap: f(16, 12) }}>
          <Link
            href="/login"
            className={`${CTA_BASE} border-ink bg-ink text-white hover:bg-ink-dark`}
            style={{ fontSize: f(20, 15), padding: `${f(17, 12)} ${f(40, 26)}` }}
          >
            Se connecter
          </Link>
          <Link
            href="/register"
            className={`${CTA_BASE} border-line bg-surface text-text hover:bg-bg`}
            style={{ fontSize: f(20, 15), padding: `${f(17, 12)} ${f(40, 26)}` }}
          >
            Demander l&apos;accès
          </Link>
        </div>

        <section>
          <div className="text-center font-bold uppercase tracking-wide text-sage" style={{ fontSize: f(14, 11), marginBottom: f(20, 14) }}>
            Modules
          </div>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[900px]:grid-cols-5" style={{ gap: f(26, 12) }}>
            {MODULES.map((m) => (
              <div
                key={m.title}
                data-testid="accueil-module"
                className="rounded-lg border border-line bg-surface text-center"
                style={{ padding: f(32, 18) }}
              >
                <div className="leading-none" style={{ fontSize: f(42, 26), marginBottom: f(14, 10) }}>
                  {m.icon}
                </div>
                <div className="font-heading font-bold text-ink" style={{ fontSize: f(24, 16), marginBottom: f(8, 6) }}>
                  {m.title}
                </div>
                <p className="leading-relaxed text-text-muted" style={{ fontSize: f(17.5, 13) }}>
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer
        className="flex shrink-0 flex-col-reverse gap-3 border-t border-line bg-surface min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-6"
        style={{ ...gouttiere, paddingTop: f(18, 14), paddingBottom: f(18, 14) }}
      >
        <div className="text-text-faint" style={{ fontSize: f(15, 12) }}>
          Cellule des Systèmes d&apos;Informations et de la Digitalisation — CSID
        </div>
        <p className="border-l-[3px] border-gold pl-4 leading-relaxed text-text-muted" style={{ fontSize: f(16, 13) }}>
          « Ce qui se conçoit bien s&apos;énonce clairement — et se suit encore mieux. »
        </p>
      </footer>
    </div>
  );
}

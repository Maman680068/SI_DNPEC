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

const CTA_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 text-[14.5px] font-semibold transition-colors';

export default function RootPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  // Rien pendant le chargement initial ou juste avant la redirection d'un
  // utilisateur déjà connecté — évite un flash de la page publique pour lui.
  if (status !== 'unauthenticated') return null;

  return (
    <div className="min-h-screen bg-bg">
      <div className="flag-stripe">
        <span className="flag-r" />
        <span className="flag-y" />
        <span className="flag-g" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-md bg-ink font-heading text-base font-extrabold text-white">
            DN
          </div>
          <div>
            <div className="text-[11.5px] font-semibold tracking-wide text-text-faint">RÉPUBLIQUE DE GUINÉE</div>
            <div className="font-heading text-sm font-bold text-ink">DNPEC · Système Interne</div>
          </div>
        </div>
        <Link href="/login" className="text-[13.5px] font-semibold text-ink hover:text-accent">
          Se connecter →
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-6 md:px-10 md:pt-14">
        <section className="mx-auto max-w-[640px] text-center">
          <h1 className="mb-5 text-[34px] leading-tight text-ink md:text-[42px]">
            La coordination de la Direction, en un seul endroit.
          </h1>
          <p className="mb-9 text-[15.5px] leading-relaxed text-text-muted">
            Le système d&apos;information interne de la DNPEC réunit la gestion des tâches, la
            communication, les congés et l&apos;archivage électronique des cinq divisions —
            organisé selon la hiérarchie de la Direction.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className={`${CTA_BASE} border-ink bg-ink text-white hover:bg-ink-dark`}>
              Se connecter
            </Link>
            <Link href="/register" className={`${CTA_BASE} border-line bg-surface text-text hover:bg-bg`}>
              Demander l&apos;accès
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-8 text-center text-[11px] font-bold uppercase tracking-wide text-sage">Modules</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map((m) => (
              <div key={m.title} className="rounded-lg border border-line bg-surface p-5 text-center">
                <div className="mb-3 text-2xl">{m.icon}</div>
                <div className="mb-1.5 font-heading text-[14px] font-bold text-ink">{m.title}</div>
                <p className="text-[12.5px] leading-relaxed text-text-muted">{m.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface py-8">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <p className="mx-auto mb-3 max-w-[440px] border-l-[3px] border-gold pl-4 text-[13px] leading-relaxed text-text-muted">
            « Ce qui se conçoit bien s&apos;énonce clairement — et se suit encore mieux. »
          </p>
          <div className="text-[12px] text-text-faint">
            Cellule des Systèmes d&apos;Informations et de la Digitalisation — CSID
          </div>
        </div>
      </footer>
    </div>
  );
}

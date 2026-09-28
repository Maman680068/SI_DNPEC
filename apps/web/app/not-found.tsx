import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page introuvable · DNPEC' };

/** Adresse inconnue (lien mal copié, page supprimée) : page à l'identité DNPEC, en français. */
export default function PageIntrouvable() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flag-stripe">
        <span className="flag-r" />
        <span className="flag-y" />
        <span className="flag-g" />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[460px] rounded-[18px] bg-surface p-8 text-center shadow-[0_20px_40px_-12px_rgba(27,42,107,0.14)] sm:p-10">
          <img src="/logo-dnpec.png" alt="DNPEC" className="mx-auto mb-4 h-[64px] w-[64px] object-contain" />
          <div className="mb-1 text-[11.5px] font-semibold tracking-wide text-text-faint">
            DNPEC · Système Interne
          </div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-sage">Erreur 404</div>
          <h1 className="mb-3 text-[24px] font-extrabold text-ink">Page introuvable</h1>
          <p className="mb-7 text-[14px] leading-relaxed text-text-muted">
            L&apos;adresse demandée n&apos;existe pas ou n&apos;est plus disponible. Vérifiez le lien, ou
            repartez du tableau de bord.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-ink bg-ink px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-ink-dark"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </main>
      <p className="pb-4 text-center text-[11.5px] text-text-faint">
        Ministère de l&apos;Économie, des Finances et du Budget · République de Guinée
      </p>
    </div>
  );
}

import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden">
      <div className="absolute left-0 right-0 top-0 z-10">
        <div className="flag-stripe">
          <span className="flag-r" />
          <span className="flag-y" />
          <span className="flag-g" />
        </div>
      </div>

      {/* Hauteur ancrée à l'écran et scroll propre — indépendant du panneau de
       * droite, qui peut être bien plus long (ex. /register) sans l'étirer. */}
      <div className="relative hidden h-full flex-[1.1] flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-line bg-surface p-16 text-ink md:flex">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo-dnpec.png" alt="DNPEC" className="h-[42px] w-[42px] flex-shrink-0 object-contain" />
          <div>
            <div className="text-[11.5px] font-semibold tracking-wide text-text-faint">
              RÉPUBLIQUE DE GUINÉE
            </div>
            <div className="font-heading text-sm font-bold text-ink">DNPEC · Système Interne</div>
          </div>
        </Link>

        <div className="relative z-10 max-w-[440px]">
          <h1 className="mb-4 text-4xl leading-tight text-ink">
            La coordination de la Direction, en un seul endroit.
          </h1>
          <p className="text-[15px] leading-relaxed text-text-muted">
            Tâches, communication et archives des cinq divisions, organisées selon la hiérarchie
            de la DNPEC.
          </p>
        </div>

        <div>
          <div className="max-w-[360px] border-l-[3px] border-gold pl-4 text-[13.5px] leading-relaxed text-text-muted">
            « Ce qui se conçoit bien s&apos;énonce clairement — et se suit encore mieux. »
          </div>
          <div className="mt-9 text-[12.5px] text-text-faint">
            Cellule des Systèmes d&apos;Informations et de la Digitalisation — CSID
          </div>
        </div>
      </div>

      {/* Défile seul quand le formulaire (ex. /register) dépasse la hauteur de
       * l'écran — le wrapper interne min-h-full centre verticalement les
       * formulaires courts (/login, /forgot-password) sans gêner ce scroll. */}
      <div className="h-full flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center p-12">
          <div className="w-full max-w-[360px]">
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-faint hover:text-ink md:hidden"
            >
              ← Retour à l&apos;accueil
            </Link>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

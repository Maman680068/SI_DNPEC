export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen">
      <div className="absolute left-0 right-0 top-0 z-10">
        <div className="flag-stripe">
          <span className="flag-r" />
          <span className="flag-y" />
          <span className="flag-g" />
        </div>
      </div>

      <div className="relative hidden flex-[1.1] flex-col justify-between overflow-hidden border-r border-line bg-surface p-16 text-ink md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-md bg-ink font-heading text-base font-extrabold text-white">
            DN
          </div>
          <div>
            <div className="text-[11.5px] font-semibold tracking-wide text-text-faint">
              RÉPUBLIQUE DE GUINÉE
            </div>
            <div className="font-heading text-sm font-bold text-ink">DNPEC · Système Interne</div>
          </div>
        </div>

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

      <div className="flex flex-1 items-center justify-center p-12">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}

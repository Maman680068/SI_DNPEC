'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api/client';
import guidesData from '../../../lib/aide/guides.json';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Barre } from '../../../components/ui/Squelette';
import { EnTetePage } from '../../../components/ui/Charte';

type Section = { titre: string; etapes: string[]; capture?: string };
type Guide = { cle: string; titre: string; pour: string; profils: string[]; sections: Section[] };
const GUIDES = (guidesData as { guides: Guide[] }).guides;

/**
 * Aide en ligne : un guide par profil. Les profils (rôle propre et
 * habilitations) viennent de l'API ; chacun ne voit que ses guides, plus les
 * « Premiers pas » communs. Même contenu que le PDF imprimable (docs/).
 */
export default function AidePage() {
  const [profils, setProfils] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ profils: string[] }>('/aide/profils')
      .then((r) => setProfils(r.profils))
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  const guides = useMemo(() => (profils ? GUIDES.filter((g) => g.profils.includes('TOUS') || g.profils.some((p) => profils.includes(p))) : []), [profils]);

  return (
    <div className="max-w-[900px]">
      <EnTetePage titre="Guides d’utilisation" />
      <ErreurChargement message={erreur} />
      <p className="-mt-1.5 mb-4 text-[13px] text-text-muted">Les guides ci-dessous correspondent à votre profil. Chaque étape indique le bouton ou le menu à utiliser.</p>
      {!profils ? (
        !erreur && (
          <div role="status" aria-label="Chargement en cours" data-testid="squelette">
            <span className="sr-only">Chargement en cours</span>
            <div aria-hidden className="mb-5 flex flex-wrap gap-2">
              {['w-[120px]', 'w-[150px]', 'w-[110px]'].map((l) => (
                <Barre key={l} className={`h-9 rounded-[9px] ${l}`} />
              ))}
            </div>
            {[0, 1].map((n) => (
              <div key={n} aria-hidden className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-5">
                <Barre className="h-4 w-[35%]" />
                <Barre className="h-2.5 w-[55%]" />
                <Barre className="mt-4 h-3 w-[30%]" />
                <Barre className="h-2.5 w-[80%]" />
                <Barre className="h-2.5 w-[72%]" />
                <Barre className="h-2.5 w-[64%]" />
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <nav className="mb-5 flex flex-wrap gap-2" aria-label="Guides">
            {guides.map((g) => (
              <a key={g.cle} href={`#${g.cle}`} className="inline-flex h-9 items-center rounded-[9px] border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-bg">
                {g.titre}
              </a>
            ))}
          </nav>
          {guides.map((g) => (
            <article key={g.cle} id={g.cle} className="mb-4 scroll-mt-4 rounded-xl border border-line bg-surface p-5" data-testid={`guide-${g.cle}`}>
              <h2 className="font-heading text-[17px] font-bold text-ink-900">{g.titre}</h2>
              <p className="mb-4 text-[12.5px] text-text-muted">{g.pour}</p>
              {g.sections.map((s) => (
                <section key={s.titre} className="mb-5 last:mb-0">
                  <h3 className="mb-2 text-[14px] font-bold text-ink-900">{s.titre}</h3>
                  <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed">
                    {s.etapes.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ol>
                  {s.capture && (
                    <img src={`/aide/${s.capture}`} alt={`Capture d’écran : ${s.titre}`} loading="lazy" className="w-full rounded-[10px] border border-line" />
                  )}
                </section>
              ))}
            </article>
          ))}
        </>
      )}
    </div>
  );
}

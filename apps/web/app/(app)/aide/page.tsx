'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api/client';
import guidesData from '../../../lib/aide/guides.json';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

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
      <ErreurChargement message={erreur} />
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Aide</div>
      <h1 className="mb-2 text-[22px] font-extrabold">Guides d’utilisation</h1>
      <p className="mb-5 text-[13px] text-text-muted">Les guides ci-dessous correspondent à votre profil. Chaque étape indique le bouton ou le menu à utiliser.</p>
      {!profils ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          <nav className="mb-6 flex flex-wrap gap-2" aria-label="Guides">
            {guides.map((g) => (
              <a key={g.cle} href={`#${g.cle}`} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-accent hover:bg-bg">
                {g.titre}
              </a>
            ))}
          </nav>
          {guides.map((g) => (
            <article key={g.cle} id={g.cle} className="mb-8 scroll-mt-4 rounded-lg border border-line bg-surface p-5" data-testid={`guide-${g.cle}`}>
              <h2 className="text-[18px] font-extrabold">{g.titre}</h2>
              <p className="mb-4 text-[12.5px] text-text-muted">{g.pour}</p>
              {g.sections.map((s) => (
                <section key={s.titre} className="mb-5 last:mb-0">
                  <h3 className="mb-2 text-[14.5px] font-bold">{s.titre}</h3>
                  <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed">
                    {s.etapes.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ol>
                  {s.capture && (
                    <img src={`/aide/${s.capture}`} alt={`Capture d’écran : ${s.titre}`} loading="lazy" className="w-full rounded-md border border-line" />
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

import Link from 'next/link';
import type { ChiffreTableau } from '../../lib/api/tableau-de-bord';

const TON: Record<ChiffreTableau['ton'], string> = { encre: 'text-ink', rouge: 'text-clay', ambre: 'text-ambre-vif', vert: 'text-sage' };

/**
 * Bande des quatre chiffres du tableau de bord (refonte, maquette du tableau de bord) : chiffres choisis
 * et calculés par l'API selon le profil (Direction, DRH, administrateur, assistant, chef, chargé
 * d'études et stagiaire) ; chacun ouvre la page concernée quand la personne y a accès.
 */
export function BandeChiffres({ chiffres }: { chiffres: ChiffreTableau[] }) {
  return (
    <div data-testid="bande-compteurs" className="mb-[18px] grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-4">
      {chiffres.map((k, i) => {
        const classe = `flex items-center gap-3.5 px-[18px] py-3.5 ${k.lien ? 'hover:bg-bg' : ''} ${i % 2 ? '' : 'border-r'} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 3 ? '' : 'lg:border-r'} border-line`;
        const contenu = (
          <>
            <span className={`min-w-[30px] whitespace-nowrap font-heading text-[28px] font-extrabold leading-none ${TON[k.ton]}`}>{k.valeur ?? '—'}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-text">{k.libelle}</span>
              <span className="block text-[12.5px] text-text-muted">{k.sous}</span>
            </span>
          </>
        );
        return k.lien ? (
          <Link key={k.cle} href={k.lien} className={classe} data-testid={`chiffre-${k.cle}`}>
            {contenu}
          </Link>
        ) : (
          <div key={k.cle} className={classe} data-testid={`chiffre-${k.cle}`}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}

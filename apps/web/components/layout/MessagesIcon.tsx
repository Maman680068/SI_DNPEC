'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EVENEMENT_MESSAGES_LUS, getNombreMessagesNonLus } from '../../lib/api/communication';

const INTERVALLE_MS = 60_000;

/** Icône messagerie de la barre du haut : pastille = messages reçus non lus
 * (un message devient lu quand son destinataire ouvre la conversation). */
export function MessagesIcon() {
  const pathname = usePathname();
  const [nonLus, setNonLus] = useState(0);

  const compter = useCallback(() => {
    getNombreMessagesNonLus()
      .then(setNonLus)
      .catch(() => {
        // Pastille seulement : une erreur passagère ne doit rien afficher.
      });
  }, []);

  useEffect(() => {
    compter();
    const t = window.setInterval(compter, INTERVALLE_MS);
    window.addEventListener(EVENEMENT_MESSAGES_LUS, compter);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(EVENEMENT_MESSAGES_LUS, compter);
    };
  }, [compter]);

  useEffect(() => {
    compter();
  }, [pathname, compter]);

  return (
    <Link
      href="/communication"
      aria-label={nonLus > 0 ? `Messagerie : ${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}` : 'Messagerie'}
      className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line text-text-muted"
    >
      ✉
      {nonLus > 0 && (
        <span data-testid="compteur-messages" className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-clay px-1 text-center text-[10.5px] font-bold leading-[18px] text-white">
          {nonLus > 99 ? '99+' : nonLus}
        </span>
      )}
    </Link>
  );
}

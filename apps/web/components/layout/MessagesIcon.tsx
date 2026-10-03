'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
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
    // Onglet caché : pas d'interrogation (charge du serveur, performance 2026-10) ; le compteur
    // se remet à jour au retour sur la page (navigation) ou à l'intervalle suivant.
    const t = window.setInterval(() => document.hidden || compter(), INTERVALLE_MS);
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
      className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] text-ink hover:bg-bg"
    >
      <MessageSquare aria-hidden size={20} strokeWidth={1.8} />
      {nonLus > 0 && (
        <span data-testid="compteur-messages" className="absolute right-1 top-[5px] grid h-[17px] min-w-[17px] place-items-center rounded-[9px] border-2 border-white bg-clay px-1 text-[10.5px] font-bold leading-none text-white">
          {nonLus > 99 ? '99+' : nonLus}
        </span>
      )}
    </Link>
  );
}

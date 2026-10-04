'use client';

import Link from 'next/link';
import { SquareCheck } from 'lucide-react';
import { useOrg } from '../../lib/org/OrgProvider';
import type { ContexteConversation } from '../../lib/communication/types';
import { IconeFichier, Initiales } from '../ui/Charte';

/**
 * Fiche de l'interlocuteur (maquette : colonne de droite de la messagerie) : fonction · unité,
 * « Documents échangés » et « Tâches en commun » — seulement ce que le lecteur peut ouvrir (l'API filtre).
 */
export function FicheInterlocuteur({ userId, contexte, erreur }: { userId: string; contexte: ContexteConversation | null; erreur: string | null }) {
  const { getUserLabel, getUserInitials } = useOrg();
  const i = contexte?.interlocuteur.id === userId ? contexte.interlocuteur : null;
  return (
    <section aria-label="Fiche de l’interlocuteur" data-testid="fiche-interlocuteur" className="px-4 py-[18px]">
      <div className="mx-auto mb-2 w-16">
        <Initiales texte={getUserInitials(userId)} taille={64} />
      </div>
      <p className="text-center text-[15px] font-bold text-text">{i ? `${i.prenom} ${i.nom}` : getUserLabel(userId)}</p>
      {i && <p className="mb-3.5 text-center text-[12.5px] text-text-muted">{[i.fonction, i.unite].filter(Boolean).join(' · ')}</p>}
      {erreur && <p className="text-[12.5px] text-clay">{erreur}</p>}
      {!contexte && !erreur && <p className="text-center text-[12.5px] text-text-muted">Chargement…</p>}
      {i && contexte && (
        <>
          <h3 className="mb-2 mt-3.5 text-[12.5px] font-bold text-ink-900">Documents échangés</h3>
          {contexte.documents.length === 0 ? (
            <p className="text-[12.5px] text-text-muted">Aucun document des Archives cité que vous pouvez ouvrir.</p>
          ) : (
            <ul data-testid="documents-echanges">
              {contexte.documents.map((d) => (
                <li key={d.id}>
                  <Link href={d.lien} className="flex items-center gap-[9px] py-1.5 text-[12.5px] text-text hover:text-ink hover:underline">
                    <IconeFichier nom={d.nomFichier ?? ''} />
                    <span className="min-w-0">
                      {d.titre}
                      {d.version ? ` — v${d.version}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-3.5 text-[12.5px] font-bold text-ink-900">Tâches en commun</h3>
          {contexte.taches.length === 0 ? (
            <p className="text-[12.5px] text-text-muted">Aucune tâche en commun que vous voyez.</p>
          ) : (
            <ul data-testid="taches-communes">
              {contexte.taches.map((t) => (
                <li key={t.id}>
                  <Link href={t.lien} className="flex items-center gap-[9px] py-1.5 text-[12.5px] text-text hover:text-ink hover:underline">
                    <SquareCheck aria-hidden size={15} className="flex-none text-text-muted" />
                    <span className="min-w-0 truncate">{t.titre}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

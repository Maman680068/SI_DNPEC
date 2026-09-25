'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useOrg } from '../../../lib/org/OrgProvider';
import { getListePersonnel } from '../../../lib/api/personnel';
import type { ListePersonnel } from '../../../lib/personnel/types';
import { ROLE_LABEL, STATUS_LABEL } from '../../../lib/users/types';
import { Erreur, SELECT_CLASS } from '../../../components/courrier/ui';
import { FenetreImport } from '../../../components/personnel/FenetreImport';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Dossier du personnel (D3) : les personnes dont l'API autorise la lecture du
 * niveau 1 — la liste vient telle quelle de GET /personnel-files. */
export default function PersonnelPage() {
  const { user } = useAuth();
  const { getCelluleName, getDivisionName, getSectionName } = useOrg();
  const [liste, setListe] = useState<ListePersonnel | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [importOuvert, setImportOuvert] = useState(false);

  const charger = useCallback(() => {
    getListePersonnel()
      .then((l) => {
        setListe(l);
        setErreur(null);
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : 'Impossible de charger le personnel'));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const unite = (p: { divisionId: string | null; sectionId: string | null; celluleId: string | null }) =>
    p.celluleId ? getCelluleName(p.celluleId) : [getDivisionName(p.divisionId), getSectionName(p.sectionId)].filter(Boolean).join(' · ');

  const affichees = useMemo(() => {
    const q = sansAccents(recherche.trim());
    if (!liste) return [];
    return q ? liste.personnes.filter((p) => sansAccents(`${p.firstName} ${p.lastName} ${p.jobTitle ?? ''}`).includes(q)) : liste.personnes;
  }, [liste, recherche]);

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
          <h1 className="text-[22px] font-extrabold">Dossier du personnel</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {user && (
            <Link href={`/personnel/${user.id}`}>
              <Button variant="outline">Mon dossier</Button>
            </Link>
          )}
          {liste?.peutImporter && (
            <Button variant="gold" onClick={() => setImportOuvert(true)}>
              Importer (Excel)
            </Button>
          )}
        </div>
      </div>

      <Erreur message={erreur} />

      {!liste ? (
        !erreur && <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          <div className="mb-3.5 max-w-[360px]">
            <input
              aria-label="Rechercher une personne"
              className={SELECT_CLASS}
              placeholder="Rechercher un nom, un poste…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <p className="mb-2.5 text-[12.5px] text-text-muted">
            {affichees.length} dossier{affichees.length > 1 ? 's' : ''}
            {liste.personnes.length === 1 ? ' — le vôtre : la consultation des autres dossiers suit la hiérarchie.' : ''}
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {affichees.map((p) => (
              <li key={p.id}>
                <Link href={`/personnel/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg" data-testid="ligne-personnel">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">
                      {p.firstName} {p.lastName}
                      {p.id === user?.id && <span className="ml-1.5 text-[12px] font-normal text-text-faint">(vous)</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-text-muted">
                      {p.jobTitle ?? ROLE_LABEL[p.role]}
                      {unite(p) ? ` — ${unite(p)}` : ''}
                    </div>
                  </div>
                  {p.status !== 'ACTIF' && <Badge tone="clay">{STATUS_LABEL[p.status]}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {importOuvert && <FenetreImport onClose={() => setImportOuvert(false)} onImported={charger} />}
    </div>
  );
}

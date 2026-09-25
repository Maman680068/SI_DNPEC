'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useOrg } from '../../../lib/org/OrgProvider';
import { estStagiaire } from '../../../lib/auth/stagiaire';
import { getStages } from '../../../lib/api/stages';
import type { ListeStages, ResumeStage } from '../../../lib/stages/types';
import { STAGE_STATUT_LABEL } from '../../../lib/stages/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { FenetreNouveauStage } from '../../../components/stages/FenetresStage';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

type Onglet = 'en-cours' | 'a-venir' | 'termines';
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'en-cours', libelle: 'En cours' },
  { cle: 'a-venir', libelle: 'À venir' },
  { cle: 'termines', libelle: 'Terminés' },
];
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const onglet = (s: ResumeStage): Onglet => (s.statut === 'EN_COURS' ? 'en-cours' : s.statut === 'PREVU' ? 'a-venir' : 'termines');

/** Stages lisibles par l'acteur (GET /stages) ; un stagiaire est conduit à son stage. */
export default function StagesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { getCelluleName, getDivisionName, getSectionName } = useOrg();
  const [liste, setListe] = useState<ListeStages | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tab, setTab] = useState<Onglet>('en-cours');
  const [creation, setCreation] = useState(false);

  const charger = useCallback(() => {
    getStages()
      .then((l) => {
        setListe(l);
        if (estStagiaire(user?.role) && l.stages.length === 1) router.replace(`/stages/${l.stages[0]!.id}`);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [router, user?.role]);
  useEffect(() => {
    charger();
  }, [charger]);

  const affiches = useMemo(() => liste?.stages.filter((s) => onglet(s) === tab) ?? [], [liste, tab]);
  const unite = (p: ResumeStage['periodeEnCours']) =>
    !p ? null : p.celluleId ? getCelluleName(p.celluleId) : [getDivisionName(p.divisionId), getSectionName(p.sectionId)].filter(Boolean).join(' · ');

  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
          <h1 className="text-[22px] font-extrabold">{estStagiaire(user?.role) ? 'Mon stage' : 'Stagiaires'}</h1>
        </div>
        {liste?.peutCreer && (
          <div className="flex flex-wrap gap-2.5">
            <Link href="/stages/parametres">
              <Button>Planning, capacités, modèle</Button>
            </Link>
            <Button variant="gold" onClick={() => setCreation(true)}>
              + Nouveau stage
            </Button>
          </div>
        )}
      </div>

      {!liste ? (
        <Chargement erreur={erreur} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                onClick={() => setTab(o.cle)}
                className={`rounded-[6px] px-3.5 py-1.5 text-[12.5px] font-semibold ${tab === o.cle ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
              >
                {o.libelle} ({liste.stages.filter((s) => onglet(s) === o.cle).length})
              </button>
            ))}
          </div>
          {affiches.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-text-faint">Aucun stage dans cette rubrique.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {affiches.map((s) => (
                <li key={s.id}>
                  <Link href={`/stages/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg" data-testid="ligne-stage">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold">
                        {s.stagiaire.firstName} {s.stagiaire.lastName}
                      </div>
                      <div className="truncate text-[12.5px] text-text-muted">
                        {s.etablissement} — du {date(s.dateDebut)} au {date(s.dateFin)}
                        {unite(s.periodeEnCours) ? ` — actuellement : ${unite(s.periodeEnCours)}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.aTraiter > 0 && <Badge tone="gold">{s.aTraiter} à traiter</Badge>}
                      <Badge tone="muted">{STAGE_STATUT_LABEL[s.statut]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {creation && (
        <FenetreNouveauStage
          onClose={() => setCreation(false)}
          onCreated={(s) => {
            setCreation(false);
            router.push(`/stages/${s.id}`);
          }}
        />
      )}
    </div>
  );
}

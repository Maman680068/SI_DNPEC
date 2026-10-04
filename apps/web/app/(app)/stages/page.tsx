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
import { useToast } from '../../../components/ui/Toast';
import { Plus, Settings2 } from 'lucide-react';
import { BandeCompteurs, BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage, EtatVide, Initiales, initialesDe, LigneTableau, Onglets, Pastille, Tableau, type TonPastille } from '../../../components/ui/Charte';

type Onglet = 'en-cours' | 'a-venir' | 'termines';
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'en-cours', libelle: 'En cours' },
  { cle: 'a-venir', libelle: 'À venir' },
  { cle: 'termines', libelle: 'Terminés' },
];
const GRILLE = 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_200px_minmax(0,1fr)_170px_70px]';
const TON: Partial<Record<ResumeStage['statut'], TonPastille>> = { EN_COURS: 'vert', PREVU: 'bleu' };
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
  const toast = useToast();

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

  const n = (o: Onglet) => liste?.stages.filter((s) => onglet(s) === o).length ?? 0;
  const aTraiter = liste?.stages.reduce((t, s) => t + s.aTraiter, 0) ?? 0;
  const titre = estStagiaire(user?.role) ? 'Mon stage' : 'Stagiaires';

  return (
    <div>
      <EnTetePage
        titre={titre}
        actions={
          liste?.peutCreer && (
            <>
              <Link href="/stages/parametres" className={BTN_SECONDAIRE}>
                <Settings2 aria-hidden size={16} /> Planning, capacités, modèle
              </Link>
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setCreation(true)}>
                <Plus aria-hidden size={17} /> Nouveau stage
              </button>
            </>
          )
        }
      />
      <ErreurChargement message={erreur} />

      {!liste ? (
        <Chargement erreur={erreur} lignes={6} />
      ) : (
        <>
          <BandeCompteurs
            label="Synthèse des stages"
            items={[
              { valeur: n('en-cours'), label: 'En cours', sous: 'stagiaires accueillis', onClick: () => setTab('en-cours'), actif: tab === 'en-cours' },
              { valeur: n('a-venir'), label: 'À venir', sous: 'stages prévus', onClick: () => setTab('a-venir'), actif: tab === 'a-venir' },
              { valeur: aTraiter, label: 'Éléments à traiter', sous: 'périodes à accepter, évaluations', ton: aTraiter ? 'ambre' : 'encre' },
              { valeur: n('termines'), label: 'Terminés', sous: 'clôturés ou interrompus', ton: 'gris', onClick: () => setTab('termines'), actif: tab === 'termines' },
            ]}
          />
          <Onglets label="Stages" actif={tab} onChange={setTab} onglets={ONGLETS.map((o) => ({ cle: o.cle, label: o.libelle, n: n(o.cle) }))} />
          <Tableau
            label={`Stages ${ONGLETS.find((o) => o.cle === tab)?.libelle.toLowerCase()}`}
            grille={GRILLE}
            colonnes={['Stagiaire', 'Établissement', 'Période', 'Unité actuelle', 'Statut', <span key="a" className="sr-only">Actions</span>]}
            vide={
              <EtatVide
                texte="Aucun stage dans cette rubrique."
                action={liste.peutCreer ? <button type="button" className={BTN_LIGNE} onClick={() => setCreation(true)}>Créer un stage</button> : undefined}
              />
            }
          >
            {affiches.map((s) => (
              <LigneTableau key={s.id} grille={GRILLE} testid="ligne-stage" label={`${s.stagiaire.firstName} ${s.stagiaire.lastName}`} onClick={() => router.push(`/stages/${s.id}`)}>
                <span className="flex items-center gap-2.5">
                  <Initiales texte={initialesDe(s.stagiaire.firstName, s.stagiaire.lastName)} />
                  <Link href={`/stages/${s.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-ink-900 hover:underline">
                    {s.stagiaire.firstName} {s.stagiaire.lastName}
                  </Link>
                </span>
                <span className="block truncate">{s.etablissement}</span>
                <span className="text-text-muted">
                  {date(s.dateDebut)} → {date(s.dateFin)}
                </span>
                <span className="block truncate text-text-muted">{unite(s.periodeEnCours) || '—'}</span>
                <span className="flex flex-wrap gap-1">
                  <Pastille ton={TON[s.statut] ?? 'gris'}>{STAGE_STATUT_LABEL[s.statut]}</Pastille>
                  {s.aTraiter > 0 && <Pastille ton="ambre">{s.aTraiter} à traiter</Pastille>}
                </span>
                <span className="flex lg:justify-end">
                  <Link href={`/stages/${s.id}`} onClick={(e) => e.stopPropagation()} className={s.aTraiter > 0 ? BTN_LIGNE_PRINCIPAL : BTN_LIGNE} aria-label={`Voir le stage de ${s.stagiaire.firstName} ${s.stagiaire.lastName}`}>
                    Voir
                  </Link>
                </span>
              </LigneTableau>
            ))}
          </Tableau>
        </>
      )}
      {creation && (
        <FenetreNouveauStage
          onClose={() => setCreation(false)}
          onCreated={(s) => {
            setCreation(false);
            toast.succes('Stage créé', { detail: 'Ajoutez maintenant les périodes du plan de rotation.' });
            router.push(`/stages/${s.id}`);
          }}
        />
      )}
    </div>
  );
}

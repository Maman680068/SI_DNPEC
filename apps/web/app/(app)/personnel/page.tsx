'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FileSpreadsheet, Plus, UserRound } from 'lucide-react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useOrg } from '../../../lib/org/OrgProvider';
import { getListePersonnel, getSyntheseDossiers } from '../../../lib/api/personnel';
import { getOrganigramme } from '../../../lib/api/socle';
import type { IdentitePersonnel, LigneDossier, ListePersonnel, SyntheseDossiers } from '../../../lib/personnel/types';
import type { UniteOrganigramme } from '../../../lib/socle/types';
import { ROLE_LABEL, STATUS_LABEL } from '../../../lib/users/types';
import { FenetreImport } from '../../../components/personnel/FenetreImport';
import { FenetreNouvelAgent } from '../../../components/socle/Agents';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import {
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  BandeCompteurs,
  BarreOutils,
  EnTetePage,
  EtatVide,
  Filtres,
  FiltreSelect,
  Initiales,
  Pastille,
  Recherche,
  Tableau,
  initialesDe,
} from '../../../components/ui/Charte';

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const jourMois = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

const GRILLE_DRH = 'lg:grid-cols-[minmax(0,1.3fr)_96px_minmax(0,1.2fr)_minmax(0,1fr)_118px_150px_minmax(0,1fr)]';
const GRILLE = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_120px]';

type FiltreStatut = 'TOUS' | 'EN_ACTIVITE' | 'SUSPENDU' | 'PARTI';
type FiltreDossier = 'TOUS' | 'A_VERIFIER' | 'INCOMPLET' | 'MATRICULE' | 'ALERTE';

/**
 * Ligne cliquable du tableau : le clic ouvre le dossier ; au clavier, le nom (lien) suffit, la ligne
 * n'ajoute donc pas d'arrêt de tabulation.
 */
function Ligne({ grille, onOuvrir, children }: { grille: string; onOuvrir: () => void; children: ReactNode[] }) {
  return (
    <div
      role="row"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a,button')) onOuvrir();
      }}
      className={`grid cursor-pointer grid-cols-1 items-center gap-x-3 gap-y-1 border-b border-[#F0F1F6] px-4 py-2.5 text-[13.5px] last:border-b-0 hover:bg-[#F6F7FC] lg:min-h-[56px] lg:py-1.5 ${grille}`}
    >
      {children.map((c, i) => (
        <span key={i} role="cell" className="min-w-0">
          {c}
        </span>
      ))}
    </div>
  );
}

function NomAgent({ prenom, nom, href, vous }: { prenom: string; nom: string; href: string; vous?: boolean }) {
  return (
    <span className="flex items-center gap-[11px]">
      <Initiales texte={initialesDe(prenom, nom)} />
      <Link href={href} data-testid="ligne-personnel" className="min-w-0 truncate font-semibold text-text hover:underline">
        {prenom} {nom}
        {vous && <span className="ml-1.5 text-[12px] font-normal text-text-muted">(vous)</span>}
      </Link>
    </span>
  );
}

/** Barre de complétude du dossier : vert dès 80 %, ambre dès 50 %, rouge en dessous. */
function Completude({ valeur }: { valeur: number }) {
  const couleur = valeur >= 80 ? 'bg-sage' : valeur >= 50 ? 'bg-gold' : 'bg-clay';
  return (
    <span className="flex items-center gap-2 text-[12px] text-text-muted" data-testid="completude">
      <span aria-hidden className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-[#E8EAF2]">
        <span className={`block h-full rounded-full ${couleur}`} style={{ width: `${valeur}%` }} />
      </span>
      <span>
        {valeur} %<span className="sr-only"> du dossier renseigné</span>
      </span>
    </span>
  );
}

function StatutAgent({ l }: { l: LigneDossier }) {
  if (l.statut === 'PARTI') return <Pastille ton="gris">Parti</Pastille>;
  if (l.statut === 'SUSPENDU') return <Pastille ton="ambre">Suspendu</Pastille>;
  if (l.finPrevue) return <Pastille ton="ambre">Fin le {jourMois(l.finPrevue)}</Pastille>;
  return <Pastille ton="vert">En activité</Pastille>;
}

/**
 * Dossier du personnel (D3 ; refonte de l'interface, étape 7).
 * - DRH : bande de compteurs, filtres et tableau de synthèse (complétude et alertes calculées par
 *   l'API, GET api/v1/rh/dossiers) ; « Importer (Excel) » et « Nouvel agent » selon ses droits.
 * - Autres profils : les personnes dont l'API autorise la lecture du niveau 1 (GET /personnel-files),
 *   au moins leur propre dossier.
 */
export default function PersonnelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { getCelluleName, getDivisionName, getSectionName } = useOrg();
  const [liste, setListe] = useState<ListePersonnel | null>(null);
  const [synthese, setSynthese] = useState<SyntheseDossiers | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [unite, setUnite] = useState('TOUTES');
  const [statut, setStatut] = useState<FiltreStatut>('EN_ACTIVITE');
  const [dossier, setDossier] = useState<FiltreDossier>('TOUS');
  const [importOuvert, setImportOuvert] = useState(false);
  const [nouvelAgent, setNouvelAgent] = useState<UniteOrganigramme[] | null>(null);
  const toast = useToast();

  const charger = useCallback(() => {
    getListePersonnel()
      .then(async (l) => {
        setListe(l);
        if (l.syntheseDrh) setSynthese(await getSyntheseDossiers());
        setErreur(null);
      })
      .catch((err) => setErreur(messageChargement(err)));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const uniteDe = (p: Pick<IdentitePersonnel, 'divisionId' | 'sectionId' | 'celluleId'>) =>
    p.celluleId ? getCelluleName(p.celluleId) : [getDivisionName(p.divisionId), getSectionName(p.sectionId)].filter(Boolean).join(' · ');

  const q = sansAccents(recherche.trim());
  const personnes = useMemo(() => {
    if (!liste) return [];
    return q ? liste.personnes.filter((p) => sansAccents(`${p.firstName} ${p.lastName} ${p.jobTitle ?? ''}`).includes(q)) : liste.personnes;
  }, [liste, q]);

  const unites = useMemo(() => [...new Set((synthese?.lignes ?? []).map((l) => l.unite).filter((u): u is string => !!u))].sort((a, b) => a.localeCompare(b, 'fr')), [synthese]);
  const lignes = useMemo(() => {
    if (!synthese) return [];
    return synthese.lignes.filter(
      (l) =>
        (!q || sansAccents(`${l.prenom} ${l.nom} ${l.matricule ?? ''} ${l.poste ?? ''}`).includes(q)) &&
        (unite === 'TOUTES' || l.unite === unite) &&
        (statut === 'TOUS' || l.statut === statut) &&
        (dossier === 'TOUS' ||
          (dossier === 'A_VERIFIER' && l.aVerifier) ||
          (dossier === 'INCOMPLET' && l.completude < 100) ||
          (dossier === 'MATRICULE' && l.matriculeProvisoire) ||
          (dossier === 'ALERTE' && l.alertes.length > 0)),
    );
  }, [synthese, q, unite, statut, dossier]);

  if (!liste || (liste.syntheseDrh && !synthese))
    return (
      <div>
        <ErreurChargement message={erreur} />
        {erreur ? <EnTetePage titre="Dossier du personnel" /> : <SquelettePage />}
      </div>
    );
  const filtresActifs = (unite !== 'TOUTES' ? 1 : 0) + (statut !== 'TOUS' ? 1 : 0) + (dossier !== 'TOUS' ? 1 : 0);
  const effacerFiltres = () => (setUnite('TOUTES'), setStatut('TOUS'), setDossier('TOUS'));

  const actions = (
    <>
      {user && (
        <button type="button" className={BTN_SECONDAIRE} onClick={() => router.push(`/personnel/${user.id}`)}>
          <UserRound aria-hidden size={16} />
          Mon dossier
        </button>
      )}
      {liste.peutImporter && (
        <button type="button" className={BTN_SECONDAIRE} onClick={() => setImportOuvert(true)}>
          <FileSpreadsheet aria-hidden size={16} />
          Importer (Excel)
        </button>
      )}
      {synthese?.droits.creerAgent && (
        <button
          type="button"
          className={BTN_PRINCIPAL}
          onClick={() =>
            getOrganigramme()
              .then((o) => setNouvelAgent(o.unites.filter((u) => !u.fermee)))
              .catch((e) => toast.erreur('Ouverture impossible', messageErreur(e)))
          }
        >
          <Plus aria-hidden size={17} />
          Nouvel agent
        </button>
      )}
    </>
  );

  return (
    <div>
      <EnTetePage titre="Dossier du personnel" actions={actions} />
      <ErreurChargement message={erreur} />

      {synthese ? (
        <>
          <BandeCompteurs
            label="Synthèse des dossiers"
            items={[
              { valeur: synthese.synthese.enActivite, label: 'Agents en activité', sous: `${pluriel(synthese.synthese.suspendus, 'suspendu', 'suspendus')} · ${pluriel(synthese.synthese.partis, 'parti', 'partis')}`, testid: 'compteur-activite' },
              {
                valeur: synthese.synthese.aVerifier,
                label: 'Dossiers « à vérifier »',
                sous: 'informations à confirmer',
                ton: synthese.synthese.aVerifier ? 'ambre' : 'encre',
                onClick: () => setDossier(dossier === 'A_VERIFIER' ? 'TOUS' : 'A_VERIFIER'),
                actif: dossier === 'A_VERIFIER',
                testid: 'compteur-a-verifier',
              },
              {
                valeur: synthese.synthese.matriculesProvisoires,
                label: 'Matricules provisoires',
                sous: 'à remplacer (P-…)',
                ton: synthese.synthese.matriculesProvisoires ? 'rouge' : 'encre',
                onClick: () => setDossier(dossier === 'MATRICULE' ? 'TOUS' : 'MATRICULE'),
                actif: dossier === 'MATRICULE',
                testid: 'compteur-matricules',
              },
              { valeur: synthese.synthese.completudeMoyenne === null ? '—' : `${synthese.synthese.completudeMoyenne} %`, label: 'Complétude moyenne', sous: 'des dossiers', testid: 'compteur-completude' },
            ]}
          />
          <BarreOutils>
            <Recherche value={recherche} onChange={setRecherche} placeholder="Nom, matricule, poste…" label="Rechercher une personne" />
            <Filtres actifs={filtresActifs} onEffacer={effacerFiltres}>
            <FiltreSelect label="Unité" value={unite} defaut="TOUTES" onChange={setUnite} options={[{ value: 'TOUTES', label: 'Unité : toutes' }, ...unites.map((u) => ({ value: u, label: u }))]} />
            <FiltreSelect<FiltreStatut>
              label="Statut"
              value={statut}
              defaut="TOUS"
              onChange={setStatut}
              options={[
                { value: 'TOUS', label: 'Statut : tous' },
                { value: 'EN_ACTIVITE', label: 'Statut : en activité' },
                { value: 'SUSPENDU', label: 'Statut : suspendus' },
                { value: 'PARTI', label: 'Statut : partis' },
              ]}
            />
            <FiltreSelect<FiltreDossier>
              label="Dossier"
              value={dossier}
              defaut="TOUS"
              onChange={setDossier}
              options={[
                { value: 'TOUS', label: 'Dossier : tous' },
                { value: 'A_VERIFIER', label: 'Dossier : à vérifier' },
                { value: 'INCOMPLET', label: 'Dossier : incomplet' },
                { value: 'MATRICULE', label: 'Dossier : matricule provisoire' },
                { value: 'ALERTE', label: 'Dossier : avec alerte' },
              ]}
            />
            </Filtres>
          </BarreOutils>
          <Tableau
            label="Dossiers du personnel"
            grille={GRILLE_DRH}
            colonnes={['Agent', 'Matricule', 'Poste', 'Unité', 'Statut', 'Dossier complet', 'Alerte']}
            testid="tableau-dossiers"
            vide={
              <EtatVide
                texte="Aucun dossier ne correspond à ces filtres."
                action={
                  <button type="button" className={BTN_SECONDAIRE} onClick={() => (setRecherche(''), setUnite('TOUTES'), setStatut('TOUS'), setDossier('TOUS'))}>
                    Effacer les filtres
                  </button>
                }
              />
            }
            pied={`${pluriel(lignes.length, 'dossier', 'dossiers')} · complétude : ${pluriel(synthese.elementsCompletude, 'élément', 'éléments')} (situation administrative et pièces requises)`}
          >
            {lignes.map((l) => (
              <Ligne key={l.agentId ?? l.userId} grille={GRILLE_DRH} onOuvrir={() => router.push(l.lien)}>
                <NomAgent prenom={l.prenom} nom={l.nom} href={l.lien} vous={!!user && l.userId === user.id} />
                <span className="text-[12.5px] text-text-muted">{l.matricule ?? '—'}</span>
                <span className="block truncate">{l.poste ?? (l.role ? ROLE_LABEL[l.role] : '—')}</span>
                <span className="block truncate text-[12.5px] text-text-muted">{l.unite ?? '—'}</span>
                <StatutAgent l={l} />
                <Completude valeur={l.completude} />
                {l.alertes.length ? (
                  <span className="block text-[12.5px] text-clay" data-testid="alerte-dossier" title={l.alertes.map((a) => a.libelle).join(' · ')}>
                    {l.alertes[0]!.libelle}
                    {l.alertes.length > 1 && <span className="text-text-muted"> (+{l.alertes.length - 1})</span>}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-text-muted">
                    <span aria-hidden>—</span>
                    <span className="sr-only">Aucune alerte</span>
                  </span>
                )}
              </Ligne>
            ))}
          </Tableau>
        </>
      ) : (
        <>
          <BarreOutils>
            <Recherche value={recherche} onChange={setRecherche} placeholder="Rechercher un nom, un poste…" label="Rechercher une personne" />
          </BarreOutils>
          <p className="mb-2.5 text-[12.5px] text-text-muted">
            {pluriel(personnes.length, 'dossier', 'dossiers')}
            {liste.personnes.length === 1 ? ' — le vôtre : la consultation des autres dossiers suit la hiérarchie.' : ''}
          </p>
          <Tableau label="Dossiers du personnel" grille={GRILLE} colonnes={['Personne', 'Poste', 'Unité', 'Compte']} vide={<EtatVide texte="Aucune personne ne correspond à cette recherche." />}>
            {personnes.map((p) => (
              <Ligne key={p.id} grille={GRILLE} onOuvrir={() => router.push(`/personnel/${p.id}`)}>
                <NomAgent prenom={p.firstName} nom={p.lastName} href={`/personnel/${p.id}`} vous={p.id === user?.id} />
                <span className="block truncate">{p.jobTitle ?? ROLE_LABEL[p.role]}</span>
                <span className="block truncate text-[12.5px] text-text-muted">{uniteDe(p) || '—'}</span>
                {p.status === 'ACTIF' ? <Pastille ton="vert">Actif</Pastille> : <Pastille ton={p.status === 'SUSPENDU' ? 'ambre' : 'gris'}>{STATUS_LABEL[p.status]}</Pastille>}
              </Ligne>
            ))}
          </Tableau>
        </>
      )}

      {importOuvert && <FenetreImport onClose={() => setImportOuvert(false)} onImported={charger} />}
      {nouvelAgent && (
        <FenetreNouvelAgent
          unites={nouvelAgent}
          onClose={() => setNouvelAgent(null)}
          onFait={(nom) => {
            setNouvelAgent(null);
            charger();
            toast.succes('Agent créé', { detail: `${nom} — le compte de connexion se crée ensuite par l’administrateur.` });
          }}
        />
      )}
    </div>
  );
}

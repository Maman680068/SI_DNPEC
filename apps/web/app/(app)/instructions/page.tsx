'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check, FileText, Plus, X } from 'lucide-react';
import {
  emettreInstruction,
  executerInstruction,
  exporterInstructions,
  getInstruction,
  getInstructions,
  prendreEnCompte,
  rejeterInstruction,
} from '../../../lib/api/pilotage';
import type {
  Instruction,
  ListeInstructions,
  StatutInstruction,
} from '../../../lib/pilotage/types';
import { LIBELLE_STATUT_INSTRUCTION } from '../../../lib/pilotage/types';
import { Fenetre } from '../../../components/ui/Fenetre';
import { ChampDate, FenetreFormulaire, Liste, Saisie, SelecteurPersonnes, ZoneTexte } from '../../../components/ui/Formulaire';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';
import {
  BandeCompteurs,
  BarreOutils,
  BTN_DANGER_CONTOUR,
  BTN_LIGNE,
  BTN_LIGNE_PRINCIPAL,
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  BTN_SUCCES,
  CleValeur,
  EnTetePage,
  Etapes,
  EtatVide,
  FiltreSelect,
  Filtres,
  LigneTableau,
  Onglets,
  Pastille,
  Recherche,
  SectionFenetre,
  Tableau,
  type EtatEtape,
  type TonPastille,
} from '../../../components/ui/Charte';
import {
  Chargement,
  ErreurChargement,
  messageChargement,
} from '../../../components/ui/ErreurChargement';

type Onglet = 'emises' | 'recues' | 'meConcernant' | 'archivees';
const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
/** Date courte du tableau : « 30 sept. », l'année seulement si ce n'est pas l'année en cours. */
const dateCourte = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};
// Émise : gris ; reçue : encre ; prise en compte (en cours d'action) : ambre ; exécutée : vert ; rejetée : rouge.
const TON: Record<StatutInstruction, TonPastille> = {
  EMISE: 'gris',
  RECUE: 'encre',
  PRISE_EN_COMPTE: 'ambre',
  EXECUTEE: 'vert',
  REJETEE: 'rouge',
};
const OUVERTE = (i: Instruction) => i.statut !== 'EXECUTEE' && i.statut !== 'REJETEE';
const GRILLE = 'lg:grid-cols-[96px_minmax(0,1fr)_minmax(0,210px)_96px_150px_92px]';
const CIRCUIT = 'Émise → Reçue → Prise en compte → Exécutée';
/** État vide de chaque onglet : [lecteur, émetteur (DN, DNA)] — l'émetteur se voit proposer « Nouvelle instruction ». */
const TEXTE_VIDE: Record<Onglet, [string, string]> = {
  emises: ['Aucune instruction en cours.', 'Aucune instruction en cours : émettez-en une, son destinataire est prévenu et relancé tous les 7 jours.'],
  recues: [
    'Aucune instruction en attente ne vous est adressée. Une instruction de la Direction apparaît ici dès son émission, et vous êtes prévenu.',
    'Aucune instruction ne vous est adressée.',
  ],
  meConcernant: ['Aucune instruction exécutée ne vous concerne.', 'Aucune instruction exécutée ne vous concerne.'],
  archivees: [
    'Aucune instruction close pour l’instant : une instruction exécutée ou rejetée est rangée ici.',
    'Aucune instruction close pour l’instant : une instruction exécutée ou rejetée est rangée ici.',
  ],
};
type FiltreEcheance = 'toutes' | 'retard' | 'semaine' | 'mois' | 'sans';
const ECHEANCES: { value: FiltreEcheance; label: string }[] = [
  { value: 'toutes', label: 'Échéance : toutes' },
  { value: 'retard', label: 'En retard' },
  { value: 'semaine', label: 'Dans les 7 jours' },
  { value: 'mois', label: 'Dans les 30 jours' },
  { value: 'sans', label: 'Sans échéance' },
];
function correspondEcheance(i: Instruction, f: FiltreEcheance): boolean {
  if (f === 'toutes') return true;
  if (f === 'sans') return !i.echeance;
  if (f === 'retard') return i.enRetard && OUVERTE(i);
  if (!i.echeance) return false;
  const jours = (new Date(i.echeance).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 864e5;
  return jours >= 0 && jours <= (f === 'semaine' ? 7 : 30);
}

/** Instructions de la Direction (socle N5) : émises par le DN ou la DNA, suivies jusqu'à l'exécution. */
export default function InstructionsPage() {
  const [liste, setListe] = useState<ListeInstructions | null>(null);
  const [onglet, setOnglet] = useState<Onglet | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [emission, setEmission] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [personne, setPersonne] = useState('');
  const [statut, setStatut] = useState<StatutInstruction | ''>('');
  const [echeance, setEcheance] = useState<FiltreEcheance>('toutes');
  const toast = useToast();

  const charger = useCallback(() => {
    getInstructions()
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setOuverte(id);
  }, [charger]);

  if (!liste) {
    return (
      <div>
        <ErreurChargement message={erreur} />
        {erreur ? (
          <>
            <EnTetePage titre="Instructions de la Direction" />
            <Chargement erreur={erreur} />
          </>
        ) : (
          <SquelettePage />
        )}
      </div>
    );
  }
  // Onglets selon ce que l'API renvoie : émises (Direction), reçues, me concernant (après exécution),
  // archivées (instructions closes, émises ou reçues). Aucun droit calculé : simples répartitions.
  const toutes = [...new Map([...liste.emises, ...liste.recues, ...liste.meConcernant].map((i) => [i.id, i])).values()];
  const archivees = [...new Map([...liste.emises, ...liste.recues].filter((i) => !OUVERTE(i)).map((i) => [i.id, i])).values()];
  const onglets: { cle: Onglet; libelle: string; items: Instruction[]; visible: boolean; chaud?: boolean }[] = [
    { cle: 'emises', libelle: 'Émises par la Direction', items: liste.emises.filter(OUVERTE), visible: liste.peutEmettre || liste.emises.length > 0 },
    { cle: 'recues', libelle: 'Reçues', items: liste.recues.filter(OUVERTE), visible: true, chaud: true },
    { cle: 'meConcernant', libelle: 'Me concernant', items: liste.meConcernant, visible: liste.meConcernant.length > 0 },
    { cle: 'archivees', libelle: 'Archivées', items: archivees, visible: true },
  ];
  const visibles = onglets.filter((o) => o.visible);
  const parDefaut: Onglet = liste.peutEmettre
    ? 'emises'
    : liste.recues.some(OUVERTE) || liste.meConcernant.length === 0
      ? 'recues'
      : 'meConcernant';
  const courant = visibles.find((o) => o.cle === (onglet ?? parDefaut)) ?? visibles[0]!;
  const emisesVue = courant.cle === 'emises' || courant.cle === 'archivees';
  const personneDe = (i: Instruction) => (emisesVue ? i.destinataire : i.emetteur);
  const personnes = [...new Map(courant.items.map((i) => [personneDe(i).id, personneDe(i).nom])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  const statuts = [...new Set(courant.items.map((i) => i.statut))];
  const q = recherche.trim().toLowerCase();
  const affichees = courant.items.filter(
    (i) =>
      (!q || `${i.objet} ${i.emetteur.nom} ${i.destinataire.nom} ${i.agentConcerne?.nom ?? ''}`.toLowerCase().includes(q)) &&
      (!personne || personneDe(i).id === personne) &&
      (!statut || i.statut === statut) &&
      correspondEcheance(i, echeance),
  );
  const nbFiltres = [!!personne, !!statut, echeance !== 'toutes'].filter(Boolean).length;
  const filtre = !!q || nbFiltres > 0;
  const effacer = () => (setRecherche(''), setPersonne(''), setStatut(''), setEcheance('toutes'));
  const changerOnglet = (o: Onglet) => (setOnglet(o), setPersonne(''), setStatut(''));

  const annee = new Date().getFullYear();
  const enCours = toutes.filter(OUVERTE).length;
  const enRetard = toutes.filter((i) => i.enRetard && OUVERTE(i)).length;
  const executees = toutes.filter((i) => i.statut === 'EXECUTEE' && !!i.executeeLe && new Date(i.executeeLe).getFullYear() === annee).length;
  const rejetees = toutes.filter((i) => i.statut === 'REJETEE').length;

  return (
    <div>
      <EnTetePage
        titre="Instructions de la Direction"
        actions={
          <>
            <button type="button" className={BTN_SECONDAIRE} onClick={() => void exporterInstructions().catch((e) => toast.erreur('Export impossible', messageErreur(e)))}>
              <FileText aria-hidden size={16} /> Exporter
            </button>
            {liste.peutEmettre && (
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setEmission(true)}>
                <Plus aria-hidden size={17} /> Nouvelle instruction
              </button>
            )}
          </>
        }
      />
      <ErreurChargement message={erreur} />
      <BandeCompteurs
        label="Synthèse des instructions"
        items={[
          { valeur: enCours, label: 'En cours', sous: 'émises, reçues ou prises en compte', testid: 'compteur-en-cours' },
          { valeur: enRetard, label: 'En retard', sous: 'échéance dépassée', ton: enRetard ? 'rouge' : 'encre', testid: 'compteur-retard' },
          { valeur: executees, label: `Exécutées en ${annee}`, sous: 'avec acte signé si requis', ton: 'vert', testid: 'compteur-executees' },
          { valeur: rejetees, label: rejetees > 1 ? 'Rejetées' : 'Rejetée', sous: 'avec motif', testid: 'compteur-rejetees' },
        ]}
      />
      <div className="relative">
        <Onglets
          label="Instructions"
          actif={courant.cle}
          onChange={changerOnglet}
          onglets={visibles.map((o) => ({ cle: o.cle, label: o.libelle, n: o.items.length, chaud: o.chaud }))}
        />
        <p className="pointer-events-none absolute right-0 top-[11px] hidden text-[12.5px] text-text-muted xl:block" data-testid="circuit-instructions">
          {CIRCUIT}
        </p>
      </div>
      <BarreOutils>
        <Recherche value={recherche} onChange={setRecherche} placeholder="Rechercher une instruction…" label="Rechercher une instruction" />
        <Filtres actifs={nbFiltres} onEffacer={() => (setPersonne(''), setStatut(''), setEcheance('toutes'))}>
        <FiltreSelect
          label={emisesVue ? 'Destinataire' : 'Émetteur'}
          value={personne}
          defaut=""
          onChange={setPersonne}
          options={[{ value: '', label: emisesVue ? 'Destinataire : tous' : 'Émetteur : tous' }, ...personnes.map(([id, nom]) => ({ value: id, label: nom }))]}
        />
        <FiltreSelect<StatutInstruction | ''>
          label="Statut"
          value={statut}
          defaut=""
          onChange={setStatut}
          options={[{ value: '', label: 'Statut : tous' }, ...statuts.map((s) => ({ value: s, label: LIBELLE_STATUT_INSTRUCTION[s] }))]}
        />
        <FiltreSelect<FiltreEcheance> label="Échéance" value={echeance} defaut="toutes" onChange={setEcheance} options={ECHEANCES} />
        </Filtres>
      </BarreOutils>
      <Tableau
        label={courant.libelle}
        testid="tableau-instructions"
        grille={GRILLE}
        colonnes={['Émise le', 'Objet', emisesVue ? 'Destinataire' : 'Émetteur', 'Échéance', 'Statut', <span key="a" className="sr-only">Action</span>]}
        vide={
          filtre ? (
            <EtatVide
              texte="Aucune instruction ne correspond aux filtres."
              action={<button type="button" className={BTN_SECONDAIRE} onClick={effacer}>Effacer les filtres</button>}
            />
          ) : (
            <EtatVide
              texte={TEXTE_VIDE[courant.cle][liste.peutEmettre ? 1 : 0]}
              action={
                liste.peutEmettre ? (
                  <button type="button" className={BTN_SECONDAIRE} onClick={() => setEmission(true)}>
                    <Plus aria-hidden size={16} /> Nouvelle instruction
                  </button>
                ) : courant.cle !== 'archivees' && archivees.length > 0 ? (
                  <button type="button" className={BTN_SECONDAIRE} onClick={() => changerOnglet('archivees')}>
                    Voir les instructions archivées
                  </button>
                ) : (
                  <Link href="/aide" className={BTN_SECONDAIRE}>
                    Comment fonctionnent les instructions
                  </Link>
                )
              }
            />
          )
        }
        pied={
          affichees.length > 0 ? (
            <>
              <span>
                {affichees.length} instruction{affichees.length > 1 ? 's' : ''} · relance automatique tous les 7 jours tant qu’elle reste ouverte
              </span>
              <span className="xl:hidden">{CIRCUIT}</span>
            </>
          ) : undefined
        }
      >
        {affichees.map((i) => {
          const aTraiter = i.droits.prendreEnCompte || i.droits.executer;
          return (
            <LigneTableau key={i.id} grille={GRILLE} testid="instruction" label={i.objet} onClick={() => setOuverte(i.id)} actif={ouverte === i.id}>
              <span className="text-[12.5px] text-text-muted">
                <span className="lg:hidden">Émise le </span>
                {dateCourte(i.emiseLe)}
              </span>
              <span className="block">
                <b className="block font-semibold text-ink-900 lg:truncate">{i.objet}</b>
                {i.agentConcerne && <small className="block truncate text-[12px] text-text-muted">Concerne {i.agentConcerne.nom}</small>}
              </span>
              <span className="block truncate">
                <span className="text-text-muted lg:hidden">{emisesVue ? 'À ' : 'De '}</span>
                {personneDe(i).nom}
              </span>
              <span className={i.enRetard && OUVERTE(i) ? 'font-semibold text-clay' : 'text-text-muted'}>
                <span className="font-normal text-text-muted lg:hidden">Échéance </span>
                {dateCourte(i.echeance)}
              </span>
              <span className="flex flex-wrap gap-1">
                <Pastille ton={TON[i.statut]}>{LIBELLE_STATUT_INSTRUCTION[i.statut]}</Pastille>
                {i.enRetard && <Pastille ton="rouge">En retard</Pastille>}
              </span>
              <button
                type="button"
                className={`${aTraiter ? BTN_LIGNE_PRINCIPAL : BTN_LIGNE} w-full max-w-[120px]`}
                aria-label={`Voir l’instruction « ${i.objet} »`}
                onClick={(e) => (e.stopPropagation(), setOuverte(i.id))}
              >
                Voir
              </button>
            </LigneTableau>
          );
        })}
      </Tableau>
      {emission && (
        <FenetreEmission
          liste={liste}
          onClose={() => setEmission(false)}
          onFait={(nom) => {
            setEmission(false);
            changerOnglet('emises');
            charger();
            toast.succes('Instruction émise', { detail: `${nom} a été prévenu ; relance automatique tous les 7 jours.` });
          }}
        />
      )}
      {ouverte && (
        <FicheInstruction
          id={ouverte}
          onClose={() => {
            setOuverte(null);
            window.history.replaceState(null, '', '/instructions');
          }}
          onChange={charger}
        />
      )}
    </div>
  );
}

function FenetreEmission({
  liste,
  onClose,
  onFait,
}: {
  liste: ListeInstructions;
  onClose: () => void;
  onFait: (destinataire: string) => void;
}) {
  const [v, setV] = useState({
    objet: '',
    texte: '',
    destinataireId: '',
    agentConcerneId: '',
    echeance: '',
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const personnes = liste.personnesPossibles.map((p) => ({ id: p.id, nom: p.nom }));
  const nomDe = (id: string) => personnes.find((p) => p.id === id)?.nom ?? 'Le destinataire';
  return (
    <FenetreFormulaire
      titre="Nouvelle instruction"
      onClose={onClose}
      largeur={720}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Émettre l’instruction"
      testid="fenetre-nouvelle-instruction"
      pied="Le destinataire est prévenu immédiatement, puis relancé tous les 7 jours tant que l’instruction reste ouverte."
      valider={() => ({
        ...(v.objet.trim().length < 3 ? { 'instruction-objet': v.objet.trim() ? 'L’objet compte au moins 3 caractères.' : 'Indiquez l’objet de l’instruction.' } : {}),
        ...(v.texte.trim().length < 3 ? { 'instruction-texte': v.texte.trim() ? 'L’instruction compte au moins 3 caractères.' : 'Rédigez l’instruction.' } : {}),
      })}
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return emettreInstruction({
          objet: v.objet.trim(),
          texte: v.texte.trim(),
          destinataireId: v.destinataireId,
          ...(v.agentConcerneId ? { agentConcerneId: v.agentConcerneId } : {}),
          ...(v.echeance ? { echeance: v.echeance } : {}),
        })
          .then(() => onFait(nomDe(v.destinataireId)))
          .catch((e) => setErreur(messageErreur(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <Saisie id="instruction-objet" label="Objet" value={v.objet} onChange={(objet) => setV({ ...v, objet })} required maxLength={300} messageObligatoire="Indiquez l’objet de l’instruction." />
      <ZoneTexte id="instruction-texte" label="Instruction" value={v.texte} onChange={(texte) => setV({ ...v, texte })} required lignes={4} maxLength={5000} messageObligatoire="Rédigez l’instruction." />
      <SelecteurPersonnes
        id="instruction-destinataire"
        label="Destinataire"
        multiple={false}
        required
        messageObligatoire="Choisissez un destinataire."
        options={personnes}
        valeurs={v.destinataireId ? [v.destinataireId] : []}
        onChange={(ids) => setV({ ...v, destinataireId: ids[0] ?? '', agentConcerneId: v.agentConcerneId === ids[0] ? '' : v.agentConcerneId })}
        placeholder="Rechercher le destinataire…"
      />
      <SelecteurPersonnes
        id="instruction-agent"
        label="Agent concerné"
        facultatif
        multiple={false}
        options={personnes.filter((p) => p.id !== v.destinataireId)}
        valeurs={v.agentConcerneId ? [v.agentConcerneId] : []}
        onChange={(ids) => setV({ ...v, agentConcerneId: ids[0] ?? '' })}
        placeholder="Rechercher l’agent…"
        aide="Instruction RH : l’agent ne la verra qu’une fois exécutée."
      />
      <ChampDate id="instruction-echeance" label="Échéance" facultatif value={v.echeance} onChange={(echeance) => setV({ ...v, echeance })} />
    </FenetreFormulaire>
  );
}

/** Exécution (compte rendu, acte signé si requis) ou rejet motivé d'une instruction. */
function FenetreSuite({ i, action, onClose, onFait }: { i: Instruction; action: 'executer' | 'rejeter'; onClose: () => void; onFait: () => void }) {
  const [texte, setTexte] = useState('');
  const [acteId, setActeId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();
  const executer = action === 'executer';
  const min = executer ? 3 : 5;
  const idTexte = executer ? 'instruction-compte-rendu' : 'instruction-motif';
  return (
    <FenetreFormulaire
      titre={executer ? 'Marquer l’instruction exécutée' : 'Rejeter l’instruction'}
      sousTitre={i.objet}
      largeur={620}
      onClose={onClose}
      danger={!executer}
      enCours={enCours}
      erreur={erreur}
      libelleValider={executer ? 'Confirmer l’exécution' : 'Confirmer le rejet'}
      testid="fenetre-suite-instruction"
      pied={`${i.emetteur.nom} est prévenu${executer && i.agentConcerne ? ` ; ${i.agentConcerne.nom} voit l’instruction une fois exécutée` : ''}.`}
      valider={() => (texte.trim().length < min ? { [idTexte]: texte.trim() ? `Au moins ${min} caractères.` : executer ? 'Rédigez le compte rendu d’exécution.' : 'Indiquez le motif du rejet.' } : {})}
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return (executer ? executerInstruction(i.id, { compteRendu: texte.trim(), ...(acteId ? { acteId } : {}) }) : rejeterInstruction(i.id, texte.trim()))
          .then(() => {
            toast.succes(executer ? 'Instruction exécutée' : 'Instruction rejetée', { detail: `${i.emetteur.nom} a été prévenu.` });
            onFait();
          })
          .catch((e) => setErreur(messageErreur(e)))
          .finally(() => setEnCours(false));
      }}
    >
      <ZoneTexte
        id={idTexte}
        label={executer ? 'Compte rendu d’exécution' : 'Motif du rejet'}
        value={texte}
        onChange={setTexte}
        required
        lignes={4}
        maxLength={executer ? 3000 : 2000}
        messageObligatoire={executer ? 'Rédigez le compte rendu d’exécution.' : 'Indiquez le motif du rejet.'}
      />
      {executer && i.droits.acteRequis && (
        <>
          <Liste
            id="instruction-acte"
            label="Acte signé qui exécute l’instruction"
            value={acteId}
            onChange={setActeId}
            required
            vide="Choisir…"
            messageObligatoire="Choisissez l’acte signé."
            options={(i.actesPossibles ?? []).map((a) => ({ value: a.id, label: a.libelle }))}
          />
          {(i.actesPossibles ?? []).length === 0 && (
            <p className="-mt-2 mb-3.5 text-[12.5px] text-text-muted">Préparez puis faites signer l’acte dans le module Courrier (ou Documents générés).</p>
          )}
        </>
      )}
    </FenetreFormulaire>
  );
}

function etapesInstruction(i: Instruction): { label: string; etat: EtatEtape }[] {
  const rang = { EMISE: 0, RECUE: 1, PRISE_EN_COMPTE: 2, EXECUTEE: 3, REJETEE: 3 }[i.statut];
  const fin = i.statut === 'REJETEE' ? 'Rejetée' : 'Exécutée';
  return ['Émise', 'Reçue', 'Prise en compte', fin].map((label, n) => ({
    label,
    etat: n < rang || (n === 3 && rang === 3) ? 'fait' : n === rang ? 'courant' : 'avenir',
  }));
}

function FicheInstruction({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [i, setI] = useState<Instruction | null>(null);
  const [action, setAction] = useState<'executer' | 'rejeter' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();
  useEffect(() => {
    getInstruction(id)
      .then((x) => (setI(x), onChange()))
      .catch((e) => setErreur(messageChargement(e)));
  }, [id]);
  const recharger = () =>
    getInstruction(id)
      .then((x) => (setI(x), setAction(null), onChange()))
      .catch((e) => setErreur(messageChargement(e)));
  const prendre = (x: Instruction) => {
    setEnCours(true);
    prendreEnCompte(id)
      .then(() => {
        toast.succes('Instruction prise en compte', { detail: `${x.emetteur.nom} suit l’avancement.` });
        return recharger();
      })
      .catch((e) => toast.erreur('Action impossible', messageErreur(e)))
      .finally(() => setEnCours(false));
  };

  if (!i) {
    return (
      <FenetreDetail titre="Instruction" filAriane={['Instructions de la Direction']} onClose={onClose} largeur={720}>
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} lignes={3} />
      </FenetreDetail>
    );
  }

  const aucuneAction = !i.droits.prendreEnCompte && !i.droits.executer && !i.droits.rejeter;
  const cote = (
    <div>
      {aucuneAction ? (
        <p className="text-[12.5px] text-text-muted">
          {OUVERTE(i)
            ? 'Aucune action ne vous revient : l’instruction est suivie par son destinataire.'
            : 'Instruction close.'}
        </p>
      ) : (
        <div className="grid gap-2">
          {i.droits.prendreEnCompte && (
            <button type="button" className={BTN_PRINCIPAL} disabled={enCours} onClick={() => prendre(i)}>
              <Check aria-hidden size={16} /> Prendre en compte
            </button>
          )}
          {i.droits.executer && (
            <button type="button" className={BTN_SUCCES} onClick={() => setAction('executer')}>
              <Check aria-hidden size={16} /> Marquer exécutée
            </button>
          )}
          {i.droits.rejeter && (
            <button type="button" className={BTN_DANGER_CONTOUR} onClick={() => setAction('rejeter')}>
              <X aria-hidden size={16} /> Rejeter
            </button>
          )}
          <p className="mt-1 text-[12px] text-text-muted">
            Relance automatique tous les 7 jours tant que l’instruction reste ouverte.
          </p>
        </div>
      )}
      <div className="mt-4 border-t border-line pt-4">
        <CleValeur
          largeur={100}
          lignes={[
            ['Statut', (
              <span className="flex flex-wrap gap-1">
                <Pastille ton={TON[i.statut]}>{LIBELLE_STATUT_INSTRUCTION[i.statut]}</Pastille>
                {i.enRetard && <Pastille ton="rouge">En retard</Pastille>}
              </span>
            )],
            ['Émise le', date(i.emiseLe)],
            ['De', i.emetteur.nom],
            ['À', i.destinataire.nom],
            ...(i.agentConcerne ? ([['Agent concerné', i.agentConcerne.nom]] as [string, string][]) : []),
            ['Échéance', i.echeance ? date(i.echeance) : '—'],
          ]}
        />
      </div>
    </div>
  );

  return (
    <FenetreDetail
      titre={i.objet}
      filAriane={['Instructions de la Direction', i.emetteur.nom]}
      entete={<Etapes etapes={etapesInstruction(i)} label="Suivi de l’instruction" />}
      cote={cote}
      onClose={onClose}
      largeur={900}
      testid="fiche-instruction"
    >
      {action && <FenetreSuite i={i} action={action} onClose={() => setAction(null)} onFait={() => void recharger()} />}
      <ErreurChargement message={erreur} />
      <SectionFenetre titre="Instruction">
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">{i.texte}</p>
      </SectionFenetre>
      <SectionFenetre titre="Suivi">
        <p className="text-[13px] text-text" data-testid="suivi-instruction">
          émise le {date(i.emiseLe)}
          {i.recueLe && ` · reçue le ${date(i.recueLe)}`}
          {i.priseEnCompteLe && ` · prise en compte le ${date(i.priseEnCompteLe)}`}
          {i.executeeLe && ` · exécutée le ${date(i.executeeLe)}`}
          {i.rejeteeLe && ` · rejetée le ${date(i.rejeteeLe)}`}
          {i.echeance && ` · échéance ${date(i.echeance)}`}
        </p>
      </SectionFenetre>
      {i.compteRendu && (
        <SectionFenetre titre="Compte rendu">
          <p className="whitespace-pre-wrap text-[13.5px]">{i.compteRendu}</p>
        </SectionFenetre>
      )}
      {i.acteId && (
        <SectionFenetre titre="Acte">
          <Link className="text-[13.5px] font-semibold text-ink underline" href={`/courrier?acte=${i.acteId}`}>
            voir l’acte d’exécution
          </Link>
        </SectionFenetre>
      )}
      {i.motifRejet && (
        <SectionFenetre titre="Motif du rejet">
          <p className="whitespace-pre-wrap text-[13.5px] text-clay">{i.motifRejet}</p>
        </SectionFenetre>
      )}
    </FenetreDetail>
  );
}

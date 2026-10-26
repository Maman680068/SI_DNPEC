'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { acteAttestation, acteOrdre, apercu, creerAttestation, creerOrdre, deposerEnGed, getAttestations, getCatalogue, getOrdres, telecharger, transmettre } from '../../../lib/api/generateur';
import type { AttestationTravail, Catalogue, Demande, OrdreMission } from '../../../lib/generateur/types';
import { LIBELLE_GENERE, etatActe } from '../../../lib/generateur/types';
import { Eye, FileDown, Plus, Send, Stamp, X } from 'lucide-react';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';
import { ChampDate, FenetreFormulaire, Grille2, Liste, Saisie, SelecteurPersonnes, ZoneTexte, type Personne as PersonneChoix } from '../../../components/ui/Formulaire';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { useEnvoi } from '../../../components/courrier/formulaire';
import { BandeCompteurs, BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, EnTetePage, EtatVide, LigneTableau, Onglets, Panneau, Pastille, SectionFenetre, Tableau, type TonPastille } from '../../../components/ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Onglet = 'attestations' | 'ordres' | 'rapport';
/** Personnes proposées par l'API (catalogue) au format du sélecteur. */
const choixPersonnes = (liste: { id: string; nom: string }[]): PersonneChoix[] => liste.map((p) => ({ id: p.id, nom: p.nom }));
const nomChoisi = (liste: { id: string; nom: string }[], id: string) => liste.find((p) => p.id === id)?.nom ?? '';
const GRILLE_ATT = 'lg:grid-cols-[minmax(0,1fr)_120px_220px_170px]';
const GRILLE_OM = 'lg:grid-cols-[minmax(0,1.4fr)_170px_220px_170px]';
const tonActe = (a: { statut: string } | null): TonPastille => (signe(a) ? 'vert' : a?.statut === 'ANNULE' ? 'gris' : a ? 'ambre' : 'gris');
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const signe = (a: { statut: string } | null) => !!a && (a.statut === 'SIGNE' || a.statut === 'EXPEDIE');
const enCircuit = (a: { statut: string } | null) => !!a && !signe(a) && a.statut !== 'ANNULE';
/** État court de l'acte (pastille de la colonne d'informations). */
const courtActe = (a: { statut: string; numero: string | null } | null) => (!a ? 'Projet' : signe(a) ? `Signé n° ${a.numero}` : a.statut === 'ANNULE' ? 'Annulé' : 'En circuit');
type Selection = { type: 'attestation'; id: string } | { type: 'ordre'; id: string } | null;

/** Documents générés (socle N4) : attestation de travail, ordre de mission, rapport d'activité,
 * produits depuis les données enregistrées ; aperçu fidèle, PDF, Word, dépôt en GED, transmission.
 * Une ligne s'ouvre dans une fenêtre deux colonnes (informations à gauche, actions à droite). */
export default function DocumentsGeneresPage() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [attestations, setAttestations] = useState<AttestationTravail[] | null>(null);
  const [ordres, setOrdres] = useState<OrdreMission[] | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('rapport');
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouvelOrdre, setNouvelOrdre] = useState(false);
  const [nouvelleAttestation, setNouvelleAttestation] = useState(false);
  const [agentPropose, setAgentPropose] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  const charger = useCallback(() => {
    getCatalogue()
      .then((c) => {
        setCatalogue(c);
        // Onglet demandé par l'adresse (?onglet=, ex. bouton « Rapport d'activité » du Plan de travail) : gardé.
        if (c.attestationTravail.peutCreer && !new URLSearchParams(window.location.search).get('onglet')) setOnglet((o) => (o === 'rapport' ? 'attestations' : o));
      })
      .catch((e) => setErreur(messageChargement(e)));
    getAttestations().then(setAttestations).catch((e) => setErreur(messageChargement(e)));
    getOrdres().then(setOrdres).catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
    const o = new URLSearchParams(window.location.search).get('onglet');
    if (o === 'attestations' || o === 'ordres' || o === 'rapport') setOnglet(o);
    // Lien profond du dossier du personnel (DRH) : ?onglet=attestations&nouvelle=1&agent=<compte>.
    const q = new URLSearchParams(window.location.search);
    if (o === 'attestations' && q.get('nouvelle') === '1') {
      setAgentPropose(q.get('agent'));
      setNouvelleAttestation(true);
    }
  }, [charger]);

  if (!catalogue) {
    return (
      <div>
        <EnTetePage titre="Documents générés" />
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} />
      </div>
    );
  }
  const onglets: { cle: Onglet; libelle: string; visible: boolean; n?: number }[] = [
    { cle: 'attestations', libelle: 'Attestations de travail', visible: catalogue.attestationTravail.peutCreer || (attestations?.length ?? 0) > 0, n: attestations?.length },
    { cle: 'ordres', libelle: 'Ordres de mission', visible: catalogue.ordreMission.peutCreer || (ordres?.length ?? 0) > 0, n: ordres?.length },
    { cle: 'rapport', libelle: 'Rapport d’activité', visible: true },
  ];
  const actes = [...(attestations ?? []).map((a) => a.acte), ...(ordres ?? []).map((o) => o.acte)];
  const attestationOuverte = selection?.type === 'attestation' ? attestations?.find((a) => a.id === selection.id) : undefined;
  const ordreOuvert = selection?.type === 'ordre' ? ordres?.find((o) => o.id === selection.id) : undefined;

  return (
    <div>
      <EnTetePage
        titre="Documents générés"
        sousTitre="Produits depuis les données enregistrées, sans ressaisie"
        actions={
          onglet === 'ordres' && catalogue.ordreMission.peutCreer ? (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouvelOrdre(true)}>
              <Plus aria-hidden size={16} /> Nouvel ordre de mission
            </button>
          ) : onglet === 'attestations' && catalogue.attestationTravail.peutCreer ? (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouvelleAttestation(true)}>
              <Plus aria-hidden size={16} /> Nouvelle attestation de travail
            </button>
          ) : undefined
        }
      />
      <ErreurChargement message={erreur} />
      {(onglets[0]!.visible || onglets[1]!.visible) && (
        <BandeCompteurs
          label="Synthèse des documents générés"
          items={[
            ...(onglets[0]!.visible ? [{ valeur: attestations?.length ?? '…', label: 'Attestations de travail', sous: `dont ${(attestations ?? []).filter((a) => signe(a.acte)).length} signée(s)`, onClick: () => setOnglet('attestations'), testid: 'compteur-attestations' }] : []),
            ...(onglets[1]!.visible ? [{ valeur: ordres?.length ?? '…', label: 'Ordres de mission', sous: `dont ${(ordres ?? []).filter((o) => signe(o.acte)).length} signé(s)`, onClick: () => setOnglet('ordres'), testid: 'compteur-ordres' }] : []),
            { valeur: actes.filter((a) => !a).length, label: 'Actes à préparer', sous: 'projets sans acte', ton: 'gris' as const, testid: 'compteur-a-preparer' },
            { valeur: actes.filter(enCircuit).length, label: 'Actes en circuit', sous: 'visa puis signature', ton: actes.some(enCircuit) ? ('ambre' as const) : ('encre' as const), testid: 'compteur-en-circuit' },
          ]}
        />
      )}
      <Onglets
        label="Documents générés"
        actif={onglet}
        onChange={setOnglet}
        onglets={onglets.filter((o) => o.visible).map((o) => ({ cle: o.cle, label: o.libelle, n: o.n ?? null }))}
      />

      {onglet === 'attestations' && <Attestations catalogue={catalogue} liste={attestations} onNouvelle={() => setNouvelleAttestation(true)} onVoir={(id) => setSelection({ type: 'attestation', id })} />}
      {onglet === 'ordres' && <Ordres catalogue={catalogue} liste={ordres} onNouvel={() => setNouvelOrdre(true)} onVoir={(id) => setSelection({ type: 'ordre', id })} />}
      {onglet === 'rapport' && <Rapport catalogue={catalogue} />}

      {nouvelOrdre && (
        <FenetreOrdre
          catalogue={catalogue}
          onClose={() => setNouvelOrdre(false)}
          onFait={() => (setNouvelOrdre(false), setOnglet('ordres'), charger())}
        />
      )}
      {nouvelleAttestation && catalogue.attestationTravail.peutCreer && (
        <FenetreAttestation
          catalogue={catalogue}
          agentInitial={agentPropose}
          onClose={() => setNouvelleAttestation(false)}
          onFait={() => (setNouvelleAttestation(false), setOnglet('attestations'), charger())}
        />
      )}
      {attestationOuverte && (
        <FenetreDetail
          titre={`Attestation de travail — ${attestationOuverte.agent.nom}`}
          filAriane={['Documents générés', 'Attestations de travail']}
          onClose={() => setSelection(null)}
          largeur={880}
          testid="fiche-document-genere"
          cote={
            <CoteDocument
              acte={attestationOuverte.acte}
              infos={[['Créée le', date(attestationOuverte.createdAt)]]}
              actions={
                attestationOuverte.droits.produire ? (
                  <Actions
                    demande={{ type: 'ATTESTATION_TRAVAIL', attestationId: attestationOuverte.id }}
                    catalogue={catalogue}
                    destinataireParDefaut={attestationOuverte.agent.id}
                    preparerActe={attestationOuverte.droits.preparerActe ? (r) => acteAttestation(attestationOuverte.id, r) : undefined}
                    onChange={charger}
                    colonne
                  />
                ) : (
                  <p className="text-[12.5px] text-text-muted">Disponible une fois l’acte signé par la Direction.</p>
                )
              }
            />
          }
        >
          <SectionFenetre titre="Document">
            <CleValeur lignes={[['Agent', attestationOuverte.agent.nom], ['Modèle', 'Attestation de travail'], ['Acte', etatActe(attestationOuverte.acte)]]} />
          </SectionFenetre>
          <p className="text-[12.5px] text-text-muted">{EXPLICATION}</p>
        </FenetreDetail>
      )}
      {ordreOuvert && (
        <FenetreDetail
          titre={`Ordre de mission — ${ordreOuvert.destination}`}
          filAriane={['Documents générés', 'Ordres de mission', ordreOuvert.agent.nom]}
          onClose={() => setSelection(null)}
          largeur={900}
          testid="fiche-document-genere"
          cote={
            <CoteDocument
              acte={ordreOuvert.acte}
              infos={[
                ['Départ', date(ordreOuvert.dateDepart)],
                ['Retour', date(ordreOuvert.dateRetour)],
              ]}
              actions={
                <Actions
                  demande={{ type: 'ORDRE_MISSION', ordreMissionId: ordreOuvert.id }}
                  catalogue={catalogue}
                  destinataireParDefaut={ordreOuvert.agent.id}
                  preparerActe={ordreOuvert.droits.preparerActe ? (r) => acteOrdre(ordreOuvert.id, r) : undefined}
                  onChange={charger}
                  colonne
                />
              }
            />
          }
        >
          <SectionFenetre titre="Mission">
            <CleValeur
              largeur={120}
              lignes={[
                ['Agent', ordreOuvert.agent.nom],
                ['Objet', ordreOuvert.objet],
                ['Destination', ordreOuvert.destination],
                ['Période', `du ${date(ordreOuvert.dateDepart)} au ${date(ordreOuvert.dateRetour)}`],
                ['Transport', ordreOuvert.transport ?? '—'],
                ['Frais', <span key="f" data-testid="frais-mission">{ordreOuvert.fraisEnLettres ?? '—'}</span>],
                ['Acte', etatActe(ordreOuvert.acte)],
              ]}
            />
          </SectionFenetre>
          {ordreOuvert.vehicule && (
            <SectionFenetre titre="Véhicule de service">
              <p className="text-[13.5px]" data-testid="vehicule-mission">
                {ordreOuvert.vehicule.immatriculation} ({ordreOuvert.vehicule.marque} {ordreOuvert.vehicule.modele})
                {ordreOuvert.vehicule.kilometrageRetour !== null && ordreOuvert.vehicule.kilometrageDepart !== null
                  ? ` · ${(ordreOuvert.vehicule.kilometrageRetour - ordreOuvert.vehicule.kilometrageDepart).toLocaleString('fr-FR')} km parcourus`
                  : ''}
              </p>
            </SectionFenetre>
          )}
          <p className="text-[12.5px] text-text-muted">{EXPLICATION}</p>
        </FenetreDetail>
      )}
    </div>
  );
}

const EXPLICATION = 'En-tête de la République et de la Direction ; un document signé imprimé une seconde fois porte la mention « DUPLICATA ».';

/** Colonne de droite d'une fenêtre : actions puis informations. */
function CoteDocument({ acte, infos, actions }: { acte: AttestationTravail['acte']; infos: [string, string][]; actions: ReactNode }) {
  return (
    <div>
      {actions}
      <div className="mt-4 border-t border-line pt-4">
        <CleValeur largeur={84} lignes={[['Acte', <Pastille key="a" ton={tonActe(acte)}>{courtActe(acte)}</Pastille>], ...infos]} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ attestations de travail

function Attestations({ catalogue, liste, onNouvelle, onVoir }: { catalogue: Catalogue; liste: AttestationTravail[] | null; onNouvelle: () => void; onVoir: (id: string) => void }) {
  return (
    <section>
      {liste === null ? (
        <Chargement erreur={null} />
      ) : (
        <Tableau
          label="Attestations de travail"
          grille={GRILLE_ATT}
          colonnes={['Agent', 'Créée le', 'Acte', <span key="a" className="sr-only">Actions</span>]}
          vide={
            <EtatVide
              texte="Aucune attestation de travail."
              action={
                catalogue.attestationTravail.peutCreer ? (
                  <button type="button" className={BTN_SECONDAIRE} onClick={onNouvelle}>
                    <Plus aria-hidden size={16} /> Nouvelle attestation de travail
                  </button>
                ) : undefined
              }
            />
          }
          pied={liste.length > 0 ? <span>{liste.length} attestation{liste.length > 1 ? 's' : ''} · Voir : aperçu, PDF, Word, GED, transmission et acte</span> : undefined}
        >
          {liste.map((a) => (
            <LigneTableau key={a.id} grille={GRILLE_ATT} testid="attestation-travail" label={`Attestation de travail — ${a.agent.nom}`} onClick={() => onVoir(a.id)}>
              <b className="block truncate font-semibold text-ink-900">{a.agent.nom}</b>
              <span className="text-text-muted">
                <span className="lg:hidden">Créée le </span>
                {date(a.createdAt)}
              </span>
              <Pastille ton={tonActe(a.acte)}>{etatActe(a.acte)}</Pastille>
              <span className="flex gap-1.5 lg:justify-end" onClick={(e) => e.stopPropagation()}>
                {a.droits.produire && <BoutonApercu demande={{ type: 'ATTESTATION_TRAVAIL', attestationId: a.id }} />}
                <button type="button" className={BTN_LIGNE} onClick={() => onVoir(a.id)} aria-label={`Voir l’attestation de ${a.agent.nom}`}>
                  Voir
                </button>
              </span>
            </LigneTableau>
          ))}
        </Tableau>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ ordres de mission

function Ordres({ catalogue, liste, onNouvel, onVoir }: { catalogue: Catalogue; liste: OrdreMission[] | null; onNouvel: () => void; onVoir: (id: string) => void }) {
  if (liste === null) return <Chargement erreur={null} />;
  return (
    <Tableau
      label="Ordres de mission"
      grille={GRILLE_OM}
      colonnes={['Mission', 'Période', 'Acte', <span key="a" className="sr-only">Actions</span>]}
      vide={
        <EtatVide
          texte="Aucun ordre de mission."
          action={catalogue.ordreMission.peutCreer ? <button type="button" className={BTN_SECONDAIRE} onClick={onNouvel}><Plus aria-hidden size={16} /> Établir un ordre de mission</button> : undefined}
        />
      }
      pied={liste.length > 0 ? <span>{liste.length} ordre{liste.length > 1 ? 's' : ''} de mission · le véhicule de service s’affecte depuis la Logistique</span> : undefined}
    >
      {liste.map((o) => (
        <LigneTableau key={o.id} grille={GRILLE_OM} testid="ordre-mission" label={`Ordre de mission — ${o.agent.nom}, ${o.destination}`} onClick={() => onVoir(o.id)}>
          <span className="block min-w-0">
            <b className="block truncate font-semibold text-ink-900">
              {o.agent.nom} — {o.destination}
            </b>
            <span className="block truncate text-[12.5px] text-text-muted">{o.objet}</span>
            {o.vehicule && <span className="block truncate text-[12px] text-text-muted">Véhicule : {o.vehicule.immatriculation}</span>}
          </span>
          <span className="text-[12.5px] text-text-muted">
            Du {date(o.dateDepart)}
            <span className="lg:block"> au {date(o.dateRetour)}</span>
          </span>
          <Pastille ton={tonActe(o.acte)}>{etatActe(o.acte)}</Pastille>
          <span className="flex gap-1.5 lg:justify-end" onClick={(e) => e.stopPropagation()}>
            <BoutonApercu demande={{ type: 'ORDRE_MISSION', ordreMissionId: o.id }} />
            <button type="button" className={BTN_LIGNE} onClick={() => onVoir(o.id)} aria-label={`Voir l’ordre de mission de ${o.agent.nom} (${o.destination})`}>
              Voir
            </button>
          </span>
        </LigneTableau>
      ))}
    </Tableau>
  );
}

/** Nouvelle attestation de travail : l'agent est choisi parmi ceux que l'API propose. */
function FenetreAttestation({ catalogue, onClose, onFait, agentInitial }: { catalogue: Catalogue; onClose: () => void; onFait: () => void; agentInitial?: string | null }) {
  const toast = useToast();
  // Agent proposé par le lien (dossier du personnel), seulement s'il fait partie des agents permis par l'API.
  const [agentId, setAgentId] = useState(() => (agentInitial && catalogue.attestationTravail.agents.some((a) => a.id === agentInitial) ? agentInitial : ''));
  const { enCours, erreur, envoyer } = useEnvoi();
  const agents = catalogue.attestationTravail.agents;
  return (
    <FenetreFormulaire
      titre="Nouvelle attestation de travail"
      sousTitre="Produite depuis le dossier de l’agent, sans ressaisie."
      libelleValider="Créer l’attestation"
      largeur={560}
      testid="fenetre-attestation"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Ensuite : aperçu, puis préparation de l’acte à signer par la Direction."
      onSubmit={async () => {
        const r = await envoyer(() => creerAttestation(agentId));
        if (!r.ok) return;
        toast.succes('Attestation créée', { detail: `Pour ${nomChoisi(agents, agentId)} : aperçu, puis acte à signer (bouton « Voir »).` });
        onFait();
      }}
    >
      <SelecteurPersonnes
        id="attestation-agent"
        label="Agent"
        options={choixPersonnes(agents)}
        valeurs={agentId ? [agentId] : []}
        onChange={(ids) => setAgentId(ids[0] ?? '')}
        multiple={false}
        required
        messageObligatoire="Choisissez l’agent."
      />
    </FenetreFormulaire>
  );
}

function FenetreOrdre({ catalogue, onClose, onFait }: { catalogue: Catalogue; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ agentId: '', objet: '', destination: '', dateDepart: '', dateRetour: '', transport: '', frais: '' });
  const { enCours, erreur, envoyer } = useEnvoi();
  const agents = catalogue.ordreMission.agents;
  return (
    <FenetreFormulaire
      titre="Nouvel ordre de mission"
      libelleValider="Enregistrer l’ordre de mission"
      testid="fenetre-ordre"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le véhicule de service s’affecte ensuite depuis la Logistique ; l’acte suit le circuit du Courrier."
      valider={() => ({
        ...(f.destination.trim().length === 1 ? { 'ordre-destination': 'Indiquez au moins 2 caractères.' } : {}),
        ...(f.objet.trim() && f.objet.trim().length < 5 ? { 'ordre-objet': 'Décrivez l’objet en 5 caractères au moins.' } : {}),
        ...(f.dateDepart && f.dateRetour && f.dateRetour < f.dateDepart ? { 'ordre-retour': 'Le retour ne peut pas précéder le départ.' } : {}),
        ...(f.frais && !/^\d+$/.test(f.frais) ? { 'ordre-frais': 'Indiquez un montant entier, sans décimale.' } : {}),
      })}
      onSubmit={async () => {
        const r = await envoyer(() =>
          creerOrdre({
            agentId: f.agentId,
            objet: f.objet.trim(),
            destination: f.destination.trim(),
            dateDepart: f.dateDepart,
            dateRetour: f.dateRetour,
            transport: f.transport.trim() || undefined,
            fraisMontant: f.frais ? Number(f.frais) : undefined,
          }),
        );
        if (!r.ok) return;
        toast.succes('Ordre de mission enregistré', { detail: `${nomChoisi(agents, f.agentId)} — ${f.destination.trim()}.` });
        onFait();
      }}
    >
      <Grille2>
        <SelecteurPersonnes
          id="ordre-agent"
          label="Agent"
          options={choixPersonnes(agents)}
          valeurs={f.agentId ? [f.agentId] : []}
          onChange={(ids) => setF({ ...f, agentId: ids[0] ?? '' })}
          multiple={false}
          required
          messageObligatoire="Choisissez l’agent."
        />
        <Saisie id="ordre-destination" label="Destination" value={f.destination} onChange={(destination) => setF({ ...f, destination })} required maxLength={200} messageObligatoire="Indiquez la destination." />
      </Grille2>
      <ZoneTexte id="ordre-objet" label="Objet de la mission" value={f.objet} onChange={(objet) => setF({ ...f, objet })} required maxLength={500} lignes={2} messageObligatoire="Indiquez l’objet de la mission." />
      <Grille2>
        <ChampDate id="ordre-depart" label="Départ" value={f.dateDepart} onChange={(dateDepart) => setF({ ...f, dateDepart })} required messageObligatoire="Indiquez la date de départ." />
        <ChampDate id="ordre-retour" label="Retour" value={f.dateRetour} min={f.dateDepart || undefined} onChange={(dateRetour) => setF({ ...f, dateRetour })} required messageObligatoire="Indiquez la date de retour." />
        <Saisie id="ordre-transport" label="Moyen de transport" facultatif value={f.transport} onChange={(transport) => setF({ ...f, transport })} maxLength={200} />
        <Saisie id="ordre-frais" label="Frais de mission en francs guinéens" facultatif type="number" min={0} value={f.frais} onChange={(frais) => setF({ ...f, frais })} />
      </Grille2>
    </FenetreFormulaire>
  );
}

// ------------------------------------------------------------------ rapport d'activité

/** Date AAAA-MM-JJ lue dans l'adresse de la page (lien profond), sinon null. */
function dateAdresse(nom: string): string | null {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(nom);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function Rapport({ catalogue }: { catalogue: Catalogue }) {
  const perimetres = catalogue.rapportActivite.perimetres;
  const [choix, setChoix] = useState(0);
  const auj = new Date();
  // Période : celle de l'adresse (?debut=&fin=, lien du Plan de travail), sinon le mois en cours.
  const [debut, setDebut] = useState(() => dateAdresse('debut') ?? `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-01`);
  const [fin, setFin] = useState(() => dateAdresse('fin') ?? `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-${String(auj.getDate()).padStart(2, '0')}`);
  const p = perimetres[choix] ?? perimetres[0]!;
  const demande: Demande = { type: 'RAPPORT_ACTIVITE', perimetre: p.perimetre, cibleId: p.cibleId ?? undefined, debut, fin };
  return (
    <Panneau titre="Rapport d’activité" className="max-w-[860px]">
      <div className="px-[18px] py-4">
        <p className="mb-3 text-[12.5px] text-text-muted">Construit depuis les tâches de la période et du périmètre (celles que vous voyez), jamais ressaisi.</p>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
          <Liste id="rapport-perimetre" label="Périmètre" value={String(choix)} onChange={(v) => setChoix(Number(v))} options={perimetres.map((x, i) => ({ value: String(i), label: x.libelle }))} />
          <ChampDate id="rapport-debut" label="Du" value={debut} onChange={setDebut} raccourcis={false} />
          <ChampDate id="rapport-fin" label="Au" value={fin} min={debut || undefined} onChange={setFin} raccourcis={false} />
        </div>
        <Actions demande={demande} catalogue={catalogue} />
      </div>
    </Panneau>
  );
}

// ------------------------------------------------------------------ actions communes (aperçu, PDF, Word, GED, transmettre, acte)

/** Aperçu fidèle (PDF produit par l'API) dans une fenêtre. */
function ApercuDocument({ url, type, onClose }: { url: string; type: Demande['type']; onClose: () => void }) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    window.addEventListener('keydown', echap, true);
    return () => window.removeEventListener('keydown', echap, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,28,77,0.45)] p-3" onClick={onClose}>
      <div className="flex h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_24px_60px_rgba(18,28,77,0.35)]" role="dialog" aria-modal="true" aria-label="Aperçu du document" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="font-heading text-[15px] font-bold text-ink-900">Aperçu — {LIBELLE_GENERE[type]}</span>
          <button type="button" onClick={onClose} aria-label="Fermer l’aperçu" className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-line text-text-muted hover:bg-bg">
            <X aria-hidden size={18} />
          </button>
        </div>
        <iframe title="Aperçu du document" src={url} className="w-full flex-1" data-testid="apercu-document" />
      </div>
    </div>
  );
}

/** Bouton « Aperçu » d'une ligne de tableau. */
function BoutonApercu({ demande }: { demande: Demande }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <>
      <button
        type="button"
        className={`${BTN_LIGNE} gap-1 disabled:opacity-50`}
        disabled={enCours}
        onClick={() => {
          setEnCours(true);
          apercu(demande)
            .then(setUrl)
            .catch((e) => toast.erreur('Aperçu impossible', messageErreur(e)))
            .finally(() => setEnCours(false));
        }}
      >
        <Eye aria-hidden size={14} /> Aperçu
      </button>
      {url && <ApercuDocument url={url} type={demande.type} onClose={() => setUrl(null)} />}
    </>
  );
}

function Actions({
  demande,
  catalogue,
  destinataireParDefaut,
  preparerActe,
  onChange,
  colonne = false,
}: {
  demande: Demande;
  catalogue: Catalogue;
  destinataireParDefaut?: string;
  preparerActe?: (registreId: string) => Promise<{ acteId: string }>;
  onChange?: () => void;
  /** Colonne d'actions d'une fenêtre de détail : boutons pleine largeur, l'acte en premier. */
  colonne?: boolean;
}) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<'transmettre' | 'acte' | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [ged, setGed] = useState<string | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  /** Action directe : message de confirmation, ou d'erreur en français. */
  async function agir(fn: () => Promise<unknown>, succes?: { titre: string; detail?: string }) {
    setEnCours(true);
    try {
      await fn();
      if (succes) toast.succes(succes.titre, { detail: succes.detail });
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }
  const b = colonne ? `${BTN_SECONDAIRE} w-full` : `${BTN_LIGNE} disabled:opacity-50`;

  return (
    <div data-testid="actions-document">
      <div className={colonne ? 'grid gap-2' : 'flex flex-wrap gap-1.5'}>
        {preparerActe && colonne && (
          <button type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => setFenetre('acte')}>
            <Stamp aria-hidden size={16} /> Préparer l’acte
          </button>
        )}
        <button type="button" className={`${b} gap-1`} disabled={enCours} onClick={() => agir(async () => setUrl(await apercu(demande)))}>
          <Eye aria-hidden size={colonne ? 16 : 14} /> Aperçu
        </button>
        <div className={colonne ? 'grid grid-cols-2 gap-2' : 'contents'}>
          <button type="button" className={`${b} gap-1`} disabled={enCours} onClick={() => agir(() => telecharger(demande, 'PDF'), { titre: 'PDF téléchargé' })}>
            <FileDown aria-hidden size={colonne ? 16 : 14} /> PDF
          </button>
          <button type="button" className={b} disabled={enCours} onClick={() => agir(() => telecharger(demande, 'DOCX'), { titre: 'Document Word téléchargé' })}>
            Word
          </button>
        </div>
        {catalogue.peutDeposerEnGed && (
          <button
            type="button"
            className={b}
            disabled={enCours}
            onClick={() => agir(async () => setGed((await deposerEnGed(demande)).documentId), { titre: 'Document déposé en GED', detail: 'Dans l’espace de votre unité, au statut « Brouillon ».' })}
          >
            Déposer en GED
          </button>
        )}
        <button type="button" className={b} disabled={enCours} onClick={() => setFenetre('transmettre')}>
          <Send aria-hidden size={colonne ? 16 : 14} /> Transmettre
        </button>
        {preparerActe && !colonne && (
          <button type="button" className={`${BTN_LIGNE_PRINCIPAL} disabled:opacity-50`} disabled={enCours} onClick={() => setFenetre('acte')}>
            Préparer l’acte
          </button>
        )}
      </div>
      {colonne && <p className="mt-2 text-[12px] text-text-muted">{preparerActe ? 'L’acte suit le circuit du Courrier (visa, signature du DN ou de la DNA) et reçoit son numéro à la signature.' : 'Aperçu fidèle : le PDF qui sera imprimé.'}</p>}
      {ged && (
        <p className="mt-1.5 text-[12.5px]">
          <Link className="font-semibold text-ink underline" href={`/documents?id=${ged}`}>
            Ouvrir le document déposé
          </Link>
        </p>
      )}

      {fenetre === 'transmettre' && <FenetreTransmettre demande={demande} catalogue={catalogue} destinataireParDefaut={destinataireParDefaut} onClose={() => setFenetre(null)} />}

      {fenetre === 'acte' && preparerActe && (
        <FenetreActe
          demande={demande}
          catalogue={catalogue}
          preparerActe={preparerActe}
          onClose={() => setFenetre(null)}
          onFait={() => {
            setFenetre(null);
            onChange?.();
          }}
        />
      )}

      {url && <ApercuDocument url={url} type={demande.type} onClose={() => setUrl(null)} />}
    </div>
  );
}

/** Transmission par la messagerie (PDF joint) à une personne que l'API propose. */
function FenetreTransmettre({ demande, catalogue, destinataireParDefaut, onClose }: { demande: Demande; catalogue: Catalogue; destinataireParDefaut?: string; onClose: () => void }) {
  const toast = useToast();
  const [destinataire, setDestinataire] = useState(catalogue.destinataires.some((d) => d.id === destinataireParDefaut) ? destinataireParDefaut! : '');
  const [message, setMessage] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={`Transmettre — ${LIBELLE_GENERE[demande.type]}`}
      libelleValider="Envoyer"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le PDF est joint à un message de la messagerie interne."
      onSubmit={async () => {
        const r = await envoyer(() => transmettre(demande, destinataire, message.trim() || undefined));
        if (!r.ok) return;
        toast.succes('Document transmis', { detail: `À ${nomChoisi(catalogue.destinataires, destinataire)}, par la messagerie (PDF joint).` });
        onClose();
      }}
    >
      <SelecteurPersonnes
        id="transmettre-destinataire"
        label="Destinataire"
        options={choixPersonnes(catalogue.destinataires)}
        valeurs={destinataire ? [destinataire] : []}
        onChange={(ids) => setDestinataire(ids[0] ?? '')}
        multiple={false}
        required
        messageObligatoire="Choisissez un destinataire."
      />
      <ZoneTexte id="transmettre-message" label="Message" facultatif value={message} onChange={setMessage} maxLength={1000} lignes={3} />
    </FenetreFormulaire>
  );
}

/** Acte du Courrier portant le document (registre d'actes de la Direction). */
function FenetreActe({ demande, catalogue, preparerActe, onClose, onFait }: { demande: Demande; catalogue: Catalogue; preparerActe: (registreId: string) => Promise<{ acteId: string }>; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [registreId, setRegistreId] = useState(catalogue.registres[0]?.id ?? '');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Préparer l’acte"
      sousTitre={`${LIBELLE_GENERE[demande.type]} : un acte est créé avec le document en projet ; il suit le circuit habituel et reçoit son numéro à la signature.`}
      libelleValider="Créer l’acte"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Visa, puis signature du DN ou de la DNA, dans le module Courrier."
      onSubmit={async () => {
        const r = await envoyer(() => preparerActe(registreId));
        if (!r.ok) return;
        toast.succes('Acte créé', { detail: 'Il suit le circuit du Courrier : visa, puis signature.' });
        onFait();
      }}
    >
      <Liste
        id="acte-registre"
        label="Registre d’actes de la Direction"
        value={registreId}
        onChange={setRegistreId}
        vide={catalogue.registres.length === 0 ? 'Aucun registre d’actes actif' : undefined}
        options={catalogue.registres.map((r) => ({ value: r.id, label: `${r.code} — ${r.libelle}` }))}
        required
        messageObligatoire="Choisissez le registre d’actes."
      />
    </FenetreFormulaire>
  );
}

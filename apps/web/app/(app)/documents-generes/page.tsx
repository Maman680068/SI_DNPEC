'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { acteAttestation, acteOrdre, apercu, creerAttestation, creerOrdre, deposerEnGed, getAttestations, getCatalogue, getOrdres, telecharger, transmettre } from '../../../lib/api/generateur';
import type { AttestationTravail, Catalogue, Demande, OrdreMission } from '../../../lib/generateur/types';
import { LIBELLE_GENERE, etatActe } from '../../../lib/generateur/types';
import { Eye, FileDown, Plus, Send, Stamp, X } from 'lucide-react';
import { Fenetre } from '../../../components/ui/Fenetre';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';
import { Bandeau, BandeCompteurs, BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, EnTetePage, EtatVide, LigneTableau, Onglets, Panneau, Pastille, SectionFenetre, Tableau, type TonPastille } from '../../../components/ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Onglet = 'attestations' | 'ordres' | 'rapport';
const champ = 'w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] font-normal';
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
  const [info, setInfo] = useState<string | null>(null);
  const [nouvelOrdre, setNouvelOrdre] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);

  const charger = useCallback(() => {
    getCatalogue()
      .then((c) => {
        setCatalogue(c);
        if (c.attestationTravail.peutCreer) setOnglet((o) => (o === 'rapport' ? 'attestations' : o));
      })
      .catch((e) => setErreur(messageChargement(e)));
    getAttestations().then(setAttestations).catch((e) => setErreur(messageChargement(e)));
    getOrdres().then(setOrdres).catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
    const o = new URLSearchParams(window.location.search).get('onglet');
    if (o === 'attestations' || o === 'ordres' || o === 'rapport') setOnglet(o);
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
          ) : undefined
        }
      />
      <ErreurChargement message={erreur} />
      {info && (
        <Bandeau ton="vert" action={<button type="button" className="text-[13px] font-semibold text-ink underline" onClick={() => setInfo(null)}>Masquer</button>}>
          {info}
        </Bandeau>
      )}
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

      {onglet === 'attestations' && <Attestations catalogue={catalogue} liste={attestations} onChange={charger} setInfo={setInfo} onVoir={(id) => setSelection({ type: 'attestation', id })} />}
      {onglet === 'ordres' && <Ordres catalogue={catalogue} liste={ordres} onNouvel={() => setNouvelOrdre(true)} onVoir={(id) => setSelection({ type: 'ordre', id })} />}
      {onglet === 'rapport' && <Rapport catalogue={catalogue} setInfo={setInfo} />}

      {nouvelOrdre && (
        <FenetreOrdre
          catalogue={catalogue}
          onClose={() => setNouvelOrdre(false)}
          onFait={() => (setNouvelOrdre(false), setOnglet('ordres'), setInfo('Ordre de mission enregistré.'), charger())}
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
                    setInfo={setInfo}
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
                  setInfo={setInfo}
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

function Attestations({ catalogue, liste, onChange, setInfo, onVoir }: { catalogue: Catalogue; liste: AttestationTravail[] | null; onChange: () => void; setInfo: (s: string | null) => void; onVoir: (id: string) => void }) {
  const [agentId, setAgentId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <section>
      {catalogue.attestationTravail.peutCreer && (
        <form
          className="mb-3.5 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setErreur(null);
            creerAttestation(agentId)
              .then(() => (setAgentId(''), setInfo('Attestation créée : aperçu, puis préparation de l’acte à signer.'), onChange()))
              .catch((err) => setErreur(messageChargement(err)));
          }}
        >
          <div className="min-w-[240px] flex-1 text-[12.5px] font-semibold sm:max-w-[360px]">
            <label htmlFor="attestation-agent">Agent</label>
            <select id="attestation-agent" className={`${champ} mt-1 h-[38px] py-0`} value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
              <option value="">Choisir…</option>
              {catalogue.attestationTravail.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={BTN_PRINCIPAL} disabled={!agentId}>
            <Plus aria-hidden size={16} /> Nouvelle attestation de travail
          </button>
          {erreur && <p role="alert" className="w-full text-[12.5px] text-clay">{erreur}</p>}
        </form>
      )}
      {liste === null ? (
        <Chargement erreur={null} />
      ) : (
        <Tableau
          label="Attestations de travail"
          grille={GRILLE_ATT}
          colonnes={['Agent', 'Créée le', 'Acte', <span key="a" className="sr-only">Actions</span>]}
          vide={<EtatVide texte={catalogue.attestationTravail.peutCreer ? 'Aucune attestation de travail : choisissez un agent ci-dessus.' : 'Aucune attestation de travail.'} />}
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

function FenetreOrdre({ catalogue, onClose, onFait }: { catalogue: Catalogue; onClose: () => void; onFait: () => void }) {
  const [f, setF] = useState({ agentId: '', objet: '', destination: '', dateDepart: '', dateRetour: '', transport: '', frais: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <Fenetre
      titre="Nouvel ordre de mission"
      onClose={onClose}
      largeur={620}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Enregistrer l’ordre de mission"
      onSubmit={() => {
        setEnCours(true);
        setErreur(null);
        return creerOrdre({
          agentId: f.agentId,
          objet: f.objet.trim(),
          destination: f.destination.trim(),
          dateDepart: f.dateDepart,
          dateRetour: f.dateRetour,
          transport: f.transport.trim() || undefined,
          fraisMontant: f.frais ? Number(f.frais) : undefined,
        })
          .then(onFait)
          .catch((err) => setErreur(messageChargement(err)))
          .finally(() => setEnCours(false));
      }}
    >
      <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="text-[12.5px] font-semibold">
          <label htmlFor="ordre-agent">Agent</label>
          <select id="ordre-agent" className={`${champ} mt-1`} value={f.agentId} onChange={(e) => setF({ ...f, agentId: e.target.value })} required>
            <option value="">Choisir…</option>
            {catalogue.ordreMission.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </div>
        <label className="text-[12.5px] font-semibold">
          Destination
          <input className={`${champ} mt-1`} value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} required minLength={2} />
        </label>
        <label className="text-[12.5px] font-semibold sm:col-span-2">
          Objet de la mission
          <input className={`${champ} mt-1`} value={f.objet} onChange={(e) => setF({ ...f, objet: e.target.value })} required minLength={5} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Départ
          <input type="date" className={`${champ} mt-1`} value={f.dateDepart} onChange={(e) => setF({ ...f, dateDepart: e.target.value })} required />
        </label>
        <label className="text-[12.5px] font-semibold">
          Retour
          <input type="date" className={`${champ} mt-1`} value={f.dateRetour} min={f.dateDepart || undefined} onChange={(e) => setF({ ...f, dateRetour: e.target.value })} required />
        </label>
        <label className="text-[12.5px] font-semibold">
          Moyen de transport (facultatif)
          <input className={`${champ} mt-1`} value={f.transport} onChange={(e) => setF({ ...f, transport: e.target.value })} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Frais de mission en francs guinéens (facultatif)
          <input type="number" min={0} step={1} className={`${champ} mt-1`} value={f.frais} onChange={(e) => setF({ ...f, frais: e.target.value })} />
        </label>
      </div>
    </Fenetre>
  );
}

// ------------------------------------------------------------------ rapport d'activité

function Rapport({ catalogue, setInfo }: { catalogue: Catalogue; setInfo: (s: string | null) => void }) {
  const perimetres = catalogue.rapportActivite.perimetres;
  const [choix, setChoix] = useState(0);
  const auj = new Date();
  const [debut, setDebut] = useState(`${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-01`);
  const [fin, setFin] = useState(auj.toISOString().slice(0, 10));
  const p = perimetres[choix] ?? perimetres[0]!;
  const demande: Demande = { type: 'RAPPORT_ACTIVITE', perimetre: p.perimetre, cibleId: p.cibleId ?? undefined, debut, fin };
  return (
    <Panneau titre="Rapport d’activité" className="max-w-[860px]">
      <div className="px-[18px] py-4">
      <p className="mb-3 text-[12.5px] text-text-muted">Construit depuis les tâches de la période et du périmètre (celles que vous voyez), jamais ressaisi.</p>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-[12.5px] font-semibold">
          Périmètre
          <select className={`${champ} mt-1`} value={choix} onChange={(e) => setChoix(Number(e.target.value))}>
            {perimetres.map((x, i) => (
              <option key={`${x.perimetre}-${x.cibleId}`} value={i}>
                {x.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] font-semibold">
          Du
          <input type="date" className={`${champ} mt-1`} value={debut} onChange={(e) => setDebut(e.target.value)} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Au
          <input type="date" className={`${champ} mt-1`} value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
        </label>
      </div>
      <Actions demande={demande} catalogue={catalogue} setInfo={setInfo} />
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
  const [url, setUrl] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <>
      <button
        type="button"
        className={`${BTN_LIGNE} gap-1 disabled:opacity-50`}
        disabled={enCours}
        title={erreur ?? undefined}
        onClick={() => {
          setEnCours(true);
          setErreur(null);
          apercu(demande)
            .then(setUrl)
            .catch((e) => setErreur(e instanceof Error ? e.message : 'Aperçu impossible'))
            .finally(() => setEnCours(false));
        }}
      >
        <Eye aria-hidden size={14} /> Aperçu
      </button>
      {erreur && <span role="alert" className="sr-only">{erreur}</span>}
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
  setInfo,
  colonne = false,
}: {
  demande: Demande;
  catalogue: Catalogue;
  destinataireParDefaut?: string;
  preparerActe?: (registreId: string) => Promise<{ acteId: string }>;
  onChange?: () => void;
  setInfo: (s: string | null) => void;
  /** Colonne d'actions d'une fenêtre de détail : boutons pleine largeur, l'acte en premier. */
  colonne?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<'transmettre' | 'acte' | null>(null);
  const [destinataire, setDestinataire] = useState(destinataireParDefaut ?? '');
  const [message, setMessage] = useState('');
  const [registreId, setRegistreId] = useState(catalogue.registres[0]?.id ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurFenetre, setErreurFenetre] = useState<string | null>(null);
  const [ged, setGed] = useState<string | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function agir(fn: () => Promise<unknown>, ok?: string): Promise<boolean> {
    setEnCours(true);
    setErreur(null);
    setErreurFenetre(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      return true;
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Action impossible';
      if (fenetre) setErreurFenetre(m);
      else setErreur(m);
      return false;
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
          <button type="button" className={`${b} gap-1`} disabled={enCours} onClick={() => agir(() => telecharger(demande, 'PDF'))}>
            <FileDown aria-hidden size={colonne ? 16 : 14} /> PDF
          </button>
          <button type="button" className={b} disabled={enCours} onClick={() => agir(() => telecharger(demande, 'DOCX'))}>
            Word
          </button>
        </div>
        {catalogue.peutDeposerEnGed && (
          <button type="button" className={b} disabled={enCours} onClick={() => agir(async () => setGed((await deposerEnGed(demande)).documentId), 'Document déposé dans la GED de votre division (statut Brouillon).')}>
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
      {erreur && <p role="alert" className="mt-1.5 text-[12.5px] text-clay">{erreur}</p>}

      {fenetre === 'transmettre' && (
        <Fenetre
          titre={`Transmettre — ${LIBELLE_GENERE[demande.type]}`}
          onClose={() => setFenetre(null)}
          enCours={enCours}
          erreur={erreurFenetre}
          libelleValider="Envoyer"
          onSubmit={async () => {
            if (await agir(() => transmettre(demande, destinataire, message.trim() || undefined), 'Document transmis par la messagerie (PDF joint).')) setFenetre(null);
          }}
        >
          <label className="mb-3 block text-[12.5px] font-semibold">
            Destinataire
            <select className={`${champ} mt-1`} value={destinataire} onChange={(e) => setDestinataire(e.target.value)} required>
              <option value="">Choisir…</option>
              {catalogue.destinataires.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block text-[12.5px] font-semibold">
            Message (facultatif)
            <input className={`${champ} mt-1`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
          </label>
        </Fenetre>
      )}

      {fenetre === 'acte' && preparerActe && (
        <Fenetre
          titre="Préparer l’acte"
          onClose={() => setFenetre(null)}
          enCours={enCours}
          erreur={erreurFenetre}
          libelleValider="Créer l’acte"
          onSubmit={async () => {
            if (registreId && (await agir(() => preparerActe(registreId), 'Acte créé dans le module Courrier : visa, puis signature du DN ou de la DNA.'))) {
              setFenetre(null);
              onChange?.();
            }
          }}
        >
          <p className="mb-3 text-[12.5px] text-text-muted">{LIBELLE_GENERE[demande.type]} : un acte est créé avec le document en projet ; il suit le circuit habituel et reçoit son numéro à la signature.</p>
          <label className="mb-3 block text-[12.5px] font-semibold">
            Registre d’actes de la Direction
            <select className={`${champ} mt-1`} value={registreId} onChange={(e) => setRegistreId(e.target.value)} required>
              {catalogue.registres.length === 0 && <option value="">Aucun registre d’actes actif</option>}
              {catalogue.registres.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.libelle}
                </option>
              ))}
            </select>
          </label>
        </Fenetre>
      )}

      {url && <ApercuDocument url={url} type={demande.type} onClose={() => setUrl(null)} />}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { acteAttestation, acteOrdre, apercu, creerAttestation, creerOrdre, deposerEnGed, getAttestations, getCatalogue, getOrdres, telecharger, transmettre } from '../../../lib/api/generateur';
import type { AttestationTravail, Catalogue, Demande, OrdreMission } from '../../../lib/generateur/types';
import { LIBELLE_GENERE, etatActe } from '../../../lib/generateur/types';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Onglet = 'attestations' | 'ordres' | 'rapport';
const petit = '!px-3 !py-1.5 !text-[12.5px]';
const champ = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const signe = (a: { statut: string } | null) => !!a && (a.statut === 'SIGNE' || a.statut === 'EXPEDIE');

/** Documents générés (socle N4) : attestation de travail, ordre de mission, rapport d'activité,
 * produits depuis les données enregistrées ; aperçu fidèle, PDF, Word, dépôt en GED, transmission. */
export default function DocumentsGeneresPage() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [attestations, setAttestations] = useState<AttestationTravail[] | null>(null);
  const [ordres, setOrdres] = useState<OrdreMission[] | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('rapport');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} />
      </div>
    );
  }
  const onglets: { cle: Onglet; libelle: string; visible: boolean }[] = [
    { cle: 'attestations', libelle: 'Attestations de travail', visible: catalogue.attestationTravail.peutCreer || (attestations?.length ?? 0) > 0 },
    { cle: 'ordres', libelle: 'Ordres de mission', visible: catalogue.ordreMission.peutCreer || (ordres?.length ?? 0) > 0 },
    { cle: 'rapport', libelle: 'Rapport d’activité', visible: true },
  ];

  return (
    <div className="max-w-[980px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
      <h1 className="mb-1 text-[22px] font-extrabold">Documents générés</h1>
      <p className="mb-5 text-[13px] text-text-muted">
        Produits à partir des données enregistrées, sans ressaisie, avec l’en-tête de la République et de la Direction. Un document signé imprimé une seconde fois porte la mention « DUPLICATA ».
      </p>
      <ErreurChargement message={erreur} />
      {info && (
        <div className="mb-4 rounded-md bg-sage-soft px-4 py-2.5 text-[13px] text-sage" role="status">
          {info}
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }} role="tablist">
        {onglets
          .filter((o) => o.visible)
          .map((o) => (
            <button
              key={o.cle}
              role="tab"
              aria-selected={onglet === o.cle}
              onClick={() => setOnglet(o.cle)}
              className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${onglet === o.cle ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
            >
              {o.libelle}
            </button>
          ))}
      </div>

      {onglet === 'attestations' && (
        <Attestations catalogue={catalogue} liste={attestations} onChange={charger} setInfo={setInfo} />
      )}
      {onglet === 'ordres' && <Ordres catalogue={catalogue} liste={ordres} onChange={charger} setInfo={setInfo} />}
      {onglet === 'rapport' && <Rapport catalogue={catalogue} setInfo={setInfo} />}
    </div>
  );
}

// ------------------------------------------------------------------ attestations de travail

function Attestations({ catalogue, liste, onChange, setInfo }: { catalogue: Catalogue; liste: AttestationTravail[] | null; onChange: () => void; setInfo: (s: string | null) => void }) {
  const [agentId, setAgentId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <section>
      {catalogue.attestationTravail.peutCreer && (
        <form
          className="mb-5 flex flex-wrap items-end gap-2.5 rounded-lg border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErreur(null);
            creerAttestation(agentId)
              .then(() => (setAgentId(''), setInfo('Attestation créée : aperçu, puis préparation de l’acte à signer.'), onChange()))
              .catch((err) => setErreur(messageChargement(err)));
          }}
        >
          <label className="min-w-[240px] flex-1 text-[12.5px] font-semibold">
            Agent
            <select className={`${champ} mt-1`} value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
              <option value="">Choisir…</option>
              {catalogue.attestationTravail.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="gold" disabled={!agentId}>
            Nouvelle attestation de travail
          </Button>
          {erreur && <p className="w-full text-[12.5px] text-clay">{erreur}</p>}
        </form>
      )}
      {liste === null ? (
        <Chargement erreur={null} />
      ) : liste.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-faint">Aucune attestation de travail.</p>
      ) : (
        <ul className="space-y-3">
          {liste.map((a) => (
            <li key={a.id} className="rounded-lg border border-line bg-surface p-4" data-testid="attestation-travail">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-bold">{a.agent.nom}</span>
                <Badge tone={signe(a.acte) ? 'sage' : 'gold'}>{etatActe(a.acte)}</Badge>
              </div>
              <p className="mb-3 text-[12px] text-text-faint">Créée le {date(a.createdAt)}</p>
              {a.droits.produire ? (
                <Actions
                  demande={{ type: 'ATTESTATION_TRAVAIL', attestationId: a.id }}
                  catalogue={catalogue}
                  destinataireParDefaut={a.agent.id}
                  preparerActe={a.droits.preparerActe ? (r) => acteAttestation(a.id, r) : undefined}
                  onChange={onChange}
                  setInfo={setInfo}
                />
              ) : (
                <p className="text-[12.5px] text-text-muted">Disponible une fois l’acte signé par la Direction.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ ordres de mission

function Ordres({ catalogue, liste, onChange, setInfo }: { catalogue: Catalogue; liste: OrdreMission[] | null; onChange: () => void; setInfo: (s: string | null) => void }) {
  const vide = { agentId: '', objet: '', destination: '', dateDepart: '', dateRetour: '', transport: '', frais: '' };
  const [f, setF] = useState(vide);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <section>
      {catalogue.ordreMission.peutCreer &&
        (ouvert ? (
          <form
            className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setErreur(null);
              creerOrdre({
                agentId: f.agentId,
                objet: f.objet.trim(),
                destination: f.destination.trim(),
                dateDepart: f.dateDepart,
                dateRetour: f.dateRetour,
                transport: f.transport.trim() || undefined,
                fraisMontant: f.frais ? Number(f.frais) : undefined,
              })
                .then(() => (setF(vide), setOuvert(false), setInfo('Ordre de mission enregistré.'), onChange()))
                .catch((err) => setErreur(messageChargement(err)));
            }}
          >
            <label className="text-[12.5px] font-semibold">
              Agent
              <select className={`${champ} mt-1`} value={f.agentId} onChange={(e) => setF({ ...f, agentId: e.target.value })} required>
                <option value="">Choisir…</option>
                {catalogue.ordreMission.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </label>
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
            {erreur && <p className="text-[12.5px] text-clay sm:col-span-2">{erreur}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="gold">
                Enregistrer l’ordre de mission
              </Button>
              <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="gold" className="mb-5" onClick={() => setOuvert(true)}>
            + Nouvel ordre de mission
          </Button>
        ))}
      {liste === null ? (
        <Chargement erreur={null} />
      ) : liste.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-faint">Aucun ordre de mission.</p>
      ) : (
        <ul className="space-y-3">
          {liste.map((o) => (
            <li key={o.id} className="rounded-lg border border-line bg-surface p-4" data-testid="ordre-mission">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-bold">
                  {o.agent.nom} — {o.destination}
                </span>
                <Badge tone={signe(o.acte) ? 'sage' : 'gold'}>{etatActe(o.acte)}</Badge>
              </div>
              <p className="text-[12.5px] text-text-muted">{o.objet}</p>
              <p className="mb-3 text-[12px] text-text-faint">
                Du {date(o.dateDepart)} au {date(o.dateRetour)}
                {o.fraisEnLettres ? ` · frais : ${o.fraisEnLettres}` : ''}
              </p>
              {o.vehicule && (
                <p className="mb-3 -mt-2 text-[12px] text-text-muted" data-testid="vehicule-mission">
                  Véhicule de service : {o.vehicule.immatriculation} ({o.vehicule.marque} {o.vehicule.modele})
                  {o.vehicule.kilometrageRetour !== null && o.vehicule.kilometrageDepart !== null
                    ? ` · ${(o.vehicule.kilometrageRetour - o.vehicule.kilometrageDepart).toLocaleString('fr-FR')} km parcourus`
                    : ''}
                </p>
              )}
              <Actions demande={{ type: 'ORDRE_MISSION', ordreMissionId: o.id }} catalogue={catalogue} destinataireParDefaut={o.agent.id} preparerActe={o.droits.preparerActe ? (r) => acteOrdre(o.id, r) : undefined} onChange={onChange} setInfo={setInfo} />
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <section className="rounded-lg border border-line bg-surface p-4">
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
    </section>
  );
}

// ------------------------------------------------------------------ actions communes (aperçu, PDF, Word, GED, transmettre, acte)

function Actions({
  demande,
  catalogue,
  destinataireParDefaut,
  preparerActe,
  onChange,
  setInfo,
}: {
  demande: Demande;
  catalogue: Catalogue;
  destinataireParDefaut?: string;
  preparerActe?: (registreId: string) => Promise<{ acteId: string }>;
  onChange?: () => void;
  setInfo: (s: string | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<'transmettre' | 'acte' | null>(null);
  const [destinataire, setDestinataire] = useState(destinataireParDefaut ?? '');
  const [message, setMessage] = useState('');
  const [registreId, setRegistreId] = useState(catalogue.registres[0]?.id ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ged, setGed] = useState<string | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function agir(fn: () => Promise<unknown>, ok?: string) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div data-testid="actions-document">
      <div className="flex flex-wrap gap-2">
        <Button className={petit} disabled={enCours} onClick={() => agir(async () => setUrl(await apercu(demande)))}>
          Aperçu
        </Button>
        <Button variant="outline" className={petit} disabled={enCours} onClick={() => agir(() => telecharger(demande, 'PDF'))}>
          PDF
        </Button>
        <Button variant="outline" className={petit} disabled={enCours} onClick={() => agir(() => telecharger(demande, 'DOCX'))}>
          Word
        </Button>
        {catalogue.peutDeposerEnGed && (
          <Button variant="outline" className={petit} disabled={enCours} onClick={() => agir(async () => setGed((await deposerEnGed(demande)).documentId), 'Document déposé dans la GED de votre division (statut Brouillon).')}>
            Déposer en GED
          </Button>
        )}
        <Button variant="outline" className={petit} disabled={enCours} onClick={() => setFenetre('transmettre')}>
          Transmettre
        </Button>
        {preparerActe && (
          <Button variant="gold" className={petit} disabled={enCours} onClick={() => setFenetre('acte')}>
            Préparer l’acte
          </Button>
        )}
      </div>
      {ged && (
        <p className="mt-2 text-[12.5px]">
          <Link className="text-accent underline" href={`/documents?id=${ged}`}>
            Ouvrir le document déposé
          </Link>
        </p>
      )}
      {erreur && <p className="mt-2 text-[12.5px] text-clay">{erreur}</p>}

      {fenetre === 'transmettre' && (
        <form
          className="mt-3 rounded-md border border-line bg-bg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir(() => transmettre(demande, destinataire, message.trim() || undefined), 'Document transmis par la messagerie (PDF joint).').then(() => setFenetre(null));
          }}
        >
          <label className="mb-2 block text-[12.5px] font-semibold">
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
          <label className="mb-2 block text-[12.5px] font-semibold">
            Message (facultatif)
            <input className={`${champ} mt-1`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" className={petit} disabled={enCours || !destinataire}>
              Envoyer
            </Button>
            <Button type="button" variant="outline" className={petit} onClick={() => setFenetre(null)}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {fenetre === 'acte' && preparerActe && (
        <form
          className="mt-3 rounded-md border border-line bg-bg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir(() => preparerActe(registreId), 'Acte créé dans le module Courrier : visa, puis signature du DN ou de la DNA.').then(() => (setFenetre(null), onChange?.()));
          }}
        >
          <p className="mb-2 text-[12.5px] text-text-muted">{LIBELLE_GENERE[demande.type]} : un acte est créé avec le document en projet ; il suit le circuit habituel et reçoit son numéro à la signature.</p>
          <label className="mb-2 block text-[12.5px] font-semibold">
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
          <div className="flex gap-2">
            <Button type="submit" variant="gold" className={petit} disabled={enCours || !registreId}>
              Créer l’acte
            </Button>
            <Button type="button" variant="outline" className={petit} onClick={() => setFenetre(null)}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.55)] p-3" onClick={() => setUrl(null)}>
          <div className="flex h-[92vh] w-full max-w-[820px] flex-col rounded-lg bg-surface" role="dialog" aria-label="Aperçu du document" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-[14px] font-bold">Aperçu — {LIBELLE_GENERE[demande.type]}</span>
              <button onClick={() => setUrl(null)} aria-label="Fermer l’aperçu" className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
                ✕
              </button>
            </div>
            <iframe title="Aperçu du document" src={url} className="w-full flex-1 rounded-b-lg" data-testid="apercu-document" />
          </div>
        </div>
      )}
    </div>
  );
}

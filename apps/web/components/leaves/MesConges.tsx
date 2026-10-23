'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, Paperclip, Plus } from 'lucide-react';
import { cancelLeaveRequest, deposerCertificat, getContexteConge, getJoursFeries, telechargerCertificat } from '../../lib/api/leaves';
import { CODE_CONGE_ANNUEL, CODE_CONGE_MALADIE, LIBELLE_AVIS } from '../../lib/leaves/types';
import type { JourFerie, LeaveBalanceView, LeaveRequest } from '../../lib/leaves/types';
import { Anneau, BTN_PRINCIPAL, BTN_SECONDAIRE, Circuit, EtatVide, LigneTableau, Pastille, Tableau, type EtatEtape } from '../ui/Charte';
import { Chargement, messageChargement } from '../ui/ErreurChargement';
import { ZoneDepot } from '../ui/Formulaire';
import { Barre } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';
import { dateCourte, echeanceCourte, jourIso, jours, pastilleEtape, periode, typeEnPhrase } from './format';

const anneeDe = (iso: string) => new Date(iso).getUTCFullYear();
const HISTORIQUE_COURT = 5;

/**
 * « Mes congés » (refonte de l'interface) : bande de soldes (anneau du congé annuel, autres types,
 * absences maladie de l'agent lui-même), demandes en cours avec leur circuit en 4 étapes, historique
 * de l'année en tableau ; à droite, calendrier du mois et prochains jours fériés.
 */
export function MesConges({
  requests,
  balances,
  year,
  years,
  onYear,
  erreur,
  highlightId,
  onOpen,
  onChange,
  onCreate,
  onVoirFeries,
}: {
  requests: LeaveRequest[] | null;
  balances: LeaveBalanceView[] | null;
  year: number;
  years: number[];
  onYear: (year: number) => void;
  erreur: string | null;
  highlightId: string | null;
  onOpen: (r: LeaveRequest) => void;
  onChange: (r: LeaveRequest) => void;
  onCreate: () => void;
  onVoirFeries: () => void;
}) {
  const [feries, setFeries] = useState<Record<number, JourFerie[]>>({});
  const [erreurFeries, setErreurFeries] = useState<string | null>(null);
  const demandees = useRef(new Set<number>());

  const chargerFeries = useCallback((annee: number) => {
    if (demandees.current.has(annee)) return;
    demandees.current.add(annee);
    getJoursFeries(annee)
      .then((c) => setFeries((prev) => ({ ...prev, [annee]: c.jours })))
      .catch((err) => setErreurFeries(messageChargement(err)));
  }, []);

  const enCours = useMemo(() => (requests ?? []).filter((r) => r.status === 'EN_ATTENTE').sort((a, b) => a.startDate.localeCompare(b.startDate)), [requests]);
  const historique = useMemo(() => (requests ?? []).filter((r) => r.status !== 'EN_ATTENTE' && anneeDe(r.startDate) === year), [requests, year]);

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <BandeSoldes balances={balances} requests={requests} year={year} erreur={erreur} />

        <section aria-label="Mes demandes" className="rounded-xl border border-line bg-surface">
          <div className="px-[18px] pb-1 pt-4">
            <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{enCours.length > 1 ? `Demandes en cours (${enCours.length})` : 'Demande en cours'}</h2>
          </div>
          {requests === null ? (
            <div className="px-[18px] py-4">
              <Chargement erreur={erreur} />
            </div>
          ) : enCours.length === 0 ? (
            <EtatVide
              texte="Aucune demande en cours."
              action={
                <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[13px]`} onClick={onCreate}>
                  Demander un congé
                </button>
              }
            />
          ) : (
            enCours.map((r, i) => <DemandeEnCours key={r.id} request={r} premiere={i === 0} highlight={r.id === highlightId} onChange={onChange} onOpen={onOpen} />)
          )}

          <div className="mt-2 border-t border-line">
            <div className="flex flex-wrap items-center gap-2.5 px-[18px] pb-2 pt-3.5">
              <h2 className="font-heading text-[15.5px] font-bold text-ink-900">Historique {year}</h2>
              <select aria-label="Année du solde" value={year} onChange={(e) => onYear(Number(e.target.value))} className="ml-auto h-8 rounded-[8px] border border-line bg-surface px-2 text-[12.5px] font-semibold text-text">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <Historique requests={historique} year={year} onOpen={onOpen} highlightId={highlightId} />
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <CalendrierConges requests={requests ?? []} feries={feries} chargerFeries={chargerFeries} moisInitial={enCours[0]?.startDate ?? null} erreur={erreurFeries} />
        <ProchainsFeries feries={feries} chargerFeries={chargerFeries} onVoirFeries={onVoirFeries} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- bande de soldes

function BandeSoldes({ balances, requests, year, erreur }: { balances: LeaveBalanceView[] | null; requests: LeaveRequest[] | null; year: number; erreur: string | null }) {
  if (balances === null) {
    return (
      <div className="mb-[18px] rounded-xl border border-line bg-surface px-[18px] py-4">
        <Chargement erreur={erreur} />
      </div>
    );
  }
  const duAn = balances.filter((b) => b.year === year && b.leaveTypeCode !== CODE_CONGE_MALADIE);
  const annuel = duAn.find((b) => b.leaveTypeCode === CODE_CONGE_ANNUEL);
  const autres = duAn.filter((b) => b !== annuel);
  const miennes = requests ?? [];
  const demandes = annuel ? miennes.filter((r) => r.status === 'EN_ATTENTE' && r.leaveTypeId === annuel.leaveTypeId && anneeDe(r.startDate) === year).reduce((s, r) => s + r.daysCount, 0) : 0;
  // Absences maladie : l'agent lui-même seulement (ses propres demandes, approuvées).
  const maladie = miennes.filter((r) => r.status === 'APPROUVEE' && r.leaveType.code === CODE_CONGE_MALADIE && anneeDe(r.startDate) === year).reduce((s, r) => s + r.daysCount, 0);
  const cellule = (cle: string, contenu: ReactNode, large = false) => (
    <div key={cle} className={`flex min-w-0 items-center gap-3.5 px-[18px] py-4 ${large ? 'lg:flex-[1.3]' : 'lg:flex-1'}`}>
      {contenu}
    </div>
  );
  const texte = (titre: string, valeur: string, sous: string) => (
    <div className="min-w-0">
      <b className="block text-[14px] font-semibold text-text">{titre}</b>
      <span className="block font-heading text-[22px] font-extrabold leading-tight text-ink-900">{valeur}</span>
      <small className="mt-0.5 block text-[12.5px] text-text-muted">{sous}</small>
    </div>
  );
  return (
    <section aria-label={`Mes soldes ${year}`} data-testid="soldes-conges" className="mb-[18px] flex flex-col divide-y divide-line rounded-xl border border-line bg-surface lg:flex-row lg:divide-x lg:divide-y-0">
      {annuel &&
        cellule(
          annuel.id,
          <>
            <Anneau valeur={annuel.totalDays > 0 ? (annuel.remainingDays / annuel.totalDays) * 100 : 0} label={`${annuel.remainingDays} jours restants sur ${annuel.totalDays}`} />
            {texte(`${annuel.leaveTypeName} ${year}`, `${annuel.remainingDays} j`, `restants sur ${annuel.totalDays}${demandes > 0 ? ` · ${demandes} j demandés` : ''}`)}
          </>,
          true,
        )}
      {autres.map((b) => cellule(b.id, texte(b.leaveTypeName, `${b.remainingDays} j`, `restants sur ${b.totalDays}`)))}
      {duAn.length === 0 && cellule('vide', <p className="text-[13px] text-text-muted">Aucun solde provisionné pour {year} pour l’instant.</p>, true)}
      {cellule('maladie', texte('Absences maladie', `${maladie} j`, year === new Date().getFullYear() ? 'cette année' : `en ${year}`))}
    </section>
  );
}

// ---------------------------------------------------------------------- demande en cours

function DemandeEnCours({ request: r, premiere, highlight, onChange, onOpen }: { request: LeaveRequest; premiere: boolean; highlight: boolean; onChange: (r: LeaveRequest) => void; onOpen: (r: LeaveRequest) => void }) {
  const [chef, setChef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const bloc = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (r.etape !== 'AVIS_ATTENDU') return;
    // Chef qui doit donner l'avis (le plus proche) : lu par la route de contexte, ouverte au demandeur.
    getContexteConge(r.id)
      .then((c) => setChef(c.avisants.map((a) => a.nom).join(', ') || null))
      .catch(() => setChef(null));
  }, [r.id, r.etape]);

  useEffect(() => {
    if (highlight) bloc.current?.scrollIntoView({ block: 'center' });
  }, [highlight]);

  const p = pastilleEtape(r);
  const avisEtat: EtatEtape = r.avisEtat ? 'fait' : 'courant';
  const etapes = [
    { label: 'Demande envoyée', detail: dateCourte(r.createdAt), etat: 'fait' as EtatEtape },
    {
      label: r.avisEtat ? `${LIBELLE_AVIS[r.avisEtat]}` : chef ? `Avis de ${chef}` : 'Avis du chef',
      detail: r.avisEtat ? (r.avisPar ? r.avisPar.nom : r.avisLe ? dateCourte(r.avisLe) : null) : r.avisEcheance ? `avant le ${echeanceCourte(r.avisEcheance)}` : null,
      etat: avisEtat,
    },
    { label: 'Décision du DRH', detail: r.avisEtat ? 'en cours' : 'ensuite', etat: (r.avisEtat ? 'courant' : 'avenir') as EtatEtape },
    { label: 'Solde mis à jour', detail: 'automatique', etat: 'avenir' as EtatEtape },
  ];

  async function annuler() {
    setBusy(true);
    try {
      onChange(await cancelLeaveRequest(r.id));
      toast.succes('Demande annulée', { detail: `${r.leaveType.name} · ${jours(r.daysCount)}${chef ? ` · ${chef} n’a plus d’avis à donner` : ''}.` });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err, 'La demande n’a pas pu être annulée.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={bloc} data-testid="demande-en-cours" className={`px-[18px] py-4 ${premiere ? '' : 'border-t border-line'} ${highlight ? 'ring-2 ring-inset ring-gold' : ''}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" className="text-left text-[15px] font-bold text-text hover:underline" onClick={() => onOpen(r)}>
          {r.leaveType.name} · {jours(r.daysCount)}
        </button>
        <span className="ml-auto">
          <Pastille ton={p.ton}>{p.texte}</Pastille>
        </span>
      </div>
      <div className="mt-[3px] text-[13px] text-text-muted">
        Du {periodeLongue(r.startDate, r.endDate)} · déposée le {dateCourte(r.createdAt)}
      </div>
      <Circuit label={`Circuit de la demande : ${typeEnPhrase(r.leaveType.name)}`} etapes={etapes.map((e) => ({ ...e, detail: e.detail ? <span className="block">{e.detail}</span> : undefined }))} />
      <div className="flex flex-wrap items-center gap-2.5 rounded-[9px] bg-fond-doux px-3 py-2.5 text-[13px] text-text-fort" data-testid="etape-conge">
        <CircleHelp aria-hidden size={16} className="flex-none text-text-muted" />
        <span className="min-w-0 flex-1">
          {r.etape === 'AVIS_ATTENDU' && r.avisEcheance
            ? `Sans réponse de votre chef avant le ${new Date(r.avisEcheance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, son avis est réputé favorable.`
            : r.avisEtat
              ? `${LIBELLE_AVIS[r.avisEtat]}${r.avisPar ? ` (${r.avisPar.nom})` : ''}. Décision du DRH attendue.`
              : 'Votre chef donne son avis, puis le DRH décide.'}
        </span>
        {r.droits?.peutAnnuler && (
          <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[13px]`} disabled={busy} onClick={annuler}>
            Annuler la demande
          </button>
        )}
      </div>
      {(r.droits?.deposerCertificat || r.certificat) && <Certificat request={r} onChange={onChange} />}
    </div>
  );
}

/** « jeudi 12 au jeudi 19 novembre 2026 ». */
function periodeLongue(debut: string, fin: string): string {
  const opt = { timeZone: 'UTC', weekday: 'long', day: 'numeric' } as const;
  const d = new Date(debut);
  const f = new Date(fin);
  const finTexte = f.toLocaleDateString('fr-FR', { ...opt, month: 'long', year: 'numeric' });
  if (jourIso(debut) === jourIso(fin)) return finTexte;
  const memeMois = d.getUTCMonth() === f.getUTCMonth() && d.getUTCFullYear() === f.getUTCFullYear();
  const debutTexte = d.toLocaleDateString('fr-FR', memeMois ? opt : { ...opt, month: 'long', ...(d.getUTCFullYear() !== f.getUTCFullYear() ? { year: 'numeric' } : {}) });
  return `${debutTexte} au ${finTexte}`;
}

/** Certificat médical d'un congé maladie : l'agent le joint ; lui et le DRH le lisent. */
function Certificat({ request: r, onChange }: { request: LeaveRequest; onChange: (r: LeaveRequest) => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  function deposer(fichiers: File[]) {
    const f = fichiers[0];
    if (!f || busy) return;
    setBusy(true);
    deposerCertificat(r.id, f)
      .then((maj) => {
        onChange(maj);
        toast.succes(r.certificat ? 'Certificat remplacé' : 'Certificat médical joint', { detail: 'Visible de vous et du DRH seulement.' });
      })
      .catch((err) => toast.erreur('Action impossible', messageErreur(err, 'Le certificat n’a pas pu être déposé.')))
      .finally(() => setBusy(false));
  }
  return (
    <div className="mt-2.5 text-[12.5px]" data-testid="certificat-medical">
      {r.certificat ? (
        <button
          type="button"
          className="mb-2 inline-flex items-center gap-1.5 font-semibold text-ink underline"
          onClick={() => telechargerCertificat(r.id).catch((e) => toast.erreur('Téléchargement impossible', messageErreur(e)))}
        >
          <Paperclip aria-hidden size={14} />
          Certificat médical : {r.certificat.nom}
        </button>
      ) : (
        <p className="mb-2 text-text-muted">Aucun certificat médical joint (visible de vous et du DRH seulement).</p>
      )}
      {r.droits?.deposerCertificat && (
        <ZoneDepot
          id={`certificat-${r.id}`}
          label={r.certificat ? 'Remplacer le certificat' : 'Joindre le certificat médical'}
          fichiers={[]}
          onChange={deposer}
          aide={busy ? 'Envoi en cours…' : 'PDF ou image · 25 Mo au plus'}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- historique

const GRILLE_HISTORIQUE = 'lg:grid-cols-[minmax(0,1fr)_150px_60px_190px]';

function Historique({ requests, year, onOpen, highlightId }: { requests: LeaveRequest[]; year: number; onOpen: (r: LeaveRequest) => void; highlightId: string | null }) {
  const [tout, setTout] = useState(false);
  const visibles = tout ? requests : requests.slice(0, HISTORIQUE_COURT);
  if (requests.length === 0) return <EtatVide texte={`Aucune demande close en ${year}.`} />;
  return (
    <div className="[&>div]:rounded-none [&>div]:rounded-b-xl [&>div]:border-x-0 [&>div]:border-b-0">
      <Tableau
        label={`Historique de mes congés ${year}`}
        testid="historique-conges"
        colonnes={['Type', 'Période', 'Durée', 'Décision']}
        grille={GRILLE_HISTORIQUE}
        pied={
          requests.length > HISTORIQUE_COURT ? (
            <button type="button" className="ml-auto text-[12.5px] font-semibold text-ink hover:underline" onClick={() => setTout((v) => !v)}>
              {tout ? 'Réduire' : `Tout voir (${requests.length})`}
            </button>
          ) : undefined
        }
      >
        {visibles.map((r) => {
          const p = pastilleEtape(r);
          return (
            <LigneTableau key={r.id} grille={GRILLE_HISTORIQUE} onClick={() => onOpen(r)} label={`${r.leaveType.name}, ${periode(r.startDate, r.endDate)} : ${p.texte}`} actif={r.id === highlightId}>
              <span>{r.leaveType.name}</span>
              <span>{periode(r.startDate, r.endDate)}</span>
              <span>{r.daysCount} j</span>
              <Pastille ton={p.ton}>{p.texte}</Pastille>
            </LigneTableau>
          );
        })}
      </Tableau>
    </div>
  );
}

// ---------------------------------------------------------------------- calendrier du mois

const JOURS_SEMAINE: [string, string][] = [
  ['L', 'lundi'],
  ['M', 'mardi'],
  ['M', 'mercredi'],
  ['J', 'jeudi'],
  ['V', 'vendredi'],
  ['S', 'samedi'],
  ['D', 'dimanche'],
];

function CalendrierConges({
  requests,
  feries,
  chargerFeries,
  moisInitial,
  erreur,
}: {
  requests: LeaveRequest[];
  feries: Record<number, JourFerie[]>;
  chargerFeries: (annee: number) => void;
  moisInitial: string | null;
  erreur: string | null;
}) {
  const aujourdhui = jourIso(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())));
  const [mois, setMois] = useState<{ a: number; m: number }>(() => {
    const d = moisInitial ? new Date(moisInitial) : new Date();
    return moisInitial ? { a: d.getUTCFullYear(), m: d.getUTCMonth() } : { a: d.getFullYear(), m: d.getMonth() };
  });
  useEffect(() => chargerFeries(mois.a), [mois.a, chargerFeries]);

  // Tous les jours de la période sont surlignés (décompte en jours calendaires, fériés exclus).
  const conges = useMemo(() => {
    const s = new Set<string>();
    for (const r of requests) {
      if (r.status !== 'EN_ATTENTE' && r.status !== 'APPROUVEE') continue;
      for (let t = new Date(r.startDate).getTime(); t <= new Date(r.endDate).getTime(); t += 864e5) s.add(jourIso(new Date(t)));
    }
    return s;
  }, [requests]);
  const feriesDuMois = useMemo(() => new Map((feries[mois.a] ?? []).map((f) => [jourIso(f.date), f.libelle])), [feries, mois.a]);

  const premier = new Date(Date.UTC(mois.a, mois.m, 1));
  const decalage = (premier.getUTCDay() + 6) % 7;
  const nbJours = new Date(Date.UTC(mois.a, mois.m + 1, 0)).getUTCDate();
  const cases: (string | null)[] = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => jourIso(new Date(Date.UTC(mois.a, mois.m, i + 1))))];
  while (cases.length % 7) cases.push(null);
  const semaines = Array.from({ length: cases.length / 7 }, (_, i) => cases.slice(i * 7, i * 7 + 7));
  const titre = premier.toLocaleDateString('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const titreMaj = titre.charAt(0).toUpperCase() + titre.slice(1);
  const changer = (delta: number) => setMois(({ a, m }) => ({ a: m + delta < 0 ? a - 1 : m + delta > 11 ? a + 1 : a, m: (m + delta + 12) % 12 }));

  return (
    <section aria-label="Calendrier de mes congés" data-testid="calendrier-conges" className="rounded-xl border border-line bg-surface px-[18px] py-4">
      <div className="flex items-center gap-1">
        <h2 className="flex-1 font-heading text-[15.5px] font-bold text-ink-900">{titreMaj}</h2>
        <button type="button" aria-label="Mois précédent" onClick={() => changer(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-bg">
          <ChevronLeft aria-hidden size={17} />
        </button>
        <button type="button" aria-label="Mois suivant" onClick={() => changer(1)} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-bg">
          <ChevronRight aria-hidden size={17} />
        </button>
      </div>
      <table className="mt-2.5 w-full table-fixed border-separate border-spacing-[3px] text-center text-[12px]">
        <caption className="sr-only">{titreMaj} : mes congés et les jours fériés</caption>
        <thead>
          <tr>
            {JOURS_SEMAINE.map(([court, long], i) => (
              <th key={i} scope="col" className="h-[22px] text-[11px] font-semibold text-text-faint">
                <abbr title={long} className="no-underline">
                  {court}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semaines.map((s, i) => (
            <tr key={i}>
              {s.map((j, k) => {
                if (!j) return <td key={k} />;
                const ferie = feriesDuMois.get(j);
                const conge = conges.has(j);
                const auj = j === aujourdhui;
                const classe = ferie ? 'bg-clay-50 font-bold text-clay' : conge ? 'bg-gold-50 font-bold text-ambre' : 'text-text';
                return (
                  <td key={k} className={`h-[30px] rounded-[7px] ${classe} ${auj ? 'outline outline-2 -outline-offset-2 outline-ink' : ''}`} title={ferie ?? undefined}>
                    {Number(j.slice(8))}
                    {(ferie || conge || auj) && <span className="sr-only">{[auj && 'aujourd’hui', conge && 'mon congé', ferie && `jour férié : ${ferie}`].filter(Boolean).join(', ')}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2.5 flex flex-wrap gap-3.5 text-[12px] text-text-muted" aria-hidden>
        <span className="flex items-center gap-[5px]">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-gold-bord bg-gold-50" />
          Mon congé
        </span>
        <span className="flex items-center gap-[5px]">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-clay-bord bg-clay-50" />
          Jour férié
        </span>
      </div>
      {erreur && <p className="mt-2 text-[12px] text-clay">{erreur}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------- prochains jours fériés

function ProchainsFeries({ feries, chargerFeries, onVoirFeries }: { feries: Record<number, JourFerie[]>; chargerFeries: (annee: number) => void; onVoirFeries: () => void }) {
  const annee = new Date().getFullYear();
  useEffect(() => {
    chargerFeries(annee);
    chargerFeries(annee + 1);
  }, [annee, chargerFeries]);
  const aujourdhui = jourIso(new Date(Date.UTC(annee, new Date().getMonth(), new Date().getDate())));
  const prochains = [...(feries[annee] ?? []), ...(feries[annee + 1] ?? [])].filter((f) => jourIso(f.date) >= aujourdhui).slice(0, 3);
  const charge = feries[annee] !== undefined;
  return (
    <section aria-label="Prochains jours fériés" data-testid="prochains-feries" className="rounded-xl border border-line bg-surface px-[18px] py-4">
      <div className="flex items-center gap-2.5">
        <h2 className="font-heading text-[15.5px] font-bold text-ink-900">Prochains jours fériés</h2>
        <button type="button" onClick={onVoirFeries} className="ml-auto text-[12.5px] font-semibold text-ink hover:underline" aria-label="Tous les jours fériés">
          Tous
        </button>
      </div>
      {!charge ? (
        <div role="status" aria-label="Chargement en cours" className="mt-3 space-y-3" data-testid="squelette">
          <Barre className="h-3 w-[70%]" />
          <Barre className="h-3 w-[55%]" />
          <Barre className="h-3 w-[62%]" />
        </div>
      ) : prochains.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-muted">Aucun jour férié saisi pour les prochains mois.</p>
      ) : (
        <ul className="mt-1.5">
          {prochains.map((f) => (
            <li key={f.id} className="flex justify-between gap-3 border-t border-line-doux py-2 text-[13px] first:border-t-0">
              <span className="min-w-0">{f.libelle}</span>
              <b className="flex-none font-semibold">{dateCourte(f.date)}</b>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[12px] text-text-muted">Les jours fériés ne sont pas décomptés de vos congés.</p>
    </section>
  );
}

/** Bouton d'en-tête « Demander un congé » (bleu nuit). */
export function BoutonDemander({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={BTN_PRINCIPAL} onClick={onClick}>
      <Plus aria-hidden size={17} />
      Demander un congé
    </button>
  );
}

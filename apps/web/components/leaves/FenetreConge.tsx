'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, CheckSquare, Lock, Paperclip } from 'lucide-react';
import { useOrg } from '../../lib/org/OrgProvider';
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  deposerCertificat,
  donnerAvisConge,
  getContexteConge,
  getLeaveRequest,
  rejectLeaveRequest,
  telechargerCertificat,
} from '../../lib/api/leaves';
import { demanderReauthentification } from '../../lib/api/client';
import { CODE_CONGE_MALADIE, LIBELLE_AVIS } from '../../lib/leaves/types';
import type { ContexteConge, LeaveRequest } from '../../lib/leaves/types';
import { messageChargement } from '../ui/ErreurChargement';
import { ZoneDepot } from '../ui/Formulaire';
import { useToast } from '../ui/Toast';
import { FenetreDetail } from '../ui/FenetreDetail';
import { BTN_DANGER_CONTOUR, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, Etapes, Initiales, Pastille, SectionFenetre, type EtatEtape } from '../ui/Charte';
import { dateCourte, dateLongue, echeanceLongue, initialesNom, jours, lendemain, pastilleEtape, typeEnPhrase } from './format';

type Mode = 'avis' | 'decision' | 'demandeur' | 'lecture';

const message = (err: unknown, defaut: string) => (err instanceof Error && err.message ? err.message : defaut);

/** Libellé de l'avis rendu (« favorable », « défavorable », « réputé favorable »). */
const AVIS_COURT: Record<'FAVORABLE' | 'DEFAVORABLE' | 'TACITE', string> = { FAVORABLE: 'favorable', DEFAVORABLE: 'défavorable', TACITE: 'réputé favorable' };

/**
 * Fenêtre d'une demande de congé (refonte de l'interface) : avis du chef, décision du DRH (ou du DN
 * et de la DNA pour une demande du DRH), détail de sa propre demande, consultation (suivi de l'équipe).
 * Les boutons suivent les droits renvoyés par l'API ; le contexte (absents de l'équipe, tâches pendant
 * l'absence, solde annuel seul) vient de GET api/v1/conges/:id/contexte, ouvert aux seuls avisant,
 * décideur et demandeur.
 */
export function FenetreConge({
  request: initiale,
  currentUserId,
  onClose,
  onDecided,
  onChange,
}: {
  request: LeaveRequest;
  currentUserId: string | undefined;
  onClose: () => void;
  /** Avis, décision ou annulation : la fenêtre se ferme. */
  onDecided: (request: LeaveRequest) => void;
  /** Certificat déposé : la fenêtre reste ouverte. */
  onChange: (request: LeaveRequest) => void;
}) {
  const { getSectionName, getDivisionName, getCelluleName } = useOrg();
  const [request, setRequest] = useState(initiale);
  const [contexte, setContexte] = useState<ContexteConge | null>(null);
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const champMotif = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const mode: Mode = request.droits?.peutDonnerAvis ? 'avis' : request.droits?.peutDecider ? 'decision' : request.userId === currentUserId ? 'demandeur' : 'lecture';
  const prenom = request.user.firstName;
  const nom = `${request.user.firstName} ${request.user.lastName}`;
  const unite = getSectionName(request.user.sectionId) ?? getDivisionName(request.user.divisionId) ?? getCelluleName(request.user.celluleId);
  const medical = request.leaveType.code === CODE_CONGE_MALADIE || request.motifVerrouille;

  useEffect(() => {
    if (mode === 'lecture') return;
    getContexteConge(request.id)
      .then(setContexte)
      .catch((err) => setError(messageChargement(err)));
    // Le contexte ne dépend que de la demande et du rôle du lecteur sur elle.
  }, [request.id, mode]);

  async function agir(action: () => Promise<LeaveRequest>, defaut: string, succes: [string, string]) {
    setBusy(true);
    setError(null);
    try {
      onDecided(await action());
      toast.succes(succes[0], { detail: succes[1] });
    } catch (err) {
      setError(message(err, defaut));
    } finally {
      setBusy(false);
    }
  }

  function exigerMotif(texte: string): boolean {
    if (motif.trim().length >= 2) return true;
    setError(texte);
    champMotif.current?.focus();
    return false;
  }

  async function afficherMotif() {
    if (await demanderReauthentification()) {
      getLeaveRequest(request.id).then(setRequest).catch((err) => setError(messageChargement(err)));
    }
  }

  // ------------------------------------------------------------------ en-tête : circuit
  const etapeAvis: EtatEtape = request.avisEtat ? 'fait' : request.etape === 'AVIS_ATTENDU' ? 'courant' : 'avenir';
  const etapeDecision: EtatEtape = request.etape === 'APPROUVEE' || request.etape === 'REFUSEE' ? 'fait' : request.etape === 'DECISION_ATTENDUE' ? 'courant' : 'avenir';
  const libelleAvis = request.avisEtat ? `Avis du chef : ${AVIS_COURT[request.avisEtat]}` : mode === 'avis' ? 'Votre avis' : 'Avis du chef';
  const libelleDecision =
    mode === 'decision' ? 'Votre décision' : request.etape === 'APPROUVEE' ? 'Approuvée' : request.etape === 'REFUSEE' ? 'Refusée' : request.etape === 'ANNULEE' ? 'Annulée' : 'Décision du DRH';
  const entete = (
    <div data-testid="circuit-conge">
      <Etapes
        label="Circuit de la demande"
        etapes={[
          { label: 'Demande envoyée', etat: 'fait' },
          { label: libelleAvis, etat: etapeAvis },
          { label: libelleDecision, etat: request.etape === 'ANNULEE' ? 'avenir' : etapeDecision },
        ]}
      />
    </div>
  );

  // ------------------------------------------------------------------ colonne de gauche
  const feries = contexte?.feriesDansPeriode;
  const duree =
    feries === undefined
      ? jours(request.daysCount)
      : feries === 0
        ? `${jours(request.daysCount)} (aucun jour férié décompté)`
        : `${jours(request.daysCount)} (${feries} jour${feries > 1 ? 's' : ''} férié${feries > 1 ? 's' : ''} non décompté${feries > 1 ? 's' : ''})`;

  const certificat = request.droits?.lireCertificat && request.certificat && (
    <div className="mt-2 text-[13px]" data-testid="certificat-medical">
      <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-ink underline" onClick={() => telechargerCertificat(request.id).catch((e) => setError(message(e, 'Téléchargement impossible')))}>
        <Paperclip aria-hidden size={14} />
        Certificat médical : {request.certificat.nom}
      </button>
    </div>
  );

  const contenu = (
    <>
      <SectionFenetre titre="Période">
        <CleValeur
          largeur={120}
          lignes={[
            ['Du', dateLongue(request.startDate)],
            ['Au', dateLongue(request.endDate)],
            [
              'Durée',
              request.soldeInsuffisant ? (
                <span className="flex flex-wrap items-center gap-2">
                  {duree}
                  <Pastille ton="rouge" testid="solde-insuffisant">
                    solde insuffisant ({jours(request.soldeRestant ?? 0)} restant{(request.soldeRestant ?? 0) > 1 ? 's' : ''})
                  </Pastille>
                </span>
              ) : (
                duree
              ),
            ],
            ['Reprise', dateLongue(lendemain(request.endDate)).replace(/ \d{4}$/, '')],
          ]}
        />
      </SectionFenetre>

      <SectionFenetre titre="Motif">
        {request.motifVerrouille ? (
          <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-[#E1C26B] bg-[#FFFBEF] px-3 py-[11px] text-[13px]">
            <Lock aria-hidden size={16} className="flex-none text-ambre" />
            <span className="min-w-0 flex-1">Motif médical protégé. Il s’affiche après confirmation de votre mot de passe.</span>
            <button type="button" className={`${BTN_SECONDAIRE} !h-8 !text-[13px]`} onClick={afficherMotif}>
              Afficher le motif
            </button>
          </div>
        ) : request.reason ? (
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-text">{request.reason}</p>
        ) : (
          <p className="text-[13px] text-text-muted">Aucun motif indiqué.</p>
        )}
        {certificat}
        {medical && mode !== 'demandeur' && !request.droits?.lireCertificat && <p className="mt-1.5 text-[12.5px] text-text-muted">Le certificat médical n’est lisible que par le DRH.</p>}
      </SectionFenetre>

      {request.avisEtat && mode !== 'avis' && (
        <SectionFenetre titre="Avis du chef">
          <p className="text-[13.5px] text-text">
            {LIBELLE_AVIS[request.avisEtat]}
            {request.avisPar ? ` — ${request.avisPar.nom}` : ''}
            {request.avisLe ? `, le ${dateCourte(request.avisLe)}` : ''}
          </p>
          {request.avisMotif && <p className="mt-1 text-[13px] text-text-muted">« {request.avisMotif} »</p>}
        </SectionFenetre>
      )}

      {(request.etape === 'APPROUVEE' || request.etape === 'REFUSEE') && (
        <SectionFenetre titre="Décision">
          <p className="text-[13.5px] text-text">
            {request.etape === 'APPROUVEE' ? 'Approuvée' : 'Refusée'}
            {request.decidedAt ? ` le ${dateCourte(request.decidedAt)}` : ''}
          </p>
          {request.decisionComment && <p className={`mt-1 text-[13px] ${request.etape === 'REFUSEE' ? 'text-clay' : 'text-text-muted'}`}>{request.etape === 'REFUSEE' ? `Motif du refus : ${request.decisionComment}` : request.decisionComment}</p>}
        </SectionFenetre>
      )}

      {contexte?.absents && (
        <SectionFenetre titre={mode === 'avis' ? 'Absents dans votre équipe sur la période' : 'Absents dans l’équipe sur la période'} n={contexte.absents.length}>
          {contexte.absents.length === 0 ? (
            <p className="text-[13px] text-text-muted">Personne d’autre n’est absent sur la période.</p>
          ) : (
            <ul data-testid="absents-conge">
              {contexte.absents.map((a) => (
                <li key={a.demandeId} className="flex flex-wrap items-center gap-2.5 border-t border-[#F0F1F6] py-2 text-[13px] first:border-t-0">
                  <Initiales texte={initialesNom(a.nom)} taille={26} />
                  <span className="min-w-0 flex-1">{a.nom}</span>
                  <span className="text-text-muted">
                    {typeEnPhrase(a.type)} jusqu’au {dateCourte(a.fin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionFenetre>
      )}

      {contexte?.taches && (
        <SectionFenetre titre={`Tâches de ${prenom} à échéance pendant l’absence`} n={contexte.taches.length} className="mb-0">
          {contexte.taches.length === 0 ? (
            <p className="text-[13px] text-text-muted">Aucune tâche à échéance pendant l’absence.</p>
          ) : (
            <ul data-testid="taches-conge">
              {contexte.taches.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 border-t border-[#F0F1F6] py-2 text-[13px] first:border-t-0">
                  <CheckSquare aria-hidden size={16} className="flex-none text-text-muted" />
                  <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-text hover:underline">
                    {t.titre}
                  </Link>
                  {t.echeance && <span className="flex-none rounded-md bg-ink-50 px-2 py-0.5 text-[12px] font-semibold text-ink">{dateCourte(t.echeance)}</span>}
                </li>
              ))}
            </ul>
          )}
        </SectionFenetre>
      )}
    </>
  );

  // ------------------------------------------------------------------ colonne de droite
  const solde = contexte && (
    <section aria-label={`Solde de ${prenom}`}>
      <h3 className="mb-2 text-[13px] font-bold text-ink-900">{mode === 'demandeur' ? 'Votre solde' : `Solde de ${prenom}`}</h3>
      {contexte.soldeAnnuel ? (
        <CleValeur
          largeur={140}
          lignes={[[`${contexte.soldeAnnuel.libelle} ${contexte.soldeAnnuel.annee}`, `${contexte.soldeAnnuel.remainingDays} j restants`]]}
        />
      ) : (
        <p className="text-[13px] text-text-muted">Aucun solde de congé annuel provisionné.</p>
      )}
    </section>
  );
  const separateur = <div aria-hidden className="my-4 h-px bg-line" />;
  const erreur = error && (
    <div role="alert" className="mt-3 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
      {error}
    </div>
  );
  const champ = (label: string, placeholder: string) => (
    <textarea
      ref={champMotif}
      aria-label={label}
      value={motif}
      onChange={(e) => setMotif(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="mt-0.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[13px] placeholder:text-text-faint focus:border-ink focus:outline focus:outline-2 focus:outline-ink"
    />
  );

  let cote;
  if (mode === 'avis') {
    cote = (
      <>
        <div className="flex flex-col gap-2" data-testid="avis-chef">
          <button type="button" className={`${BTN_PRINCIPAL} !h-[42px]`} disabled={busy} onClick={() => agir(() => donnerAvisConge(request.id, 'FAVORABLE', motif.trim() || undefined), 'Impossible d’enregistrer votre avis', ['Avis favorable enregistré', `La demande de ${nom} passe à la décision du DRH.`])}>
            <Check aria-hidden size={17} strokeWidth={2.5} />
            Avis favorable
          </button>
          <button
            type="button"
            className={BTN_DANGER_CONTOUR}
            disabled={busy}
            onClick={() => exigerMotif('Un avis défavorable doit être motivé : indiquez le motif.') && agir(() => donnerAvisConge(request.id, 'DEFAVORABLE', motif.trim()), 'Impossible d’enregistrer votre avis', ['Avis défavorable enregistré', `La demande de ${nom} passe à la décision du DRH, avec votre motif.`])}
          >
            Avis défavorable
          </button>
          {champ('Motif de l’avis (obligatoire si défavorable)', 'Motif (obligatoire si défavorable)…')}
          <p className="text-[12px] leading-[1.45] text-text-muted">
            Vous donnez un avis : la décision revient au DRH.
            {request.avisEcheance && (
              <>
                {' '}Sans avis avant le <b className="text-text">{echeanceLongue(request.avisEcheance)}</b>, il est réputé favorable.
              </>
            )}
          </p>
        </div>
        {erreur}
        {separateur}
        {solde}
      </>
    );
  } else if (mode === 'decision') {
    cote = (
      <>
        <div className="flex flex-col gap-2" data-testid="decision-drh">
          <button type="button" className={`${BTN_PRINCIPAL} !h-[42px]`} disabled={busy} onClick={() => agir(() => approveLeaveRequest(request.id, motif.trim() || undefined), 'Impossible d’approuver cette demande', ['Congé approuvé', `${nom} a été prévenu ; le solde est mis à jour.`])}>
            <Check aria-hidden size={17} strokeWidth={2.5} />
            Valider
          </button>
          <button
            type="button"
            className={BTN_DANGER_CONTOUR}
            disabled={busy}
            onClick={() => exigerMotif('Un refus doit être motivé : indiquez le motif.') && agir(() => rejectLeaveRequest(request.id, motif.trim()), 'Impossible de refuser cette demande', ['Demande refusée', `${nom} a été prévenu, avec votre motif.`])}
          >
            Rejeter avec un motif
          </button>
          {champ('Motif de la décision (obligatoire en cas de refus)', 'Motif (obligatoire en cas de refus)…')}
          <p className="text-[12px] leading-[1.45] text-text-muted">Votre décision et son motif sont communiqués à {prenom}. Le solde est mis à jour à l’approbation.</p>
        </div>
        {erreur}
        {separateur}
        {solde}
      </>
    );
  } else {
    const p = pastilleEtape(request);
    cote = (
      <>
        <div className="mb-3">
          <Pastille ton={p.ton}>{p.texte}</Pastille>
        </div>
        <CleValeur largeur={100} lignes={[['Déposée le', dateCourte(request.createdAt)], ['Type', request.leaveType.name]]} />
        {mode === 'demandeur' && (request.droits?.deposerCertificat || request.certificat) && (
          <div className="mt-4 text-[12.5px]" data-testid="certificat-medical">
            {request.certificat ? (
              <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-ink underline" onClick={() => telechargerCertificat(request.id).catch((e) => setError(message(e, 'Téléchargement impossible')))}>
                <Paperclip aria-hidden size={14} />
                Certificat médical : {request.certificat.nom}
              </button>
            ) : (
              <p className="text-text-muted">Aucun certificat médical joint (visible de vous et du DRH seulement).</p>
            )}
            {request.droits?.deposerCertificat && (
              <div className="mt-2">
                <ZoneDepot
                  id="certificat-fenetre"
                  label={request.certificat ? 'Remplacer le certificat' : 'Joindre le certificat médical'}
                  fichiers={[]}
                  aide={busy ? 'Envoi en cours…' : 'PDF ou image · 25 Mo au plus'}
                  onChange={(fichiers) => {
                    const f = fichiers[0];
                    if (!f || busy) return;
                    setBusy(true);
                    setError(null);
                    deposerCertificat(request.id, f)
                      .then((maj) => {
                        setRequest(maj);
                        onChange(maj);
                        toast.succes(request.certificat ? 'Certificat remplacé' : 'Certificat médical joint', { detail: 'Visible de vous et du DRH seulement.' });
                      })
                      .catch((err) => setError(message(err, 'Dépôt impossible')))
                      .finally(() => setBusy(false));
                  }}
                />
              </div>
            )}
          </div>
        )}
        {mode === 'demandeur' && request.droits?.peutAnnuler && (
          <button type="button" className={`${BTN_DANGER_CONTOUR} mt-4 w-full`} disabled={busy} onClick={() => agir(() => cancelLeaveRequest(request.id), 'Impossible d’annuler cette demande', ['Demande annulée', `${request.leaveType.name} · ${jours(request.daysCount)}.`])}>
            Annuler la demande
          </button>
        )}
        {erreur}
        {solde && (
          <>
            {separateur}
            {solde}
          </>
        )}
      </>
    );
  }

  return (
    <FenetreDetail
      titre={`${mode === 'demandeur' ? 'Ma demande' : nom} — ${typeEnPhrase(request.leaveType.name)}, ${jours(request.daysCount)}`}
      filAriane={['Demande de congé', unite]}
      entete={entete}
      cote={cote}
      largeur={880}
      onClose={onClose}
      testid="fenetre-conge"
    >
      {contenu}
    </FenetreDetail>
  );
}


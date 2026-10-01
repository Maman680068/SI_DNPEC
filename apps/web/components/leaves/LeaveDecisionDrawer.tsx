'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { approveLeaveRequest, donnerAvisConge, getBalancesForUser, getLeaveRequest, rejectLeaveRequest, telechargerCertificat } from '../../lib/api/leaves';
import { demanderReauthentification } from '../../lib/api/client';
import { LIBELLE_AVIS, LIBELLE_ETAPE } from '../../lib/leaves/types';
import type { LeaveBalanceView, LeaveRequest } from '../../lib/leaves/types';
import { Button } from '../ui/Button';
import { Chargement, messageChargement } from '../ui/ErreurChargement';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function LeaveDecisionDrawer({
  request: initiale,
  onClose,
  onDecided,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onDecided: (request: LeaveRequest) => void;
}) {
  const { getUserLabel } = useOrg();
  const [request, setRequest] = useState(initiale);
  const avis = request.droits?.peutDonnerAvis ?? false;
  const [motifAvis, setMotifAvis] = useState('');
  const [defavorable, setDefavorable] = useState(false);
  const [balances, setBalances] = useState<LeaveBalanceView[] | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestYear = new Date(request.startDate).getFullYear();
  const relevantBalance = balances?.find((b) => b.leaveTypeId === request.leaveTypeId && b.year === requestYear);

  useEffect(() => {
    getBalancesForUser(request.userId)
      .then(setBalances)
      .catch((err) => setError(messageChargement(err)));
  }, [request.userId]);

  async function handleAvis(valeur: 'FAVORABLE' | 'DEFAVORABLE') {
    setBusy(true);
    setError(null);
    try {
      onDecided(await donnerAvisConge(request.id, valeur, valeur === 'DEFAVORABLE' ? motifAvis.trim() : undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer votre avis');
    } finally {
      setBusy(false);
    }
  }

  async function afficherMotif() {
    if (await demanderReauthentification()) {
      getLeaveRequest(request.id).then(setRequest).catch((err) => setError(messageChargement(err)));
    }
  }

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      onDecided(await approveLeaveRequest(request.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'approuver cette demande");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      onDecided(await rejectLeaveRequest(request.id, rejectComment.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de rejeter cette demande');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="text-xs text-text-faint">Demande de congé</div>
          <button onClick={onClose} className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{getUserLabel(request.userId)}</h2>
        <p className="mb-5 text-[13px] text-text-muted">{request.leaveType.name}</p>

        <div className="mb-5 grid grid-cols-2 gap-3.5">
          <div>
            <div className="mb-1 text-[11px] font-semibold text-text-faint">DU</div>
            <div className="text-[13.3px] font-semibold">{formatDate(request.startDate)}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-text-faint">AU</div>
            <div className="text-[13.3px] font-semibold">{formatDate(request.endDate)}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-text-faint">DURÉE</div>
            <div className="text-[13.3px] font-semibold">
              {request.daysCount} jour{request.daysCount > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-md border border-line px-3.5 py-2.5 text-[13px]" data-testid="circuit-conge">
          <div className="font-semibold">{LIBELLE_ETAPE[request.etape]}</div>
          {request.avisEtat ? (
            <div className="mt-1 text-text-muted">
              {LIBELLE_AVIS[request.avisEtat]}
              {request.avisPar ? ` — ${request.avisPar.nom}` : ''}
              {request.avisMotif ? ` : « ${request.avisMotif} »` : ''}
            </div>
          ) : (
            request.avisEcheance && (
              <div className="mt-1 text-text-muted">
                Avis attendu avant le {new Date(request.avisEcheance).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} ; au-delà, il est réputé favorable.
              </div>
            )
          )}
        </div>

        {request.motifVerrouille && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gold bg-gold-soft px-3.5 py-2.5 text-[12.5px]">
            🔒 Motif médical protégé.
            <Button className="!px-2.5 !py-1 !text-[12px]" onClick={afficherMotif}>
              Afficher le motif
            </Button>
          </div>
        )}

        {request.droits?.lireCertificat && request.certificat && (
          <div className="mb-5 text-[13px]" data-testid="certificat-medical">
            <button type="button" className="text-ink underline" onClick={() => telechargerCertificat(request.id).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
              📎 Certificat médical : {request.certificat.nom}
            </button>
          </div>
        )}

        {request.reason && (
          <>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Motif</div>
            <div className="mb-5 rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">{request.reason}</div>
          </>
        )}

        <div className="mb-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
            Solde {request.leaveType.name} — {requestYear}
          </div>
          {balances === null ? (
            <Chargement erreur={error} className="text-[13px] text-text-muted" />
          ) : relevantBalance ? (
            <div className="rounded-md border border-line px-3.5 py-2.5 text-[13px]">
              <strong>{relevantBalance.remainingDays}</strong> jour{relevantBalance.remainingDays > 1 ? 's' : ''} restant
              {relevantBalance.remainingDays > 1 ? 's' : ''} sur {relevantBalance.totalDays} ({relevantBalance.usedDays} déjà pris)
            </div>
          ) : (
            <p className="text-[13px] text-text-faint">Aucun solde provisionné pour ce type/cette année.</p>
          )}
        </div>

        {avis && (
          <div data-testid="avis-chef">
            <p className="mb-2 text-[12.5px] text-text-muted">Vous donnez un avis ; la décision revient au DRH.</p>
            {!defavorable ? (
              <div className="flex gap-2.5">
                <Button variant="solid" className="flex-1" disabled={busy} onClick={() => handleAvis('FAVORABLE')}>
                  Avis favorable
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setDefavorable(true)}>
                  Avis défavorable
                </Button>
              </div>
            ) : (
              <div>
                <textarea
                  aria-label="Motif de l’avis défavorable"
                  value={motifAvis}
                  onChange={(e) => setMotifAvis(e.target.value)}
                  placeholder="Motif de l’avis défavorable (transmis au DRH)…"
                  rows={2}
                  className="mb-2 w-full rounded-md border border-line px-3 py-2 text-[13px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
                />
                <div className="flex gap-2.5">
                  <Button variant="solid" className="flex-1 !border-clay !bg-clay" disabled={busy || motifAvis.trim().length < 2} onClick={() => handleAvis('DEFAVORABLE')}>
                    Confirmer l’avis défavorable
                  </Button>
                  <Button variant="outline" onClick={() => setDefavorable(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {request.droits?.peutDecider && (
          <div>
            {!showRejectForm ? (
              <div className="flex gap-2.5">
                <Button variant="solid" className="flex-1" disabled={busy} onClick={handleApprove}>
                  Approuver
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setShowRejectForm(true)}>
                  Refuser
                </Button>
              </div>
            ) : (
              <div>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  aria-label="Motif du refus"
                  placeholder="Motif du refus (visible par le demandeur)…"
                  rows={2}
                  className="mb-2 w-full rounded-md border border-line px-3 py-2 text-[13px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
                />
                <div className="flex gap-2.5">
                  <Button
                    variant="solid"
                    className="flex-1 !border-clay !bg-clay"
                    disabled={busy || rejectComment.trim().length < 2}
                    onClick={handleReject}
                  >
                    Confirmer le refus
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <div className="mt-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{error}</div>}
      </div>
    </div>
  );
}

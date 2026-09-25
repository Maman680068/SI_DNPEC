'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cloturerStage,
  getStage,
  interrompreStage,
  prendreConnaissanceAttestation,
  refuserPeriode,
  renvoyerEvaluation,
  retirerPeriode,
  telechargerDocument,
  telechargerFinale,
  telechargerProvisoire,
} from '../../../../lib/api/stages';
import type { Periode, Stage } from '../../../../lib/stages/types';
import { FORMAT_LABEL, PERIODE_STATUT_LABEL, STAGE_STATUT_LABEL } from '../../../../lib/stages/types';
import { Erreur, messageErreur } from '../../../../components/courrier/ui';
import { BlocEvaluation } from '../../../../components/stages/BlocEvaluation';
import {
  FenetreActeAttestation,
  FenetreModifierStage,
  FenetreMotif,
  FenetrePeriode,
  FenetreTuteur,
} from '../../../../components/stages/FenetresStage';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const petit = 'px-3 py-1.5 text-[12.5px]';

type Fenetre =
  | { t: 'modifier' }
  | { t: 'periode'; periode?: Periode }
  | { t: 'accepter' | 'tuteur'; periode: Periode }
  | { t: 'refuser' | 'renvoyer'; periode: Periode }
  | { t: 'interrompre' }
  | { t: 'acte' }
  | null;

function tonPeriode(p: Periode): 'gold' | 'sage' | 'clay' | 'muted' | 'accent' {
  if (p.statut === 'EN_COURS') return 'accent';
  if (p.statut === 'TERMINEE' || p.statut === 'ACCEPTEE') return 'sage';
  if (p.statut === 'REFUSEE') return 'clay';
  if (p.statut === 'PROPOSEE') return 'gold';
  return 'muted';
}

/** Fiche d'un stage (D6) : tout ce qui est proposé vient de `droits` renvoyés
 * par l'API (plan, décisions de l'unité, évaluation, attestation). */
export default function StagePage() {
  const { id } = useParams<{ id: string }>();
  const [stage, setStage] = useState<Stage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const [enCours, setEnCours] = useState(false);
  const requete = useRef(0);

  const charger = useCallback(() => {
    const n = ++requete.current;
    getStage(id)
      .then((s) => n === requete.current && (setStage(s), setErreur(null)))
      .catch((e) => n === requete.current && setErreur(messageErreur(e, 'Impossible de charger ce stage')));
  }, [id]);
  useEffect(() => {
    charger();
  }, [charger]);

  async function agir(fn: () => Promise<unknown>, ok?: string) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'periodes' in r) setStage(r as Stage);
      else charger();
      if (ok) setInfo(ok);
    } catch (e) {
      setErreur(messageErreur(e, 'Action impossible'));
    } finally {
      setEnCours(false);
    }
  }
  const fermer = (s?: Stage) => {
    setFenetre(null);
    if (s) setStage(s);
    else charger();
  };

  if (!stage) {
    return (
      <div>
        <Link href="/stages" className="mb-4 inline-block text-[13px] text-accent">
          ← Stagiaires
        </Link>
        <Erreur message={erreur} />
        {!erreur && <p className="text-sm text-text-muted">Chargement…</p>}
      </div>
    );
  }
  const { droits, attestation } = stage;
  const moi = stage.vue === 'STAGIAIRE';

  return (
    <div className="max-w-[900px]">
      <Link href="/stages" className="mb-4 inline-block text-[13px] text-accent">
        ← {moi ? 'Mon stage' : 'Stagiaires'}
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Stage</div>
          <h1 className="text-[22px] font-extrabold">
            {stage.stagiaire.firstName} {stage.stagiaire.lastName}
          </h1>
          <p className="text-[13px] text-text-muted">
            {stage.etablissement}
            {stage.diplomePrepare ? ` — ${stage.diplomePrepare}` : ''} — du {date(stage.dateDebut)} au {date(stage.dateFin)}
          </p>
          <p className="text-[12.5px] text-text-faint">Rattachement actuel : {stage.rattachementActuel}</p>
        </div>
        <Badge tone={stage.statut === 'EN_COURS' ? 'accent' : stage.statut === 'INTERROMPU' ? 'clay' : stage.statut === 'TERMINE' ? 'sage' : 'gold'}>{STAGE_STATUT_LABEL[stage.statut]}</Badge>
      </div>

      {stage.motifInterruption && <p className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">Stage interrompu : {stage.motifInterruption}</p>}
      <Erreur message={erreur} />
      {info && <div className="mb-4 rounded-md bg-sage-soft px-3.5 py-3 text-[13px] text-sage">{info}</div>}

      {(droits.modifier || droits.ajouterPeriode || droits.cloturer || droits.interrompre) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {droits.ajouterPeriode && (
            <Button variant="gold" onClick={() => setFenetre({ t: 'periode' })}>
              + Ajouter une période
            </Button>
          )}
          {droits.modifier && <Button onClick={() => setFenetre({ t: 'modifier' })}>Modifier le stage</Button>}
          {droits.cloturer && (
            <Button disabled={enCours} onClick={() => window.confirm('Clôturer ce stage ?') && agir(() => cloturerStage(stage.id), 'Stage clôturé.')}>
              Clôturer
            </Button>
          )}
          {droits.interrompre && <Button onClick={() => setFenetre({ t: 'interrompre' })}>Interrompre</Button>}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2.5 text-[15px] font-bold">Plan de rotation</h2>
        {stage.periodes.length === 0 ? (
          <p className="text-[13px] text-text-faint">Aucune période pour l’instant.</p>
        ) : (
          <ol className="space-y-3">
            {stage.periodes.map((p) => (
              <li key={p.id} className={`rounded-lg border border-line bg-surface p-4 ${p.statut === 'ANNULEE' ? 'opacity-60' : ''}`} data-testid={`periode-${p.ordre}`}>
                <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-bold">
                      {p.ordre}. {p.unite}
                    </div>
                    <div className="text-[12.5px] text-text-muted">
                      du {date(p.dateDebut)} au {date(p.dateFin)} — {FORMAT_LABEL[p.formatEvaluation]}
                    </div>
                  </div>
                  <Badge tone={tonPeriode(p)}>{PERIODE_STATUT_LABEL[p.statut]}</Badge>
                </div>
                <div className="text-[12.5px] text-text-muted">
                  Tuteur : {p.tuteur ? `${p.tuteur.firstName} ${p.tuteur.lastName}` : '—'}
                  {p.responsables.length > 0 && ` · Responsable : ${p.responsables.map((r) => `${r.firstName} ${r.lastName}`).join(', ')}`}
                </div>
                {p.objectifs && <p className="mt-1 whitespace-pre-wrap text-[13px]">Objectifs : {p.objectifs}</p>}
                {p.motifRefus && p.statut === 'REFUSEE' && <p className="mt-1 text-[12.5px] text-clay">Refusée : {p.motifRefus}</p>}

                <div className="mt-2 flex flex-wrap gap-2">
                  {p.droits.accepter && (
                    <Button variant="gold" className={petit} onClick={() => setFenetre({ t: 'accepter', periode: p })}>
                      Accepter et désigner le tuteur
                    </Button>
                  )}
                  {p.droits.refuser && (
                    <Button className={petit} onClick={() => setFenetre({ t: 'refuser', periode: p })}>
                      Refuser
                    </Button>
                  )}
                  {p.droits.changerTuteur && (
                    <Button className={petit} onClick={() => setFenetre({ t: 'tuteur', periode: p })}>
                      Changer de tuteur
                    </Button>
                  )}
                  {p.droits.modifier && (
                    <Button className={petit} onClick={() => setFenetre({ t: 'periode', periode: p })}>
                      Modifier
                    </Button>
                  )}
                  {p.droits.annuler && (
                    <Button
                      className={petit}
                      disabled={enCours}
                      onClick={() => window.confirm('Retirer cette période du plan ?') && agir(() => retirerPeriode(stage.id, p.id), 'Période retirée du plan.')}
                    >
                      Retirer du plan
                    </Button>
                  )}
                </div>
                {(p.evaluation || p.droits.rediger || p.droits.changerFormat || p.droits.viser) && (
                  <BlocEvaluation
                    key={p.id}
                    stage={stage}
                    periode={p}
                    onChange={setStage}
                    onRenvoyer={() => setFenetre({ t: 'renvoyer', periode: p })}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {(attestation.acte || Object.values(attestation.droits).some(Boolean)) && (
        <section className="mb-6 rounded-lg border border-line bg-surface p-4" data-testid="attestation">
          <h2 className="mb-2 text-[15px] font-bold">Attestation de fin de stage</h2>
          {attestation.acte ? (
            <p className="mb-2 text-[13px]">
              {attestation.acte.numero ? (
                <>
                  Attestation n° <strong>{attestation.acte.numero}</strong>
                  {attestation.acte.signeAt ? `, signée le ${date(attestation.acte.signeAt)}` : ''}
                  {attestation.acte.priseConnaissanceAt ? ` — prise de connaissance le ${date(attestation.acte.priseConnaissanceAt)}` : ''}.
                </>
              ) : (
                <>Acte en préparation dans le module Courrier (visa puis signature du DN ou de la DNA).</>
              )}
            </p>
          ) : (
            stage.vue === 'DRH' && (
              <p className="mb-2 text-[12.5px] text-text-muted">
                {attestation.modeleImporte ? 'Modèle d’attestation importé.' : 'Aucun modèle importé : mise en page standard.'}{' '}
                <Link href="/stages/parametres" className="text-accent underline">
                  Modèle et capacités
                </Link>
              </p>
            )
          )}
          <div className="flex flex-wrap gap-2">
            {attestation.droits.provisoire && (
              <Button className={petit} onClick={() => agir(() => telechargerProvisoire(stage.id))}>
                Version provisoire (PDF)
              </Button>
            )}
            {attestation.droits.document && (
              <Button className={petit} onClick={() => agir(() => telechargerDocument(stage.id))}>
                Document rempli
              </Button>
            )}
            {attestation.droits.creerActe && (
              <Button variant="gold" className={petit} onClick={() => setFenetre({ t: 'acte' })}>
                Préparer l’attestation finale
              </Button>
            )}
            {attestation.droits.telechargerFinale && (
              <Button className={petit} onClick={() => agir(() => telechargerFinale(stage.id))}>
                Télécharger l’attestation signée
              </Button>
            )}
            {attestation.droits.prendreConnaissance && (
              <Button variant="gold" className={petit} disabled={enCours} onClick={() => agir(() => prendreConnaissanceAttestation(stage.id), 'Prise de connaissance enregistrée.')}>
                J’ai pris connaissance de mon attestation
              </Button>
            )}
          </div>
        </section>
      )}

      {fenetre?.t === 'modifier' && <FenetreModifierStage stage={stage} onClose={() => setFenetre(null)} onDone={fermer} />}
      {fenetre?.t === 'periode' && <FenetrePeriode stage={stage} periode={fenetre.periode} onClose={() => setFenetre(null)} onDone={fermer} />}
      {(fenetre?.t === 'accepter' || fenetre?.t === 'tuteur') && (
        <FenetreTuteur stage={stage} periode={fenetre.periode} mode={fenetre.t === 'accepter' ? 'accepter' : 'changer'} onClose={() => setFenetre(null)} onDone={fermer} />
      )}
      {fenetre?.t === 'refuser' && (
        <FenetreMotif titre="Refuser la période" sousTitre="Le DRH est prévenu et corrige le plan." valider="Refuser" action={(m) => refuserPeriode(stage.id, fenetre.periode.id, m)} onClose={() => setFenetre(null)} onDone={fermer} />
      )}
      {fenetre?.t === 'renvoyer' && (
        <FenetreMotif titre="Renvoyer l’évaluation au tuteur" valider="Renvoyer" action={(m) => renvoyerEvaluation(stage.id, fenetre.periode.id, m)} onClose={() => setFenetre(null)} onDone={fermer} />
      )}
      {fenetre?.t === 'interrompre' && (
        <FenetreMotif
          titre="Interrompre le stage"
          sousTitre="La période en cours se termine aujourd’hui ; les périodes à venir sont retirées du plan."
          valider="Interrompre"
          action={(m) => interrompreStage(stage.id, m)}
          onClose={() => setFenetre(null)}
          onDone={fermer}
        />
      )}
      {fenetre?.t === 'acte' && <FenetreActeAttestation stage={stage} onClose={() => setFenetre(null)} onDone={() => fermer()} />}
    </div>
  );
}

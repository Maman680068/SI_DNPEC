'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cloturerStage,
  deposerRapport,
  getStage,
  interrompreStage,
  prendreConnaissanceAttestation,
  refuserPeriode,
  renvoyerEvaluation,
  retirerPeriode,
  telechargerDocument,
  telechargerFinale,
  telechargerProvisoire,
  telechargerRapport,
  validerRapport,
  renvoyerRapport,
} from '../../../../lib/api/stages';
import type { Periode, Stage } from '../../../../lib/stages/types';
import { FORMAT_LABEL, PERIODE_STATUT_LABEL, RAPPORT_STATUT_LABEL, STAGE_STATUT_LABEL } from '../../../../lib/stages/types';
import { ErreurChargement } from '../../../../components/ui/ErreurChargement';
import { SquelettePage } from '../../../../components/ui/Squelette';
import { FenetreFormulaire, ZoneDepot } from '../../../../components/ui/Formulaire';
import { messageErreur, useToast } from '../../../../components/ui/Toast';
import { BlocEvaluation } from '../../../../components/stages/BlocEvaluation';
import {
  FenetreActeAttestation,
  FenetreEncadrant,
  FenetreModifierStage,
  FenetreMotif,
  FenetrePeriode,
  FenetreTuteur,
} from '../../../../components/stages/FenetresStage';
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { Bandeau, BTN_DANGER_CONTOUR, BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, EnTetePage, EtatVide, Panneau, Pastille, type TonPastille } from '../../../../components/ui/Charte';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const TON_STAGE: Record<Stage['statut'], TonPastille> = { EN_COURS: 'vert', PREVU: 'bleu', TERMINE: 'gris', INTERROMPU: 'rouge' };

type Fenetre =
  | { t: 'modifier' }
  | { t: 'periode'; periode?: Periode }
  | { t: 'accepter' | 'tuteur'; periode: Periode }
  | { t: 'refuser' | 'renvoyer'; periode: Periode }
  | { t: 'interrompre' }
  | { t: 'acte' }
  | { t: 'encadrant' }
  | { t: 'renvoyerRapport' }
  | { t: 'deposerRapport' }
  | null;

/** Dépôt du rapport de stage (stagiaire) : un fichier, l'encadreur est prévenu. */
function FenetreRapport({ stage, nouvelleVersion, onClose, onDone }: { stage: Stage; nouvelleVersion: boolean; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <FenetreFormulaire
      titre={nouvelleVersion ? 'Déposer une nouvelle version' : 'Déposer mon rapport'}
      sousTitre="Rapport de stage"
      onClose={onClose}
      largeur={600}
      libelleValider="Déposer le rapport"
      enCours={enCours}
      erreur={erreur}
      pied="Votre encadreur principal est prévenu et valide le rapport ou demande une reprise."
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          const r = await deposerRapport(stage.id, fichiers[0]!);
          onDone(r && typeof r === 'object' && 'periodes' in r ? (r as Stage) : undefined);
        } catch (e) {
          setErreur(messageErreur(e, 'Dépôt impossible'));
          setEnCours(false);
        }
      }}
    >
      <ZoneDepot id="rapport-fichier" label="Fichier du rapport" required fichiers={fichiers} onChange={setFichiers} aide="PDF ou Word · 25 Mo au plus" />
    </FenetreFormulaire>
  );
}

function tonPeriode(p: Periode): TonPastille {
  if (p.statut === 'EN_COURS') return 'bleu';
  if (p.statut === 'TERMINEE' || p.statut === 'ACCEPTEE') return 'vert';
  if (p.statut === 'REFUSEE') return 'rouge';
  if (p.statut === 'PROPOSEE') return 'ambre';
  return 'gris';
}

/** Fiche d'un stage (D6) : tout ce qui est proposé vient de `droits` renvoyés
 * par l'API (plan, décisions de l'unité, évaluation, attestation). */
export default function StagePage() {
  const { id } = useParams<{ id: string }>();
  const [stage, setStage] = useState<Stage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();
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

  async function agir(fn: () => Promise<unknown>, ok?: { titre: string; detail?: string }) {
    setEnCours(true);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'periodes' in r) setStage(r as Stage);
      else charger();
      if (ok) toast.succes(ok.titre, { detail: ok.detail });
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e, 'Action impossible'));
    } finally {
      setEnCours(false);
    }
  }
  /** Fermeture d'une fenêtre après une action réussie : stage à jour et message de confirmation. */
  const fermer = (titre?: string, detail?: string) => (s?: Stage) => {
    setFenetre(null);
    if (s) setStage(s);
    else charger();
    if (titre) toast.succes(titre, { detail });
  };

  if (!stage) {
    return (
      <div>
        <Link href="/stages" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
          <ChevronLeft aria-hidden size={15} /> Stagiaires
        </Link>
        <ErreurChargement message={erreur} />
        {!erreur && <SquelettePage />}
      </div>
    );
  }
  const { droits, attestation, rapport } = stage;
  const moi = stage.vue === 'STAGIAIRE';
  const actionsStage = droits.modifier || droits.cloturer || droits.interrompre;

  return (
    <div>
      <nav aria-label="Fil d’Ariane" className="mb-2 flex items-center gap-1.5 text-[12.5px] text-text-muted">
        <Link href="/stages" className="font-semibold text-ink hover:underline">
          {moi ? 'Mon stage' : 'Stagiaires'}
        </Link>
        <ChevronRight aria-hidden size={13} />
        <span>{stage.etablissement}</span>
      </nav>
      <EnTetePage
        titre={`${stage.stagiaire.firstName} ${stage.stagiaire.lastName}`}
        avantActions={<Pastille ton={TON_STAGE[stage.statut]}>{STAGE_STATUT_LABEL[stage.statut]}</Pastille>}
        sousTitre={`du ${date(stage.dateDebut)} au ${date(stage.dateFin)}`}
      />

      {stage.motifInterruption && (
        <Bandeau ton="rouge">Stage interrompu : {stage.motifInterruption}</Bandeau>
      )}
      <ErreurChargement message={erreur} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Panneau
            titre="Plan de rotation"
            compteur={<span className="text-[12.5px] font-semibold text-text-faint">{stage.periodes.length}</span>}
            action={
              droits.ajouterPeriode && (
                <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ t: 'periode' })}>
                  <Plus aria-hidden size={16} /> Ajouter une période
                </button>
              )
            }
          >
            {stage.periodes.length === 0 ? (
              <EtatVide
                texte="Aucune période pour l’instant."
                action={droits.ajouterPeriode ? <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ t: 'periode' })}>Planifier la première période</button> : undefined}
              />
            ) : (
              <ol>
                {stage.periodes.map((p) => (
                  <li key={p.id} className={`border-b border-[#F0F1F6] px-[18px] py-3.5 last:border-b-0 ${p.statut === 'ANNULEE' ? 'opacity-60' : ''}`} data-testid={`periode-${p.ordre}`}>
                    <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <b className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-ink-50 text-[11px] text-ink">{p.ordre}</b>
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-ink-900">{p.unite}</div>
                          <div className="text-[12.5px] text-text-muted">
                            du {date(p.dateDebut)} au {date(p.dateFin)} — {FORMAT_LABEL[p.formatEvaluation]}
                          </div>
                        </div>
                      </div>
                      <Pastille ton={tonPeriode(p)}>{PERIODE_STATUT_LABEL[p.statut]}</Pastille>
                    </div>
                    <div className="pl-[32px] text-[12.5px] text-text-muted">
                      Tuteur : {p.tuteur ? `${p.tuteur.firstName} ${p.tuteur.lastName}` : '—'}
                      {p.responsables.length > 0 && ` · Responsable : ${p.responsables.map((r) => `${r.firstName} ${r.lastName}`).join(', ')}`}
                    </div>
                    {p.objectifs && <p className="mt-1 whitespace-pre-wrap pl-[32px] text-[13px]">Objectifs : {p.objectifs}</p>}
                    {p.motifRefus && p.statut === 'REFUSEE' && <p className="mt-1 pl-[32px] text-[12.5px] text-clay">Refusée : {p.motifRefus}</p>}

                    {(p.droits.accepter || p.droits.refuser || p.droits.changerTuteur || p.droits.modifier || p.droits.annuler) && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-[32px]">
                        {p.droits.accepter && (
                          <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setFenetre({ t: 'accepter', periode: p })}>
                            Accepter et désigner le tuteur
                          </button>
                        )}
                        {p.droits.refuser && (
                          <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ t: 'refuser', periode: p })}>
                            Rejeter avec un motif
                          </button>
                        )}
                        {p.droits.changerTuteur && (
                          <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ t: 'tuteur', periode: p })}>
                            Changer de tuteur
                          </button>
                        )}
                        {p.droits.modifier && (
                          <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ t: 'periode', periode: p })}>
                            Modifier
                          </button>
                        )}
                        {p.droits.annuler && (
                          <button
                            type="button"
                            className={`${BTN_LIGNE} disabled:opacity-50`}
                            disabled={enCours}
                            onClick={() => window.confirm('Retirer cette période du plan ?') && agir(() => retirerPeriode(stage.id, p.id), { titre: 'Période retirée du plan', detail: p.unite })}
                          >
                            Retirer du plan
                          </button>
                        )}
                      </div>
                    )}
                    {(p.evaluation || p.droits.rediger || p.droits.changerFormat || p.droits.viser) && (
                      <div className="pl-[32px]">
                        <BlocEvaluation
                          key={p.id}
                          stage={stage}
                          periode={p}
                          onChange={setStage}
                          onRenvoyer={() => setFenetre({ t: 'renvoyer', periode: p })}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panneau>

          {(stage.encadrantPrincipal || rapport.statut || Object.values(rapport.droits).some(Boolean)) && (
            <Panneau titre="Rapport de stage" testid="rapport-stage">
              <div className="px-[18px] py-3.5">
                <p className="mb-1 text-[13px]" data-testid="encadrant-principal">
                  Encadreur principal :{' '}
                  {stage.encadrantPrincipal ? (
                    <strong>
                      {stage.encadrantPrincipal.firstName} {stage.encadrantPrincipal.lastName}
                    </strong>
                  ) : (
                    <span className="text-text-muted">non désigné</span>
                  )}
                </p>
                <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]" data-testid="statut-rapport">
                  {rapport.statut ? (
                    <>
                      <Pastille ton={rapport.statut === 'VALIDE' ? 'vert' : rapport.statut === 'A_REPRENDRE' ? 'rouge' : 'ambre'}>{RAPPORT_STATUT_LABEL[rapport.statut]}</Pastille>
                      <span>
                        {rapport.fichier ? ` ${rapport.fichier}` : ''}
                        {rapport.deposeLe ? ` — déposé le ${date(rapport.deposeLe)}` : ''}
                        {rapport.valideLe ? `, validé le ${date(rapport.valideLe)}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="text-text-muted">Aucun rapport déposé.</span>
                  )}
                </p>
                {rapport.statut === 'A_REPRENDRE' && rapport.motif && <p className="mb-2 rounded-[8px] bg-clay-50 px-3 py-2 text-[12.5px] text-clay">Motif : {rapport.motif}</p>}
                {moi && rapport.droits.deposer && !stage.encadrantPrincipal && <p className="mb-2 text-[12.5px] text-text-muted">Le DRH doit d’abord désigner votre encadreur principal.</p>}
                <div className="flex flex-wrap gap-1.5">
                  {rapport.droits.designerEncadrant && (
                    <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ t: 'encadrant' })}>
                      {stage.encadrantPrincipal ? 'Changer d’encadreur' : 'Désigner l’encadreur'}
                    </button>
                  )}
                  {rapport.droits.deposer && stage.encadrantPrincipal && (
                    <button type="button" className={BTN_LIGNE_PRINCIPAL} disabled={enCours} onClick={() => setFenetre({ t: 'deposerRapport' })}>
                      {rapport.statut ? 'Déposer une nouvelle version' : 'Déposer mon rapport'}
                    </button>
                  )}
                  {rapport.droits.telecharger && (
                    <button type="button" className={BTN_LIGNE} onClick={() => agir(() => telechargerRapport(stage.id))}>
                      Télécharger le rapport
                    </button>
                  )}
                  {rapport.droits.valider && (
                    <>
                      <button type="button" className={`${BTN_LIGNE_PRINCIPAL} disabled:opacity-50`} disabled={enCours} onClick={() => agir(() => validerRapport(stage.id), { titre: 'Rapport validé', detail: 'Le stagiaire est prévenu.' })}>
                        Valider le rapport
                      </button>
                      <button type="button" className={BTN_LIGNE} onClick={() => setFenetre({ t: 'renvoyerRapport' })}>
                        Demander une reprise
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Panneau>
          )}

          {(attestation.acte || Object.values(attestation.droits).some(Boolean)) && (
            <Panneau titre="Attestation de fin de stage" testid="attestation">
              <div className="px-[18px] py-3.5">
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
                      <Link href="/stages/parametres" className="font-semibold text-ink underline">
                        Modèle et capacités
                      </Link>
                    </p>
                  )
                )}
                <div className="flex flex-wrap gap-1.5">
                  {attestation.droits.provisoire && (
                    <button type="button" className={BTN_LIGNE} onClick={() => agir(() => telechargerProvisoire(stage.id))}>
                      Version provisoire (PDF)
                    </button>
                  )}
                  {attestation.droits.document && (
                    <button type="button" className={BTN_LIGNE} onClick={() => agir(() => telechargerDocument(stage.id))}>
                      Document rempli
                    </button>
                  )}
                  {attestation.droits.creerActe && (
                    <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => setFenetre({ t: 'acte' })}>
                      Préparer l’attestation finale
                    </button>
                  )}
                  {attestation.droits.telechargerFinale && (
                    <button type="button" className={BTN_LIGNE} onClick={() => agir(() => telechargerFinale(stage.id))}>
                      Télécharger l’attestation signée
                    </button>
                  )}
                  {attestation.droits.prendreConnaissance && (
                    <button type="button" className={`${BTN_LIGNE_PRINCIPAL} disabled:opacity-50`} disabled={enCours} onClick={() => agir(() => prendreConnaissanceAttestation(stage.id), { titre: 'Prise de connaissance enregistrée' })}>
                      J’ai pris connaissance de mon attestation
                    </button>
                  )}
                </div>
              </div>
            </Panneau>
          )}
        </div>

        <aside className="space-y-4" aria-label="Actions et informations du stage">
          {actionsStage && (
            <section aria-label="Actions sur le stage" className="grid gap-2 rounded-xl border border-line bg-surface p-4">
              {droits.modifier && (
                <button type="button" className={BTN_SECONDAIRE} onClick={() => setFenetre({ t: 'modifier' })}>
                  <Pencil aria-hidden size={15} /> Modifier le stage
                </button>
              )}
              {droits.cloturer && (
                <button type="button" className={BTN_SECONDAIRE} disabled={enCours} onClick={() => window.confirm('Clôturer ce stage ?') && agir(() => cloturerStage(stage.id), { titre: 'Stage clôturé', detail: 'Le dossier est conservé ; l’attestation finale peut être préparée.' })}>
                  Clôturer
                </button>
              )}
              {droits.interrompre && (
                <button type="button" className={BTN_DANGER_CONTOUR} onClick={() => setFenetre({ t: 'interrompre' })}>
                  Interrompre
                </button>
              )}
              <p className="text-[12.5px] text-text-muted" data-testid="explication-stage">
                Le plan de rotation, les évaluations et l’attestation se traitent dans les panneaux de gauche. Clôturer ou interrompre termine le stage ; le dossier est conservé.
              </p>
            </section>
          )}
          <section aria-label="Informations du stage" className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-3 font-heading text-[14px] font-bold text-ink-900">Informations</h2>
            <CleValeur
              largeur={104}
              lignes={[
                ['Statut', <Pastille key="s" ton={TON_STAGE[stage.statut]}>{STAGE_STATUT_LABEL[stage.statut]}</Pastille>],
                ['Établissement', stage.etablissement],
                ...(stage.diplomePrepare ? ([['Diplôme', stage.diplomePrepare]] as [string, string][]) : []),
                ['Début', date(stage.dateDebut)],
                ['Fin', date(stage.dateFin)],
                ['Rattachement', stage.rattachementActuel],
                ['Encadreur', stage.encadrantPrincipal ? `${stage.encadrantPrincipal.firstName} ${stage.encadrantPrincipal.lastName}` : 'non désigné'],
              ]}
            />
          </section>
        </aside>
      </div>

      {fenetre?.t === 'modifier' && <FenetreModifierStage stage={stage} onClose={() => setFenetre(null)} onDone={fermer('Stage modifié')} />}
      {fenetre?.t === 'periode' && <FenetrePeriode stage={stage} periode={fenetre.periode} onClose={() => setFenetre(null)} onDone={fermer(fenetre.periode ? 'Période modifiée' : 'Période ajoutée', fenetre.periode ? undefined : 'L’unité d’accueil est prévenue pour l’accepter.')} />}
      {(fenetre?.t === 'accepter' || fenetre?.t === 'tuteur') && (
        <FenetreTuteur stage={stage} periode={fenetre.periode} mode={fenetre.t === 'accepter' ? 'accepter' : 'changer'} onClose={() => setFenetre(null)} onDone={fermer(fenetre.t === 'accepter' ? 'Période acceptée' : 'Tuteur changé', 'Le tuteur et le stagiaire sont prévenus.')} />
      )}
      {fenetre?.t === 'refuser' && (
        <FenetreMotif titre="Rejeter la période" sousTitre="Le DRH est prévenu et corrige le plan." valider="Rejeter" action={(m) => refuserPeriode(stage.id, fenetre.periode.id, m)} onClose={() => setFenetre(null)} onDone={fermer('Période rejetée', 'Le DRH est prévenu.')} />
      )}
      {fenetre?.t === 'renvoyer' && (
        <FenetreMotif titre="Renvoyer l’évaluation au tuteur" valider="Renvoyer" action={(m) => renvoyerEvaluation(stage.id, fenetre.periode.id, m)} onClose={() => setFenetre(null)} onDone={fermer('Évaluation renvoyée', 'Le tuteur est prévenu.')} />
      )}
      {fenetre?.t === 'interrompre' && (
        <FenetreMotif
          titre="Interrompre le stage"
          sousTitre="La période en cours se termine aujourd’hui ; les périodes à venir sont retirées du plan."
          valider="Interrompre"
          action={(m) => interrompreStage(stage.id, m)}
          onClose={() => setFenetre(null)}
          onDone={fermer('Stage interrompu', 'Le dossier est conservé.')}
        />
      )}
      {fenetre?.t === 'encadrant' && <FenetreEncadrant stage={stage} onClose={() => setFenetre(null)} onDone={fermer('Encadreur principal désigné', 'Il est prévenu.')} />}
      {fenetre?.t === 'renvoyerRapport' && (
        <FenetreMotif titre="Demander une reprise du rapport" sousTitre="Le stagiaire est prévenu et dépose une nouvelle version." valider="Renvoyer" action={(m) => renvoyerRapport(stage.id, m)} onClose={() => setFenetre(null)} onDone={fermer('Reprise demandée', 'Le stagiaire est prévenu.')} />
      )}
      {fenetre?.t === 'acte' && <FenetreActeAttestation stage={stage} onClose={() => setFenetre(null)} onDone={() => fermer('Acte préparé', 'Il suit le circuit du Courrier jusqu’à la signature.')()} />}
      {fenetre?.t === 'deposerRapport' && (
        <FenetreRapport stage={stage} nouvelleVersion={!!rapport.statut} onClose={() => setFenetre(null)} onDone={fermer('Rapport déposé', 'Votre encadreur est prévenu.')} />
      )}
    </div>
  );
}

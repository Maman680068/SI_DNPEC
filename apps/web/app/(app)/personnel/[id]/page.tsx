'use client';

import { demanderReauthentification } from '../../../../lib/api/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useOrg } from '../../../../lib/org/OrgProvider';
import {
  confirmerMesInformations,
  getDossier,
  supprimerDiplome,
  supprimerPiece,
  telechargerDiplome,
  telechargerFicheDePoste,
  telechargerPiece,
} from '../../../../lib/api/personnel';
import type { DossierPersonnel, StatutChamp } from '../../../../lib/personnel/types';
import { CAREER_EVENT_LABEL, EMPLOYMENT_STATUS_LABEL, STATUT_CHAMP_LABEL } from '../../../../lib/personnel/types';
import { ROLE_LABEL, STATUS_LABEL } from '../../../../lib/users/types';
import { Erreur, messageErreur } from '../../../../components/courrier/ui';
import { FenetreDiplome, FenetreNiveauDeux, FenetreNiveauUn, FenetrePiece, FenetreSignaler } from '../../../../components/personnel/FenetresDossier';
import { ChevronLeft, Lock } from 'lucide-react';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_PRINCIPAL, BTN_SECONDAIRE, Initiales, Pastille, initialesDe } from '../../../../components/ui/Charte';

type Fenetre = 'niveau1' | 'niveau2' | 'diplome' | 'piece' | 'signaler' | null;

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : null);

function Statut({ statut }: { statut: StatutChamp | undefined }) {
  if (!statut || statut === 'NON_RENSEIGNE') return null;
  return <Pastille ton={statut === 'CONFIRME' ? 'vert' : 'ambre'}>{STATUT_CHAMP_LABEL[statut]}</Pastille>;
}

function Ligne({ label, valeur, statut, children }: { label: string; valeur: ReactNode; statut?: StatutChamp; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0" data-testid={`champ-${label}`}>
      <dt className="text-[12.5px] text-text-muted">{label}</dt>
      <dd className="flex flex-wrap items-center justify-end gap-2 text-right text-[13.5px]">
        <span>{valeur ?? <span className="text-text-faint">Non renseigné</span>}</span>
        <Statut statut={statut} />
        {children}
      </dd>
    </div>
  );
}

function Section({ titre, action, children, testid }: { titre: string; action?: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <section className="mb-4 rounded-xl border border-line bg-surface" data-testid={testid}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-[18px] py-3">
        <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{titre}</h2>
        {action}
      </div>
      <div className="px-[18px] py-2">{children}</div>
    </section>
  );
}

/** Dossier d'une personne (D3). Tout ce qui s'affiche vient de l'API : le
 * niveau 2 n'est rendu que si l'API l'a transmis (personne concernée et DRH),
 * les boutons suivent `droits`, les statuts « à vérifier » `statuts`. */
export default function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const { getCelluleName, getDivisionName, getSectionName } = useOrg();
  const [dossier, setDossier] = useState<DossierPersonnel | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const [enCours, setEnCours] = useState(false);
  const requete = useRef(0);

  const charger = useCallback(() => {
    const n = ++requete.current;
    getDossier(id)
      .then((d) => {
        if (n !== requete.current) return;
        setDossier(d);
        setErreur(null);
      })
      .catch((err) => n === requete.current && setErreur(messageErreur(err, 'Impossible de charger ce dossier')));
  }, [id]);

  useEffect(() => {
    setDossier(null);
    charger();
  }, [charger]);

  async function agir(fn: () => Promise<unknown>, defaut: string, apres?: string) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      if (apres) setInfo(apres);
      charger();
    } catch (err) {
      setErreur(messageErreur(err, defaut));
    } finally {
      setEnCours(false);
    }
  }

  const fermerEtRecharger = (message?: string) => () => {
    setFenetre(null);
    if (message) setInfo(message);
    charger();
  };

  if (!dossier) {
    return (
      <div>
        <Link href="/personnel" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
          <ChevronLeft aria-hidden size={15} />
          Dossier du personnel
        </Link>
        <Erreur message={erreur} />
        {!erreur && <p className="text-sm text-text-muted">Chargement…</p>}
      </div>
    );
  }

  const { identite: p, basic, statuts, sensitive, droits } = dossier;
  const unite = p.celluleId ? getCelluleName(p.celluleId) : [getDivisionName(p.divisionId), getSectionName(p.sectionId)].filter(Boolean).join(' · ');

  return (
    <div className="max-w-[860px]">
      <Link href="/personnel" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
        <ChevronLeft aria-hidden size={15} />
        Dossier du personnel
      </Link>
      <div className="mb-4 flex items-center gap-3.5">
        <Initiales texte={initialesDe(p.firstName, p.lastName)} taille={48} />
        <div className="min-w-0">
        <h1 className="font-heading text-[24px] font-extrabold leading-tight text-ink-900">
          {p.firstName} {p.lastName}
        </h1>
        <p className="text-[13.5px] text-text-muted">
          {ROLE_LABEL[p.role]}
          {p.jobTitle ? ` — ${p.jobTitle}` : ''}
          {unite ? ` — ${unite}` : ''}
          {p.status !== 'ACTIF' ? ` — compte ${STATUS_LABEL[p.status].toLowerCase()}` : ''}
        </p>
        </div>
      </div>

      <Erreur message={erreur} />
      {info && <div role="status" className="mb-4 rounded-[10px] border border-[#A9D5B7] bg-sage-50 px-3.5 py-2.5 text-[13px] text-sage">{info}</div>}

      {droits.confirmer && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#F2D58A] bg-gold-50 px-3.5 py-2.5" data-testid="bandeau-a-verifier">
          <p className="text-[13px] text-ink">Des informations de votre dossier sont « à vérifier ». Relisez-les, puis confirmez-les ou signalez une erreur.</p>
          <button type="button"
            className={BTN_PRINCIPAL}
            disabled={enCours}
            onClick={() => agir(() => confirmerMesInformations(dossier.userId), 'Confirmation impossible', 'Vos informations sont confirmées.')}
          >
            Confirmer mes informations
          </button>
        </div>
      )}

      <Section
        titre="Situation administrative"
        testid="niveau-1"
        action={
          droits.modifier && (
            <button type="button" className={BTN_LIGNE} onClick={() => setFenetre('niveau1')}>
              Modifier
            </button>
          )
        }
      >
        <dl>
          <Ligne label="Statut d’emploi" valeur={basic.employmentStatus ? EMPLOYMENT_STATUS_LABEL[basic.employmentStatus] : null} statut={statuts.employmentStatus} />
          <Ligne label="Grade" valeur={basic.grade} statut={statuts.grade} />
          <Ligne label="Échelon" valeur={basic.echelon} statut={statuts.echelon} />
          <Ligne label="Dans l’échelon depuis" valeur={basic.echelonDepuis ? date(basic.echelonDepuis) : null} />
          <Ligne label="Catégorie" valeur={basic.categorie} />
          <Ligne label="Date de prise de service" valeur={date(basic.serviceStartDate)} statut={statuts.serviceStartDate} />
          <Ligne label="Fiche de poste" valeur={basic.jobDescriptionFileName} statut={statuts.jobDescription}>
            {basic.jobDescriptionFileName && (
              <button type="button"
                className={BTN_LIGNE}
                onClick={() => agir(() => telechargerFicheDePoste(dossier.userId, basic.jobDescriptionFileName as string), 'Téléchargement impossible')}
              >
                Télécharger
              </button>
            )}
          </Ligne>
        </dl>
      </Section>

      {sensitive ? (
        <>
          <Section
            titre="Informations personnelles"
            testid="niveau-2"
            action={
              droits.modifier && (
                <button type="button" className={BTN_LIGNE} onClick={() => setFenetre('niveau2')}>
                  Modifier
                </button>
              )
            }
          >
            <p className="mb-1 text-[11.5px] text-text-faint">Réservées à la personne et au DRH.</p>
            <dl>
              <Ligne label="Adresse personnelle" valeur={sensitive.personalAddress} statut={statuts.personalAddress} />
              <Ligne label="Téléphone personnel" valeur={sensitive.personalPhone} statut={statuts.personalPhone} />
              <Ligne label="Email personnel" valeur={sensitive.personalEmail} statut={statuts.personalEmail} />
              <Ligne
                label="Contact d’urgence"
                valeur={
                  [sensitive.emergencyContactName, sensitive.emergencyContactRelation && `(${sensitive.emergencyContactRelation})`, sensitive.emergencyContactPhone]
                    .filter(Boolean)
                    .join(' ') || null
                }
                statut={statuts.emergencyContact}
              />
            </dl>
          </Section>

          <Section
            titre="Diplômes"
            action={
              droits.modifier && (
                <button type="button" className={BTN_LIGNE} onClick={() => setFenetre('diplome')}>
                  Ajouter
                </button>
              )
            }
          >
            {dossier.diplomas.length === 0 ? (
              <p className="text-[13px] text-text-faint">Aucun diplôme enregistré.</p>
            ) : (
              <ul>
                {dossier.diplomas.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
                    <div className="text-[13.5px]">
                      <strong>{d.title}</strong>
                      <span className="text-text-muted">{[d.institution, d.obtainedYear].filter(Boolean).map((x) => ` — ${x}`).join('')}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pastille ton={d.verified ? 'vert' : 'ambre'}>{d.verified ? 'Confirmé' : 'À vérifier'}</Pastille>
                      {d.fileName && (
                        <button type="button" className={BTN_LIGNE} onClick={() => agir(() => telechargerDiplome(dossier.userId, d.id, d.fileName as string), 'Téléchargement impossible')}>
                          Justificatif
                        </button>
                      )}
                      {droits.modifier && (
                        <button type="button"
                          className={BTN_LIGNE}
                          disabled={enCours}
                          onClick={() => window.confirm(`Supprimer le diplôme « ${d.title} » ?`) && agir(() => supprimerDiplome(dossier.userId, d.id), 'Suppression impossible')}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            titre="Pièces administratives"
            action={
              droits.modifier && (
                <button type="button" className={BTN_LIGNE} onClick={() => setFenetre('piece')}>
                  Ajouter
                </button>
              )
            }
          >
            {dossier.documents.length === 0 ? (
              <p className="text-[13px] text-text-faint">Aucune pièce enregistrée.</p>
            ) : (
              <ul>
                {dossier.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
                    <div className="text-[13.5px]">
                      <strong>{d.label}</strong>
                      <span className="text-text-muted">
                        {' '}
                        — déposée le {date(d.createdAt)} par {d.uploadedBy.firstName} {d.uploadedBy.lastName}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pastille ton={d.verified ? 'vert' : 'ambre'}>{d.verified ? 'Confirmé' : 'À vérifier'}</Pastille>
                      <button type="button" className={BTN_LIGNE} onClick={() => agir(() => telechargerPiece(dossier.userId, d.id, d.fileName), 'Téléchargement impossible')}>
                        Télécharger
                      </button>
                      {droits.modifier && (
                        <button type="button"
                          className={BTN_LIGNE}
                          disabled={enCours}
                          onClick={() => window.confirm(`Supprimer la pièce « ${d.label} » ?`) && agir(() => supprimerPiece(dossier.userId, d.id), 'Suppression impossible')}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section titre="Historique de carrière" testid="historique">
            <p className="mb-1 text-[11.5px] text-text-faint">Tenu automatiquement (affectations, promotions, changements de fonction) — lecture seule.</p>
            {dossier.careerHistory.length === 0 ? (
              <p className="text-[13px] text-text-faint">Aucun événement enregistré.</p>
            ) : (
              <ol>
                {dossier.careerHistory.map((e) => (
                  <li key={e.id} className="border-b border-line py-2.5 text-[13px] last:border-b-0">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{CAREER_EVENT_LABEL[e.eventType]}</strong>
                      <span className="text-text-muted">{date(e.effectiveDate)}</span>
                    </div>
                    <div className="text-text-muted">
                      {e.fromValue ?? '—'} → {e.toValue ?? '—'}
                      <span className="text-text-faint">
                        {' '}
                        (enregistré par {e.recordedBy.firstName} {e.recordedBy.lastName})
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </>
      ) : dossier.niveau2Verrouille ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#F2D58A] bg-gold-50 px-3.5 py-2.5" data-testid="niveau-2-verrouille">
          <p className="flex items-start gap-2 text-[13px] text-ink">
            <Lock aria-hidden size={16} className="mt-0.5 flex-none" />
            Informations personnelles, diplômes, pièces et historique de carrière : éléments protégés. Confirmez votre identité pour les afficher.
          </p>
          <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={() => demanderReauthentification().then((ok) => ok && charger())}>
            Afficher les données protégées
          </button>
        </div>
      ) : (
        <p className="mb-4 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13px] text-text-muted" data-testid="niveau-2-reserve">
          Les informations personnelles, diplômes, pièces administratives et l’historique de carrière sont réservés à la personne concernée et au DRH.
        </p>
      )}

      {droits.signaler && (
        <button type="button" className={BTN_SECONDAIRE} onClick={() => setFenetre('signaler')}>Signaler une erreur</button>
      )}

      {fenetre === 'niveau1' && <FenetreNiveauUn dossier={dossier} onClose={() => setFenetre(null)} onDone={fermerEtRecharger('Situation administrative enregistrée.')} />}
      {fenetre === 'niveau2' && <FenetreNiveauDeux dossier={dossier} onClose={() => setFenetre(null)} onDone={fermerEtRecharger('Informations personnelles enregistrées.')} />}
      {fenetre === 'diplome' && <FenetreDiplome dossier={dossier} onClose={() => setFenetre(null)} onDone={fermerEtRecharger('Diplôme ajouté.')} />}
      {fenetre === 'piece' && <FenetrePiece dossier={dossier} onClose={() => setFenetre(null)} onDone={fermerEtRecharger('Pièce ajoutée.')} />}
      {fenetre === 'signaler' && <FenetreSignaler dossier={dossier} onClose={() => setFenetre(null)} onDone={fermerEtRecharger('Le DRH a été prévenu.')} />}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, FileText, Flag } from 'lucide-react';
import {
  abandonnerVersion,
  approuverVersion,
  confirmerDerogation,
  demanderDerogation,
  getModele,
  getVersion,
  refuserVersion,
} from '../../../../lib/api/modelisation';
import type { FicheModele, VersionDetail } from '../../../../lib/modelisation/types';
import { Bandeau, BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage, Pastille } from '../../../../components/ui/Charte';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { SquelettePage } from '../../../../components/ui/Squelette';
import { useToast, messageErreur } from '../../../../components/ui/Toast';
import { ListeControles, TON_VERSION } from '../../../../components/modelisation/ListeControles';
import { FenetreConfirmationDerogation, FenetreDesignation, FenetreFicheModele, FenetreMotif } from '../../../../components/modelisation/FenetresModele';
import { FenetreDepot } from '../../../../components/modelisation/FenetreDepot';
import { useNavigation } from '../../../../lib/navigation/NavigationProvider';

type Fenetre =
  | { type: 'fiche' }
  | { type: 'refus' }
  | { type: 'abandon' }
  | { type: 'derogation'; controleId: string }
  | { type: 'confirmation'; controleId: string }
  | { type: 'designation'; role: 'RESPONSABLE' | 'SUPPLEANT' }
  | { type: 'depot' };

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function LigneInfo({ libelle, valeur, action }: { libelle: string; valeur: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-doux py-[7px] text-[13px] last:border-b-0">
      <dt className="text-text-muted">{libelle}</dt>
      <dd className="flex items-center gap-2 text-right font-bold text-ink-900">
        {valeur}
        {action}
      </dd>
    </div>
  );
}

/** Fiche d'un modèle (domaine B, lot B1, maquette mod-4) : versions, contrôles, approbation, gouvernance. */
export default function FicheModelePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { rafraichir } = useNavigation();
  const [fiche, setFiche] = useState<FicheModele | null>(null);
  const [vue, setVue] = useState<VersionDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    getModele(id)
      .then((f) => {
        setFiche(f);
        setVue(f.version);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [id]);
  useEffect(charger, [charger]);

  const apres = (message: string) => {
    setFenetre(null);
    toast.succes(message);
    charger();
    rafraichir();
  };

  if (erreur) return <ErreurChargement message={erreur} />;
  if (!fiche) return <SquelettePage />;
  const v = vue;
  const enAttente = v?.statut === 'EN_ATTENTE';
  const derogationsAConfirmer = v ? v.derogations.filter((d) => v.droits.derogationsConfirmables.includes(d.controleId)) : [];
  const gouvernant = !!v && (v.droits.peutApprouver || v.droits.peutRefuser || v.droits.derogationsDemandables.length > 0 || !!v.droits.approbationImpossible);

  async function approuver() {
    if (!v) return;
    setEnCours(true);
    try {
      await approuverVersion(v.id);
      apres(`Version ${v.numero} approuvée et activée`);
    } catch (e) {
      toast.erreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <EnTetePage
        titre={fiche.modele.nom}
        sousTitre={[fiche.modele.famille.replace(/^[A-Z] — /, ''), fiche.modele.sousTitre].filter(Boolean).join(' · ')}
        avantActions={fiche.modele.demonstration ? <Pastille ton="encre">Démonstration</Pastille> : undefined}
        actions={
          <button type="button" className={BTN_SECONDAIRE} onClick={() => setFenetre({ type: 'fiche' })}>
            <FileText aria-hidden size={16} /> Fiche du modèle
          </button>
        }
      />

      {v && enAttente && (gouvernant ? (
        <Bandeau
          testid="bandeau-approbation"
          icone={<Flag aria-hidden size={18} className="text-ink" />}
          action={
            <div className="flex flex-wrap gap-2">
              {v.droits.peutRefuser && (
                <button type="button" className={BTN_SECONDAIRE} onClick={() => setFenetre({ type: 'refus' })}>
                  Refuser…
                </button>
              )}
              <button type="button" className={BTN_PRINCIPAL} disabled={!v.droits.peutApprouver || enCours} onClick={approuver}>
                <Check aria-hidden size={16} strokeWidth={2.5} /> Approuver et activer
              </button>
            </div>
          }
        >
          <strong>Version {v.numero} en attente de votre approbation.</strong> {v.resume.reussis} contrôle(s) réussi(s)
          {v.resume.alertes ? `, ${v.resume.alertes} alerte(s)` : ''}
          {v.resume.echecs ? `, ${v.resume.echecs} contrôle(s) bloquant(s) en échec` : ''}.
          {v.droits.approbationImpossible && <span className="block text-[13px] font-semibold text-clay">{v.droits.approbationImpossible}</span>}
        </Bandeau>
      ) : (
        <Bandeau testid="bandeau-approbation" icone={<Flag aria-hidden size={18} className="text-ink" />}>
          <strong>Version {v.numero} en attente de l’approbation du responsable du modèle.</strong>
          {derogationsAConfirmer.length > 0 && ' Une dérogation attend votre confirmation (contrôles ci-dessous).'}
        </Bandeau>
      ))}

      {v && (v.statut === 'DEPOSEE' || v.statut === 'CONTROLEE') && v.droits.peutAbandonner && (
        <Bandeau
          testid="bandeau-depot"
          ton="ambre"
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_SECONDAIRE} onClick={() => setFenetre({ type: 'abandon' })}>
                Abandonner…
              </button>
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setFenetre({ type: 'depot' })}>
                Reprendre le dépôt
              </button>
            </div>
          }
        >
          <strong>Version {v.numero} : {v.etat.libelle.toLowerCase()}.</strong> Le dépôt n’est pas encore envoyé au responsable du modèle.
        </Bandeau>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-line bg-surface px-[18px] py-4" aria-label="Versions">
          <h2 className="mb-2 font-heading text-[15.5px] font-bold text-ink-900">Versions</h2>
          <ul className="divide-y divide-line-doux" data-testid="versions">
            {fiche.versions.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={`grid w-full grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2 text-left sm:grid-cols-[42px_minmax(0,1fr)_auto_110px] ${v?.id === x.id ? 'bg-survol' : 'hover:bg-fond-doux'}`}
                  aria-current={v?.id === x.id ? 'true' : undefined}
                  onClick={() => getVersion(x.id).then(setVue).catch((e) => toast.erreur(messageErreur(e)))}
                  data-testid="version"
                >
                  <span className="font-bold text-ink-900">v{x.numero}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-ink-900">{x.nomFichier}</span>
                    <span className="block text-[12.5px] text-text-muted">
                      Déposée par {x.deposePar ?? '—'} · {dateFr(x.deposeLe)}
                    </span>
                  </span>
                  <span className="col-start-2 sm:col-start-auto">
                    <Pastille ton={TON_VERSION[x.etat.ton] ?? 'gris'}>{x.etat.libelle}</Pastille>
                  </span>
                  <span className="col-start-2 text-[12.5px] text-text-muted sm:col-start-auto">
                    {x.resume.reussis} ✓{x.resume.alertes ? ` · ${x.resume.alertes} alerte${x.resume.alertes > 1 ? 's' : ''}` : ''}
                    {x.resume.echecs ? ` · ${x.resume.echecs} échec${x.resume.echecs > 1 ? 's' : ''}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-line-doux pt-2.5 text-[13px] text-text-muted">
            Une version déposée ne se modifie plus. Pour corriger, on dépose une nouvelle version ; l’ancienne reste consultable.
          </p>
          {v && (
            <>
              <h2 className="mb-1 mt-4 font-heading text-[15.5px] font-bold text-ink-900">Contrôles de la version {v.numero}</h2>
              {v.statut === 'REFUSEE' && v.motifRefus && (
                <p className="mb-2 text-[13px] text-clay">
                  {v.motifRefus.startsWith('Dépôt abandonné') ? v.motifRefus : `Refusée par ${v.refusePar ?? '—'} : ${v.motifRefus}`}
                </p>
              )}
              {v.statut === 'ACTIVE' && v.approbateur && (
                <p className="mb-2 text-[13px] text-text-muted">
                  Approuvée et activée par {v.approbateur}
                  {v.approuveLe ? ` le ${dateFr(v.approuveLe)}` : ''}
                  {v.avecDerogation ? ' — activée avec dérogation' : ''}.
                </p>
              )}
              {v.controles.length === 0 ? (
                <p className="py-3 text-[13.5px] text-text-muted">{v.verification?.statut === 'ECHEC' ? `Vérification en échec : ${v.verification.message}` : 'Vérification automatique en cours.'}</p>
              ) : (
                <ListeControles
                  controles={v.controles}
                  apres={(c) => {
                    const d = v.derogations.find((x) => x.controleId === c.id);
                    if (d)
                      return (
                        <div className="mt-1.5 rounded-lg border border-line bg-fond-doux px-3 py-2 text-[12.5px]" data-testid="derogation">
                          <div>
                            <strong>Dérogation demandée</strong> par {d.demandeePar} le {dateFr(d.demandeeLe)} : {d.motif}
                          </div>
                          <div className={d.confirmeeLe ? 'text-sage' : 'text-ambre'}>
                            {d.confirmeeLe ? `Confirmée par ${d.confirmeePar} le ${dateFr(d.confirmeeLe)}.` : 'En attente de la confirmation de l’administrateur.'}
                          </div>
                          {v.droits.derogationsConfirmables.includes(c.id) && (
                            <button type="button" className={`${BTN_LIGNE} mt-1.5`} onClick={() => setFenetre({ type: 'confirmation', controleId: c.id })}>
                              Confirmer la dérogation…
                            </button>
                          )}
                        </div>
                      );
                    if (v.droits.derogationsDemandables.includes(c.id))
                      return (
                        <button type="button" className={`${BTN_LIGNE} mt-1.5`} onClick={() => setFenetre({ type: 'derogation', controleId: c.id })}>
                          Demander une dérogation…
                        </button>
                      );
                    return null;
                  }}
                />
              )}
            </>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-line bg-surface px-[18px] py-4" aria-label="Gouvernance, données et utilisation">
          <h2 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-text-muted">Gouvernance</h2>
          <dl data-testid="gouvernance">
            <LigneInfo
              libelle="Responsable"
              valeur={fiche.gouvernance.responsable?.nom ?? 'À désigner'}
              action={
                fiche.droits.peutDesigner && (
                  <button type="button" className={BTN_LIGNE} aria-label="Désigner le responsable du modèle" onClick={() => setFenetre({ type: 'designation', role: 'RESPONSABLE' })}>
                    Désigner
                  </button>
                )
              }
            />
            <LigneInfo
              libelle="Suppléant"
              valeur={fiche.gouvernance.suppleant?.nom ?? 'À désigner'}
              action={
                fiche.droits.peutDesigner && (
                  <button type="button" className={BTN_LIGNE} aria-label="Désigner le suppléant du responsable" onClick={() => setFenetre({ type: 'designation', role: 'SUPPLEANT' })}>
                    Désigner
                  </button>
                )
              }
            />
            <LigneInfo libelle="Administrateur" valeur={fiche.gouvernance.administrateur ?? '—'} />
          </dl>
          <h2 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide text-text-muted">Données</h2>
          <dl>
            <LigneInfo libelle="Base" valeur={fiche.donnees.base ?? '—'} />
            <LigneInfo libelle="Fichiers déclarés" valeur={String(fiche.donnees.fichiers.length)} />
            <LigneInfo libelle="Référence" valeur={fiche.donnees.reference ? [fiche.donnees.reference.logiciel?.split(' ')[0], fiche.donnees.reference.date].filter(Boolean).join(' · ') : '—'} />
          </dl>
          <h2 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide text-text-muted">Utilisation</h2>
          <dl data-testid="utilisation">
            <LigneInfo libelle="Manettes" valeur={`${fiche.utilisation.manettesActives} active${fiche.utilisation.manettesActives > 1 ? 's' : ''}`} />
            <LigneInfo libelle="Compteurs" valeur={String(fiche.utilisation.compteurs)} />
            <LigneInfo libelle="Simulations" valeur={String(fiche.utilisation.simulations)} />
          </dl>
          <p className="mt-3 text-[13px] leading-snug text-text-muted">L’approbation est faite par le responsable du modèle, jamais par la personne qui a déposé la version.</p>
        </aside>
      </div>

      {fenetre?.type === 'fiche' && <FenetreFicheModele fiche={fiche} onClose={() => setFenetre(null)} />}
      {fenetre?.type === 'refus' && v && (
        <FenetreMotif
          titre={`Refuser la version ${v.numero}`}
          sousTitre={fiche.modele.nom}
          libelle="Motif du refus"
          libelleValider="Refuser la version"
          danger
          testid="fenetre-refus"
          pied="L’administrateur qui a déposé la version est prévenu ; une nouvelle version pourra être déposée."
          onClose={() => setFenetre(null)}
          onValider={async (motif) => {
            await refuserVersion(v.id, motif);
            apres(`Version ${v.numero} refusée`);
          }}
        />
      )}
      {fenetre?.type === 'abandon' && v && (
        <FenetreMotif
          titre={`Abandonner le dépôt de la version ${v.numero}`}
          sousTitre={fiche.modele.nom}
          libelle="Motif"
          libelleValider="Abandonner le dépôt"
          danger
          testid="fenetre-abandon"
          pied="La version reste consultable (refusée) ; un autre paquet pourra être déposé."
          onClose={() => setFenetre(null)}
          onValider={async (motif) => {
            await abandonnerVersion(v.id, motif);
            apres('Dépôt abandonné');
          }}
        />
      )}
      {fenetre?.type === 'derogation' && v && (
        <FenetreMotif
          titre="Demander une dérogation"
          sousTitre={`${v.controles.find((c) => c.id === fenetre.controleId)?.libelle} · ${v.controles.find((c) => c.id === fenetre.controleId)?.valeur}`}
          libelle="Motif écrit (obligatoire)"
          libelleValider="Demander la dérogation"
          testid="fenetre-derogation"
          pied="L’administrateur confirme la dérogation (il voit le contrôle et l’écart, jamais les résultats). La version gardera la mention « activée avec dérogation »."
          onClose={() => setFenetre(null)}
          onValider={async (motif) => {
            await demanderDerogation(v.id, fenetre.controleId, motif);
            apres('Dérogation demandée : l’administrateur est prévenu');
          }}
        />
      )}
      {fenetre?.type === 'confirmation' && v && (
        <FenetreConfirmationDerogation
          controle={v.controles.find((c) => c.id === fenetre.controleId)}
          derogation={v.derogations.find((d) => d.controleId === fenetre.controleId)!}
          onClose={() => setFenetre(null)}
          onConfirmer={async () => {
            await confirmerDerogation(v.id, fenetre.controleId);
            apres('Dérogation confirmée : le responsable est prévenu');
          }}
        />
      )}
      {fenetre?.type === 'designation' && (
        <FenetreDesignation
          modeleId={fiche.modele.id}
          nomModele={fiche.modele.nom}
          role={fenetre.role}
          actuel={(fenetre.role === 'RESPONSABLE' ? fiche.gouvernance.responsable?.nom : fiche.gouvernance.suppleant?.nom) ?? null}
          onClose={() => setFenetre(null)}
          onFait={() => apres(fenetre.role === 'RESPONSABLE' ? 'Responsable désigné' : 'Suppléant désigné')}
        />
      )}
      {fenetre?.type === 'depot' && v && (
        <FenetreDepot
          versionInitiale={v}
          onClose={() => {
            setFenetre(null);
            charger();
            rafraichir();
          }}
          onTermine={() => {
            setFenetre(null);
            charger();
            rafraichir();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, LoaderCircle, X } from 'lucide-react';
import { deposerPaquet, envoyerVersion, getModele, getVersion, reglerVersion, relancerVerification } from '../../lib/api/modelisation';
import type { FicheModele, VersionDetail } from '../../lib/modelisation/types';
import { BTN_PRINCIPAL, BTN_SECONDAIRE } from '../ui/Charte';
import { Case, ZoneDepot } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';
import { empreinteCourte, ListeControles, taillePaquet } from './ListeControles';

const ETAPES = ['Fichier', 'Vérification automatique', 'Manettes et compteurs', 'Envoi au responsable'];

/** Bandeau d'étapes de la maquette (rond coché vert, rond or numéroté, rond gris, trait). */
function Etapes({ courante }: { courante: number }) {
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2" aria-label="Étapes du dépôt">
      {ETAPES.map((e, i) => {
        const n = i + 1;
        const fait = n < courante;
        const actif = n === courante;
        return (
          <li key={e} className="flex items-center gap-2.5" aria-current={actif ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className={`hidden h-[2px] w-14 sm:block ${fait || actif ? 'bg-sage' : 'bg-line'}`} />}
            <span className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11.5px] font-bold ${fait ? 'bg-sage text-white' : actif ? 'bg-gold text-ink-900' : 'bg-[#ECEEF3] text-text-muted'}`}>
              {fait ? <Check aria-hidden size={13} strokeWidth={3} /> : n}
            </span>
            <span className={`text-[13.5px] font-bold ${fait ? 'text-sage' : actif ? 'text-ink-900' : 'text-text-muted'}`}>
              {e}
              {fait && <span className="sr-only"> (fait)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const heureDepot = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Dépôt d'un modèle en 4 étapes dans une fenêtre centrée (maquettes mod-2 et mod-3) : fichier et
 * case « données publiées ou autorisées », vérification automatique par le service de calcul (réveil
 * du service gratuit compris), manettes et compteurs, envoi au responsable. Une version déjà
 * déposée (fiche du modèle) reprend à l'étape où elle s'est arrêtée.
 */
export function FenetreDepot({ onClose, onTermine, versionInitiale }: { onClose: () => void; onTermine: (modeleId: string) => void; versionInitiale?: VersionDetail }) {
  const idTitre = useId();
  const [etape, setEtape] = useState(versionInitiale ? (versionInitiale.statut === 'CONTROLEE' ? 3 : 2) : 1);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [confirme, setConfirme] = useState(false);
  const [version, setVersion] = useState<VersionDetail | null>(versionInitiale ?? null);
  const [reglages, setReglages] = useState<VersionDetail['manettes']>(versionInitiale?.manettes ?? []);
  const [compteurs, setCompteurs] = useState<VersionDetail['compteurs']>(versionInitiale?.compteurs ?? []);
  const [fiche, setFiche] = useState<FicheModele | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onClose]);
  useEffect(() => {
    boite.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [etape]);

  const prendre = useCallback((v: VersionDetail) => {
    setVersion(v);
    setReglages(v.manettes);
    setCompteurs(v.compteurs);
  }, []);

  // Vérification automatique : relecture régulière tant que le service de calcul travaille.
  const enAttente = etape === 2 && version?.statut === 'DEPOSEE' && version.verification?.statut !== 'ECHEC';
  useEffect(() => {
    if (!enAttente || !version) return;
    const t = window.setInterval(() => {
      getVersion(version.id)
        .then(prendre)
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(t);
  }, [enAttente, version, prendre]);

  useEffect(() => {
    if (etape === 4 && version) getModele(version.modele.id).then(setFiche).catch(() => undefined);
  }, [etape, version]);

  async function deposer() {
    setErreur(null);
    if (!fichiers[0]) return setErreur('Choisissez le fichier .zip du paquet de modèle.');
    if (!confirme) return setErreur('Cochez la confirmation sur les données du paquet.');
    setEnCours(true);
    try {
      prendre(await deposerPaquet(fichiers[0], true));
      setEtape(2);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function relancer() {
    if (!version) return;
    setErreur(null);
    try {
      prendre(await relancerVerification(version.id));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function envoyer() {
    if (!version) return;
    setErreur(null);
    setEnCours(true);
    try {
      await reglerVersion(version.id, {
        manettes: reglages.map((m) => ({ id: m.id, actif: m.actif, min: Number(m.min), max: Number(m.max) })),
        compteurs: compteurs.map((c) => ({ id: c.id, actif: c.actif })),
      });
      prendre(await envoyerVersion(version.id));
      setEtape(4);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const titre = version ? `${version.modele.nom} — version ${version.numero}` : 'Déposer un modèle';
  let corps: ReactNode = null;
  let pied: ReactNode = null;
  let boutons: ReactNode = null;

  if (etape === 1) {
    corps = (
      <div className="px-6 py-5">
        <ZoneDepot id="paquet" label="Paquet du modèle (.zip, format « dnpec-modele/1 »)" fichiers={fichiers} onChange={setFichiers} accept=".zip,application/zip" aide="Fichier .zip · 50 Mo au plus · contrôlé avant tout enregistrement" />
        <div className="rounded-[10px] border border-line bg-[#FBFBFD] px-3.5 pt-3">
          <Case id="donnees-confirmees" checked={confirme} onChange={setConfirme} label={<span className="font-semibold text-ink-900">Je confirme que les données de ce paquet sont publiées ou autorisées pour cet hébergement</span>} />
          <p className="pb-3 pl-[26px] text-[12.5px] text-text-muted">Tant que l’hébergement en Guinée n’est pas décidé, seules des données déjà publiées ou fictives peuvent être chargées. Votre confirmation est tracée dans le journal d’audit.</p>
        </div>
      </div>
    );
    pied = 'Le paquet est contrôlé avant tout enregistrement : un zip piégé ou une fiche non conforme est refusé.';
    boutons = (
      <>
        <button type="button" className={BTN_SECONDAIRE} onClick={onClose}>
          Annuler
        </button>
        <button type="button" className={BTN_PRINCIPAL} disabled={enCours} onClick={deposer}>
          {enCours ? 'Envoi…' : 'Déposer et vérifier'} <ChevronRight aria-hidden size={16} />
        </button>
      </>
    );
  } else if (etape === 2 && version) {
    const v = version.verification;
    const bloquants = version.resume.echecs;
    corps = (
      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 px-6 py-5">
          <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-3">
            <span aria-hidden className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[7px] bg-ink text-[10.5px] font-extrabold text-white">
              ZIP
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-ink-900">{version.nomFichier}</div>
              <div className="text-[12.5px] text-text-muted">
                {taillePaquet(version.tailleOctets)} · déposé à {heureDepot(version.deposeLe)} · empreinte {empreinteCourte(version.empreinte)}
              </div>
            </div>
          </div>
          {version.statut === 'DEPOSEE' ? (
            v?.statut === 'ECHEC' ? (
              <div role="alert" data-testid="verification-echec" className="rounded-[10px] border border-[#E7B3BB] bg-clay-50 px-3.5 py-3 text-[13.5px]">
                <div className="font-bold text-clay">La vérification n’a pas abouti.</div>
                <div className="mt-1 text-text">{v.message}</div>
                {version.droits.peutRelancerVerification && (
                  <button type="button" className={`${BTN_SECONDAIRE} mt-3`} onClick={relancer}>
                    Relancer la vérification
                  </button>
                )}
              </div>
            ) : (
              <div role="status" data-testid="verification-en-cours" className="flex items-start gap-3 rounded-[10px] border border-line bg-[#FBFBFD] px-3.5 py-3.5 text-[13.5px]">
                <LoaderCircle aria-hidden size={20} className="mt-0.5 flex-none animate-spin text-ink" />
                <div>
                  <div className="font-bold text-ink-900">{v?.etape === 'CALCUL' ? 'Calcul en cours…' : 'Réveil du service de calcul…'}</div>
                  <div className="text-text-muted">
                    {v?.etape === 'CALCUL'
                      ? 'Le service de calcul lance les contrôles du paquet (réplication, homogénéité…).'
                      : 'Le service de calcul s’endort après 15 minutes sans travail ; il redémarre en une minute environ.'}
                    {v && v.tentatives > 1 && v.message ? ` Nouvel essai (${v.tentatives}) : ${v.message}` : ''}
                  </div>
                </div>
              </div>
            )
          ) : (
            <ListeControles controles={version.controles} />
          )}
        </div>
        <aside className="border-t border-line bg-[#FBFBFD] px-5 py-5 lg:border-l lg:border-t-0" aria-label="Lu dans le paquet">
          <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-text-muted">Lu dans le paquet</h3>
          <dl className="divide-y divide-[#EEF0F5] text-[13px]">
            {(
              [
                ['Famille', version.lu.famille],
                ['Moteur', version.lu.moteur ?? '—'],
                ['Base', version.lu.base ?? '—'],
                ['Horizon', version.lu.horizon ?? '—'],
                ['Manettes proposées', String(version.lu.manettes)],
                ['Compteurs proposés', String(version.lu.compteurs)],
              ] as const
            ).map(([c, val]) => (
              <div key={c} className="flex justify-between gap-3 py-[7px]">
                <dt className="text-text-muted">{c}</dt>
                <dd className="text-right font-bold text-ink-900">{val}</dd>
              </div>
            ))}
          </dl>
          {version.statut !== 'DEPOSEE' && (
            <p className="mt-4 text-[13px] leading-snug text-text-muted">
              {bloquants === 0
                ? `Aucun contrôle bloquant en échec.${version.resume.alertes ? ` ${version.resume.alertes > 1 ? 'Les alertes seront visibles' : 'L’alerte sera visible'} du responsable du modèle au moment de l’approbation.` : ''}`
                : `${bloquants} contrôle(s) bloquant(s) en échec : le responsable du modèle pourra demander une dérogation motivée, que l’administrateur confirmera.`}
            </p>
          )}
        </aside>
      </div>
    );
    pied = 'Les contrôles sont relancés à chaque nouvelle version.';
    boutons = (
      <>
        <button type="button" className={BTN_SECONDAIRE} onClick={onClose}>
          Fermer
        </button>
        <button type="button" className={BTN_PRINCIPAL} disabled={version.statut !== 'CONTROLEE'} onClick={() => setEtape(3)}>
          Continuer <ChevronRight aria-hidden size={16} />
        </button>
      </>
    );
  } else if (etape === 3 && version) {
    const changer = (id: string, champ: 'actif' | 'min' | 'max', valeur: boolean | number) => setReglages((l) => l.map((m) => (m.id === id ? { ...m, [champ]: valeur } : m)));
    corps = (
      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 px-6 py-5">
          <h3 className="mb-2 text-[14px] font-bold text-ink-900">
            Manettes <span className="font-normal text-text-muted">ce que les analystes pourront faire varier</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]" data-testid="tableau-manettes">
              <thead>
                <tr className="bg-[#F4F5F9] text-[12px] font-semibold text-text-muted">
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">Proposée</span>
                  </th>
                  <th scope="col" className="px-2 py-2">Manette</th>
                  <th scope="col" className="px-2 py-2">Détail</th>
                  <th scope="col" className="px-2 py-2">Minimum</th>
                  <th scope="col" className="px-2 py-2">Maximum</th>
                </tr>
              </thead>
              <tbody>
                {reglages.map((m) => (
                  <tr key={m.id} className="border-b border-[#EEF0F5]" data-testid="manette">
                    <td className="px-2 py-2">
                      <input type="checkbox" aria-label={`Proposer « ${m.libelle} » aux analystes`} checked={m.actif} onChange={(e) => changer(m.id, 'actif', e.target.checked)} className="h-4 w-4 accent-sage" />
                    </td>
                    <td className="px-2 py-2 font-bold text-ink-900">{m.libelle}</td>
                    <td className="px-2 py-2 text-text-muted">{m.detail ?? (m.type === 'hypothese' ? 'hypothèse' : '—')}</td>
                    {(['min', 'max'] as const).map((b) => (
                      <td key={b} className="px-2 py-2">
                        <label className="inline-flex items-center gap-1 rounded-[7px] border border-line px-2 py-1">
                          <span className="sr-only">
                            {b === 'min' ? 'Minimum' : 'Maximum'} de « {m.libelle} » (entre {m.minPaquet} et {m.maxPaquet})
                          </span>
                          <input type="number" step="any" min={m.minPaquet} max={m.maxPaquet} value={m[b]} disabled={!m.actif} onChange={(e) => changer(m.id, b, e.target.value === '' ? Number.NaN : Number(e.target.value))} className="w-14 bg-transparent text-right font-bold text-ink-900 outline-none disabled:text-text-muted" />
                          <span className="text-[12px] font-bold text-ink-900">{m.unite === '%' ? '%' : m.unite?.startsWith('%') ? 'pts' : ''}</span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="border-t border-line px-5 py-5 lg:border-l lg:border-t-0" aria-label="Compteurs">
          <h3 className="mb-2 text-[14px] font-bold text-ink-900">
            Compteurs <span className="font-normal text-text-muted">ce qu’on lira</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {compteurs.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.actif}
                onClick={() => setCompteurs((l) => l.map((x) => (x.id === c.id ? { ...x, actif: !x.actif } : x)))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold ${c.actif ? 'border-[#C9D3F0] bg-ink-50 text-ink' : 'border-line bg-surface text-text-muted line-through'}`}
              >
                {c.actif && <Check aria-hidden size={13} strokeWidth={3} />}
                {c.libelle}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-snug text-text-muted">Pré-remplis à partir de la fiche du modèle. Vous pouvez décocher une manette ou resserrer ses bornes ; le responsable du modèle verra vos choix avant d’approuver.</p>
        </aside>
      </div>
    );
    pied = 'Une valeur hors bornes sera refusée au lancement d’une simulation.';
    boutons = (
      <>
        <button type="button" className={BTN_SECONDAIRE} onClick={() => setEtape(2)}>
          Retour
        </button>
        <button type="button" className={BTN_PRINCIPAL} disabled={enCours} onClick={envoyer}>
          {enCours ? 'Envoi…' : 'Envoyer au responsable'} <ChevronRight aria-hidden size={16} />
        </button>
      </>
    );
  } else if (etape === 4 && version) {
    const g = fiche?.gouvernance;
    corps = (
      <div className="px-6 py-6 text-[14px]" data-testid="envoi-termine">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-sage text-white">
            <Check aria-hidden size={18} strokeWidth={3} />
          </span>
          <div className="font-heading text-[17px] font-bold text-ink-900">Version {version.numero} envoyée au responsable du modèle</div>
        </div>
        <p className="text-text-muted">
          {g?.responsable
            ? `${g.responsable.nom}${g.suppleant ? ` et ${g.suppleant.nom} (suppléant)` : ''} sont prévenus. L’approbation revient au responsable — au suppléant si le responsable a lui-même déposé la version.`
            : 'Le responsable du modèle n’est pas encore désigné : il sera prévenu dès sa désignation (par l’administrateur, le DN ou la DNA, depuis la fiche du modèle).'}
        </p>
        <p className="mt-2 text-text-muted">Vous ne pouvez pas approuver ni activer vous-même cette version.</p>
      </div>
    );
    boutons = (
      <>
        <button type="button" className={BTN_SECONDAIRE} onClick={onClose}>
          Fermer
        </button>
        <button type="button" className={BTN_PRINCIPAL} onClick={() => onTermine(version.modele.id)}>
          Voir la fiche du modèle <ChevronRight aria-hidden size={16} />
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boite} role="dialog" aria-modal="true" aria-labelledby={idTitre} data-testid="fenetre-depot" className="flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_24px_60px_rgba(18,28,77,0.35)] sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-start gap-4 border-b border-line px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <nav aria-label="Fil d’Ariane" className="mb-1 flex items-center gap-2 text-[13px] text-text-muted">
              <span>Modèles</span>
              <ChevronRight aria-hidden size={14} />
              <span>Déposer un modèle</span>
            </nav>
            <h2 id={idTitre} tabIndex={-1} className="font-heading text-[21px] font-extrabold leading-tight text-ink-900 outline-none">
              {titre}
            </h2>
            <Etapes courante={etape} />
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-line text-text-muted hover:bg-bg">
            <X aria-hidden size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{corps}</div>
        <div className="border-t border-line bg-[#FBFBFD] px-6 py-3.5">
          {erreur && (
            <div role="alert" data-testid="erreur-formulaire" className="mb-3 rounded-[9px] border border-[#F0C5CC] bg-clay-50 px-3 py-2.5 text-[13px] font-semibold text-clay">
              {erreur}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-muted">{pied}</div>
            <div className="flex flex-none justify-end gap-2.5">{boutons}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

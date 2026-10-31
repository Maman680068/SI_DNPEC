'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fixerCapacite,
  getCapacites,
  getModeleAttestation,
  getPlanning,
  importerModeleAttestation,
  telechargerApercuModele,
  telechargerModele,
  verifierModeleAttestation,
} from '../../../../lib/api/stages';
import type { Capacites, ModeleAttestation, Planning, VerificationModele } from '../../../../lib/stages/types';
import { ZoneDepot } from '../../../../components/ui/Formulaire';
import { SquelettePage } from '../../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../../components/ui/Toast';
import { FenetreNouveauStage } from '../../../../components/stages/FenetresStage';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { Check, ChevronLeft, Copy, Plus } from 'lucide-react';
import { BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage, EtatVide, Interrupteur, LigneTableau, Pastille, Tableau, usePreference } from '../../../../components/ui/Charte';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const MOIS = 6;

/**
 * Réglages des stages (S9e) : capacités d'accueil en tableau (occupation du jour calculée par l'API, limite
 * modifiable sur la ligne), planning visuel sur six mois (DRH et Direction ; jamais l'administrateur), modèle
 * d'attestation (aperçu avec un stagiaire fictif, champs copiables, contrôle avant activation, historique).
 */
export default function ParametresStagesPage() {
  const [modele, setModele] = useState<ModeleAttestation | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [reglages, setReglages] = useState<Capacites | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);
  const [nouveauStagiaire, setNouveauStagiaire] = useState(false);

  const charger = useCallback(() => {
    getModeleAttestation().then(setModele).catch((e) => setErreurChargement(messageChargement(e)));
    // Capacités seules (DRH et administrateur système) ; le planning, qui montre
    // des stagiaires, seulement si l'API dit qu'il est visible (jamais pour l'admin).
    getCapacites()
      .then((r) => {
        setReglages(r);
        if (r.voitPlanning) {
          const debut = new Date();
          debut.setUTCDate(1);
          const fin = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + MOIS, 0));
          getPlanning(debut.toISOString().slice(0, 10), fin.toISOString().slice(0, 10)).then(setPlanning).catch((e) => setErreurChargement(messageChargement(e)));
        }
      })
      .catch((e) => setErreurChargement(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  async function agir(fn: () => Promise<unknown>, ok?: { titre: string; detail?: string; annuler?: () => void }): Promise<boolean> {
    setEnCours(true);
    try {
      await fn();
      if (ok) toast.succes(ok.titre, { detail: ok.detail, annuler: ok.annuler });
      charger();
      return true;
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e, 'Action impossible'));
      return false;
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="max-w-[1100px]">
      {reglages?.voitPlanning && (
        <Link href="/stages" className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
          <ChevronLeft aria-hidden size={15} /> Stagiaires
        </Link>
      )}
      <EnTetePage
        titre={reglages && !reglages.voitPlanning ? 'Réglages des stages' : 'Planning, capacités et modèle d’attestation'}
        actions={
          reglages?.peutCreerNouveauStagiaire ? (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouveauStagiaire(true)}>
              <Plus aria-hidden size={17} /> Nouveau stagiaire (créer le compte)
            </button>
          ) : undefined
        }
      />
      {nouveauStagiaire && (
        <FenetreNouveauStage
          seulementNouveau
          onClose={() => setNouveauStagiaire(false)}
          onCreated={(_s, email) => {
            setNouveauStagiaire(false);
            toast.succes('Compte et stage créés', { detail: `Le stagiaire reçoit à ${email} le lien pour choisir son mot de passe. Le DRH organise ensuite son stage.` });
          }}
        />
      )}
      <ErreurChargement message={erreurChargement} />
      {!reglages && !erreurChargement && <SquelettePage />}

      {reglages && <CapacitesAccueil reglages={reglages} enCours={enCours} agir={agir} />}
      {reglages?.voitPlanning && <PlanningVisuel planning={planning} />}
      {modele && <ModeleAttestationPanneau modele={modele} enCours={enCours} agir={agir} />}
    </div>
  );
}

type Agir = (fn: () => Promise<unknown>, ok?: { titre: string; detail?: string; annuler?: () => void }) => Promise<boolean>;
const GRILLE_CAP = 'lg:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)]';

/** Capacités d'accueil : une ligne par unité ; par défaut, celles qui ont une limite ou des stagiaires aujourd'hui. */
function CapacitesAccueil({ reglages, enCours, agir }: { reglages: Capacites; enCours: boolean; agir: Agir }) {
  const [toutes, setToutes] = usePreference('stages.toutesUnites', false);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const lignes = reglages.unites.filter((u) => toutes || u.maximum !== null || u.occupation > 0);
  const remettre = (uniteKey: string, avant: number | null) => () => void agir(() => fixerCapacite(uniteKey, avant));
  return (
    <section className="mb-4" data-testid="capacites" aria-labelledby="titre-capacites">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="titre-capacites" className="font-heading text-[15.5px] font-bold text-ink-900">
            Capacités d’accueil
          </h2>
          <p className="text-[12.5px] text-text-muted">Nombre maximal de stagiaires simultanés ; au-delà, une période est refusée. Une période en section compte aussi pour sa division.</p>
        </div>
        <Interrupteur label="Afficher toutes les unités" actif={toutes} onChange={setToutes} testid="toutes-unites" />
      </div>
      <Tableau
        label="Capacités d’accueil"
        grille={GRILLE_CAP}
        colonnes={['Sigle', 'Unité', 'Aujourd’hui', 'Limite']}
        vide={<EtatVide texte="Aucune unité n’a de limite ni de stagiaire aujourd’hui. « Afficher toutes les unités » pour en fixer une." />}
      >
        {lignes.map((u) => {
          const saisie = saisies[u.uniteKey] ?? (u.maximum === null ? '' : String(u.maximum));
          const change = saisie !== (u.maximum === null ? '' : String(u.maximum));
          return (
            <LigneTableau key={u.uniteKey} grille={GRILLE_CAP} testid="capacite">
              <b className={`font-heading text-[13px] ${u.niveau === 'SECTION' ? 'pl-3 font-semibold' : ''}`}>{u.sigle}</b>
              <span className="text-[13px]">{u.nom}</span>
              <span className="flex items-center gap-2" data-testid="occupation">
                {u.maximum !== null ? (
                  <span aria-hidden className="h-2 w-24 overflow-hidden rounded-full bg-fond-gris">
                    <span className={`block h-full ${u.complet ? 'bg-clay' : 'bg-sage'}`} style={{ width: `${Math.min(100, u.maximum ? (u.occupation / u.maximum) * 100 : 100)}%` }} />
                  </span>
                ) : null}
                <span className="text-[13px] font-semibold">{u.maximum !== null ? `${u.occupation} / ${u.maximum}` : `${u.occupation} stagiaire(s)`}</span>
                {u.complet && <Pastille ton="rouge">complet</Pastille>}
              </span>
              {reglages.peutModifier ? (
                <form
                  className="flex flex-wrap items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (saisie === '') return;
                    void agir(() => fixerCapacite(u.uniteKey, Number(saisie)), { titre: 'Capacité enregistrée', detail: `${u.sigle} : ${saisie} stagiaire(s) simultané(s) au plus.`, annuler: remettre(u.uniteKey, u.maximum) }).then(() =>
                      setSaisies((s) => {
                        const n = { ...s };
                        delete n[u.uniteKey];
                        return n;
                      }),
                    );
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={saisie}
                    placeholder="Sans limite"
                    aria-label={`Limite — ${u.sigle}`}
                    onChange={(e) => setSaisies((s) => ({ ...s, [u.uniteKey]: e.target.value }))}
                    className="h-[30px] w-[92px] rounded-[7px] border border-line bg-surface px-2 text-[13px]"
                  />
                  {change && saisie !== '' && (
                    <button type="submit" className={BTN_LIGNE} disabled={enCours}>
                      Enregistrer
                    </button>
                  )}
                  {u.maximum !== null && (
                    <button type="button" className={BTN_LIGNE} disabled={enCours} onClick={() => void agir(() => fixerCapacite(u.uniteKey, null), { titre: 'Limite retirée', detail: u.nom, annuler: remettre(u.uniteKey, u.maximum) })}>
                      Sans limite
                    </button>
                  )}
                </form>
              ) : (
                <span className="text-[13px]">{u.maximum ?? 'Sans limite'}</span>
              )}
            </LigneTableau>
          );
        })}
      </Tableau>
    </section>
  );
}

const PREVU = ['PROPOSEE', 'ACCEPTEE'];

/** Planning visuel sur six mois : une ligne par unité, une barre par période ; trait d'aujourd'hui ; clic → le stage. */
function PlanningVisuel({ planning }: { planning: Planning | null }) {
  const parUnite = useMemo(() => {
    const m = new Map<string, { libelle: string; periodes: Planning['periodes'] }>();
    for (const p of planning?.periodes ?? []) {
      const e = m.get(p.uniteKey) ?? { libelle: p.unite, periodes: [] };
      e.periodes.push(p);
      m.set(p.uniteKey, e);
    }
    return [...m.entries()];
  }, [planning]);
  if (!planning) return <section className="mb-4" data-testid="planning" />;
  const d0 = new Date(planning.debut).getTime();
  const d1 = new Date(planning.fin).getTime() + 864e5;
  const pos = (iso: string) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - d0) / (d1 - d0)) * 100));
  const mois = Array.from({ length: MOIS }, (_, i) => {
    const d = new Date(d0);
    d.setUTCMonth(d.getUTCMonth() + i);
    return { label: d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }), gauche: pos(d.toISOString()) };
  });
  const aujourdhui = pos(new Date().toISOString());
  return (
    <section className="mb-4 rounded-xl border border-line bg-surface px-[18px] py-4" data-testid="planning" aria-labelledby="titre-planning">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="titre-planning" className="font-heading text-[15.5px] font-bold text-ink-900">
          Planning du {date(planning.debut)} au {date(planning.fin)}
        </h2>
        <span className="flex items-center gap-3 text-[12px] text-text-muted">
          <span className="inline-flex items-center gap-1"><i aria-hidden className="h-2.5 w-4 rounded-sm bg-sage" /> En cours</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden className="h-2.5 w-4 rounded-sm border border-dashed border-ink bg-ink-50" /> Prévu</span>
        </span>
      </div>
      {parUnite.length === 0 ? (
        <p className="text-[13px] text-text-faint">Aucune période sur ces six mois.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="relative ml-[180px] h-5 border-b border-line text-[11.5px] text-text-muted">
              {mois.map((m) => (
                <span key={m.label + m.gauche} className="absolute top-0 border-l border-line pl-1" style={{ left: `${m.gauche}%` }}>
                  {m.label}
                </span>
              ))}
            </div>
            {parUnite.map(([k, u]) => (
              <div key={k} className="flex border-b border-line-doux py-1.5 last:border-b-0" data-testid="planning-unite">
                <div className="w-[180px] flex-none pr-2 text-[12.5px] font-semibold">
                  {u.libelle}
                  {planning.capacites.find((c) => c.uniteKey === k) && <span className="block font-normal text-text-muted">maximum {planning.capacites.find((c) => c.uniteKey === k)!.maximum}</span>}
                </div>
                <div className="relative min-h-[26px] flex-1" style={{ height: `${u.periodes.length * 24 + 2}px` }}>
                  <span aria-hidden className="absolute bottom-0 top-0 w-px bg-clay" style={{ left: `${aujourdhui}%` }} data-testid="trait-aujourdhui" />
                  {u.periodes.map((p, i) => {
                    const prevu = PREVU.includes(p.statut);
                    return (
                      <Link
                        key={p.id}
                        href={`/stages/${p.stageId}`}
                        title={`${p.stagiaire.firstName} ${p.stagiaire.lastName} — ${date(p.dateDebut)} → ${date(p.dateFin)}`}
                        data-testid="barre-periode"
                        className={`absolute h-[20px] truncate rounded-[5px] px-1.5 text-[11.5px] font-semibold leading-[20px] hover:underline ${prevu ? 'border border-dashed border-ink bg-ink-50 text-ink' : 'bg-sage text-white'}`}
                        style={{ top: `${i * 24}px`, left: `${pos(p.dateDebut)}%`, width: `${Math.max(2, pos(p.dateFin) + 100 / ((d1 - d0) / 864e5) - pos(p.dateDebut))}%` }}
                      >
                        {p.stagiaire.firstName} {p.stagiaire.lastName}
                        <span className="sr-only"> ({prevu ? 'prévu' : 'en cours'})</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Modèle d'attestation : fichier actif, aperçu fictif, champs copiables, remplacement contrôlé, historique. */
function ModeleAttestationPanneau({ modele, enCours, agir }: { modele: ModeleAttestation; enCours: boolean; agir: Agir }) {
  const toast = useToast();
  const [fichier, setFichier] = useState<File[]>([]);
  const [verif, setVerif] = useState<VerificationModele | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  useEffect(() => {
    setVerif(null);
    const f = fichier[0];
    if (!f) return;
    let actuel = true;
    verifierModeleAttestation(f)
      .then((v) => actuel && setVerif(v))
      .catch((e) => actuel && toast.erreur('Contrôle impossible', messageErreur(e)));
    return () => {
      actuel = false;
    };
  }, [fichier, toast]);
  function copier(cle: string) {
    // Presse-papiers refusé ou indisponible : le champ reste lisible à l'écran.
    navigator.clipboard?.writeText(`{{${cle}}}`).catch(() => undefined);
    setCopie(cle);
    setTimeout(() => setCopie((c) => (c === cle ? null : c)), 1500);
  }
  const m = modele.modele;
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface px-[18px] py-4" data-testid="modele" aria-labelledby="titre-modele">
      <h2 id="titre-modele" className="mb-2 font-heading text-[15.5px] font-bold text-ink-900">
        Modèle d’attestation
      </h2>
      <div className="mb-3 rounded-[10px] border border-line bg-bg px-3.5 py-3">
        {m ? (
          <p className="text-[13px]">
            Modèle actif : <strong>{m.fileName}</strong> ({m.type === 'DOCX' ? 'Word' : 'PDF à champs'}),{' '}
            {m.parDefaut ? 'modèle par défaut de la DNPEC, fourni avec l’application' : `importé le ${date(m.createdAt)}${m.importePar ? ` par ${m.importePar.firstName} ${m.importePar.lastName}` : ''}`} — champs utilisés : {m.champs.join(', ')}.
          </p>
        ) : (
          <p className="text-[13px] text-text-muted">Aucun modèle importé : les attestations utilisent la mise en page standard.</p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {m && (
            <button type="button" className={BTN_SECONDAIRE} disabled={enCours} onClick={() => void agir(() => telechargerModele(), { titre: 'Modèle téléchargé' })}>
              Télécharger
            </button>
          )}
          <button type="button" className={BTN_SECONDAIRE} disabled={enCours} onClick={() => void agir(() => telechargerApercuModele(), { titre: 'Aperçu téléchargé', detail: 'Stagiaire fictif, sans numéro : aucune séquence n’est consommée.' })}>
            Aperçu avec un stagiaire fictif
          </button>
        </div>
      </div>

      <h3 className="mb-1 text-[13.5px] font-bold">Champs disponibles ({modele.champsDisponibles.length})</h3>
      <p className="mb-2 text-[12.5px] text-text-muted">
        Cliquez un champ pour le copier. Dans Word, collez-le tel quel (entre doubles accolades) ; dans un PDF, nommez le champ de formulaire exactement comme la clé.
      </p>
      <ul className="mb-4 flex flex-wrap gap-1.5" aria-label="Champs disponibles">
        {modele.champsDisponibles.map((c) => (
          <li key={c.cle}>
            <button type="button" title={c.description} onClick={() => copier(c.cle)} data-testid="champ-modele" className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[12px] hover:bg-bg">
              {copie === c.cle ? <Check aria-hidden size={13} /> : <Copy aria-hidden size={13} />}
              {`{{${c.cle}}}`}
              <span className="sr-only"> — {copie === c.cle ? 'copié' : c.description}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="mb-1 text-[13.5px] font-bold">Remplacer le modèle</h3>
      <form
        className="mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = fichier[0];
          if (f && verif?.valide) void agir(() => importerModeleAttestation(f), { titre: 'Modèle importé', detail: `${f.name} sert désormais aux attestations ; l’ancien est conservé dans l’historique.` }).then((ok) => ok && setFichier([]));
        }}
      >
        <ZoneDepot id="mod-fichier" label="Remplacer le modèle (.docx, ou .pdf à champs)" accept=".docx,.pdf" aide="Word (.docx) ou PDF à champs · 25 Mo au plus · contrôlé avant activation" fichiers={fichier} onChange={setFichier} />
        {verif && (
          <div role="status" data-testid="verification-modele" className={`mb-3 rounded-[10px] border px-3 py-2 text-[12.5px] ${verif.valide ? 'border-sage-bord bg-sage-50' : 'border-clay-bord bg-clay-50 text-clay'}`}>
            <b>{verif.message}</b>
            {verif.champs.length > 0 && <span className="block">Champs reconnus : {verif.champs.join(', ')}.</span>}
            {verif.valide && verif.absents.length > 0 && <span className="block text-text-muted">Non utilisés : {verif.absents.join(', ')}.</span>}
          </div>
        )}
        <button type="submit" className={BTN_PRINCIPAL} disabled={enCours || !fichier.length || !verif?.valide}>
          Activer ce modèle
        </button>
      </form>

      {modele.historique.length > 0 && (
        <details className="mt-3" data-testid="historique-modeles">
          <summary className="cursor-pointer text-[13px] font-semibold">Modèles précédents ({modele.historique.length})</summary>
          <ul className="mt-2 text-[12.5px] text-text-muted">
            {modele.historique.map((h) => (
              <li key={h.id} className="border-t border-line py-1.5">
                {h.fileName} ({h.type === 'DOCX' ? 'Word' : 'PDF'}) — {h.parDefaut ? 'modèle par défaut' : `importé le ${date(h.createdAt)}${h.importePar ? ` par ${h.importePar.firstName} ${h.importePar.lastName}` : ''}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

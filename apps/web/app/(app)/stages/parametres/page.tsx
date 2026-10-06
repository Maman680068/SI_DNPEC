'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fixerCapacite, getCapacites, getModeleAttestation, getPlanning, importerModeleAttestation, telechargerModele } from '../../../../lib/api/stages';
import type { Capacites, ModeleAttestation, Planning } from '../../../../lib/stages/types';
import { PERIODE_STATUT_LABEL } from '../../../../lib/stages/types';
import { Saisie, ZoneDepot } from '../../../../components/ui/Formulaire';
import { SquelettePage } from '../../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../../components/ui/Toast';
import { ChoixUnite, FenetreNouveauStage } from '../../../../components/stages/FenetresStage';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { ChevronLeft, Plus } from 'lucide-react';
import { BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage } from '../../../../components/ui/Charte';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const cle = (u: { divisionId: string | null; sectionId: string | null; celluleId: string | null }) =>
  u.sectionId ? `SEC:${u.sectionId}` : u.divisionId ? `DIV:${u.divisionId}` : u.celluleId ? `CEL:${u.celluleId}` : '';

/** DRH : modèle d'attestation, capacités d'accueil et planning des stagiaires. */
export default function ParametresStagesPage() {
  const [modele, setModele] = useState<ModeleAttestation | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [reglages, setReglages] = useState<Capacites | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File[]>([]);
  const [unite, setUnite] = useState({ divisionId: null as string | null, sectionId: null as string | null, celluleId: null as string | null });
  const [maximum, setMaximum] = useState('');
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
        if (r.voitPlanning) getPlanning().then(setPlanning).catch((e) => setErreurChargement(messageChargement(e)));
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
  /** Remet la capacité précédente d'une unité (même route que la modification). */
  const remettre = (uniteKey: string) => {
    const avant = reglages?.capacites.find((c) => c.uniteKey === uniteKey)?.maximum ?? null;
    return () => void agir(() => fixerCapacite(uniteKey, avant));
  };

  const parUnite = useMemo(() => {
    const m = new Map<string, { libelle: string; periodes: Planning['periodes'] }>();
    for (const p of planning?.periodes ?? []) {
      const e = m.get(p.uniteKey) ?? { libelle: p.unite, periodes: [] };
      e.periodes.push(p);
      m.set(p.uniteKey, e);
    }
    return [...m.entries()];
  }, [planning]);

  return (
    <div className="max-w-[960px]">
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

      <section className="mb-4 rounded-xl border border-line bg-surface px-[18px] py-4" data-testid="modele">
        <h2 className="mb-2 font-heading text-[15.5px] font-bold text-ink-900">Modèle d’attestation</h2>
        {modele?.modele ? (
          <p className="mb-3 text-[13px]">
            Modèle actif : <strong>{modele.modele.fileName}</strong> ({modele.modele.type === 'DOCX' ? 'Word' : 'PDF à champs'}),{' '}
            {modele.modele.parDefaut
              ? 'modèle par défaut de la DNPEC, fourni avec l’application'
              : `importé le ${date(modele.modele.createdAt)}${modele.modele.importePar ? ` par ${modele.modele.importePar.firstName} ${modele.modele.importePar.lastName}` : ''}`}{' '}
            — champs utilisés : {modele.modele.champs.join(', ')}. Pour le remplacer, importez un autre modèle ci-dessous.{' '}
            <button type="button" className="font-semibold text-ink underline" onClick={() => void agir(() => telechargerModele(), { titre: 'Modèle téléchargé' })}>
              Télécharger
            </button>
          </p>
        ) : (
          <p className="mb-3 text-[13px] text-text-muted">Aucun modèle importé : les attestations utilisent la mise en page standard.</p>
        )}
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = fichier[0];
            if (f) void agir(() => importerModeleAttestation(f), { titre: 'Modèle importé', detail: `${f.name} sert désormais aux attestations.` }).then((ok) => ok && setFichier([]));
          }}
        >
          <div className="min-w-0 flex-1 basis-[300px]">
            <ZoneDepot id="mod-fichier" label="Nouveau modèle (.docx, ou .pdf à champs)" accept=".docx,.pdf" aide="Word (.docx) ou PDF à champs · 25 Mo au plus" fichiers={fichier} onChange={setFichier} />
          </div>
          <button type="submit" className={`${BTN_PRINCIPAL} mb-3.5`} disabled={enCours || !fichier.length}>
            Importer
          </button>
        </form>
        <details>
          <summary className="cursor-pointer text-[13px] font-semibold">Champs disponibles ({modele?.champsDisponibles.length ?? 0})</summary>
          <p className="my-2 text-[12.5px] text-text-muted">
            Dans Word, écrivez le champ entre doubles accolades, par exemple <code>{'{{NOM_COMPLET}}'}</code>. Dans un PDF, nommez le champ de formulaire exactement comme la clé.
          </p>
          <table className="w-full text-[12.5px]">
            <tbody>
              {modele?.champsDisponibles.map((c) => (
                <tr key={c.cle} className="border-t border-line">
                  <td className="py-1.5 pr-3 font-mono">{`{{${c.cle}}}`}</td>
                  <td className="py-1.5 text-text-muted">{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="mb-4 rounded-xl border border-line bg-surface px-[18px] py-4" data-testid="capacites">
        <h2 className="mb-2 font-heading text-[15.5px] font-bold text-ink-900">Capacités d’accueil</h2>
        <p className="mb-3 text-[12.5px] text-text-muted">Nombre maximal de stagiaires simultanés ; au-delà, une période est refusée. Une période en section compte aussi pour sa division.</p>
        {reglages && reglages.capacites.length > 0 && (
          <ul className="mb-3 text-[13px]">
            {reglages.capacites.map((c) => (
              <li key={c.uniteKey} className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-b-0">
                <span>
                  {c.libelle} : <strong>{c.maximum}</strong>
                </span>
                {reglages.peutModifier && (
                  <button type="button" className="text-[12.5px] font-semibold text-ink underline" onClick={() => void agir(() => fixerCapacite(c.uniteKey, null), { titre: 'Limite retirée', detail: c.libelle, annuler: remettre(c.uniteKey) })}>
                    Retirer la limite
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {reglages?.peutModifier && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void agir(() => fixerCapacite(cle(unite), Number(maximum)), { titre: 'Capacité enregistrée', detail: `Maximum : ${maximum} stagiaire(s) simultané(s).`, annuler: remettre(cle(unite)) });
            }}
          >
            <ChoixUnite value={unite} onChange={setUnite} />
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-32">
                <Saisie id="cap-max" label="Maximum" type="number" min={0} max={100} value={maximum} onChange={setMaximum} required />
              </div>
              <button type="submit" className={`${BTN_SECONDAIRE} mb-3.5`} disabled={enCours || !cle(unite) || maximum === ''}>
                Fixer la capacité
              </button>
            </div>
          </form>
        )}
      </section>

      {reglages?.voitPlanning && (
      <section className="mb-6" data-testid="planning">
        <h2 className="mb-2 font-heading text-[15.5px] font-bold text-ink-900">Planning {planning ? `du ${date(planning.debut)} au ${date(planning.fin)}` : ''}</h2>
        {parUnite.length === 0 ? (
          <p className="text-[13px] text-text-faint">Aucune période sur cette fenêtre.</p>
        ) : (
          parUnite.map(([k, u]) => (
            <div key={k} className="mb-3 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="mb-1.5 text-[13.5px] font-bold">
                {u.libelle}
                {planning?.capacites.find((c) => c.uniteKey === k) && <span className="ml-2 font-normal text-text-muted">(maximum {planning.capacites.find((c) => c.uniteKey === k)!.maximum})</span>}
              </div>
              <ul className="text-[12.5px]">
                {u.periodes.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-line py-1">
                    <Link href={`/stages/${p.stageId}`} className="font-semibold text-ink hover:underline">
                      {p.stagiaire.firstName} {p.stagiaire.lastName}
                    </Link>
                    <span className="text-text-muted">
                      {date(p.dateDebut)} → {date(p.dateFin)} — {PERIODE_STATUT_LABEL[p.statut]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      )}
    </div>
  );
}

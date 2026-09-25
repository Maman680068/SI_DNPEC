'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fixerCapacite, getModeleAttestation, getPlanning, importerModeleAttestation, telechargerModele } from '../../../../lib/api/stages';
import type { ModeleAttestation, Planning } from '../../../../lib/stages/types';
import { PERIODE_STATUT_LABEL } from '../../../../lib/stages/types';
import { Erreur, Libelle, SELECT_CLASS, messageErreur } from '../../../../components/courrier/ui';
import { ChoixUnite } from '../../../../components/stages/FenetresStage';
import { ErreurChargement, messageChargement } from '../../../../components/ui/ErreurChargement';
import { Button } from '../../../../components/ui/Button';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const cle = (u: { divisionId: string | null; sectionId: string | null; celluleId: string | null }) =>
  u.sectionId ? `SEC:${u.sectionId}` : u.divisionId ? `DIV:${u.divisionId}` : u.celluleId ? `CEL:${u.celluleId}` : '';

/** DRH : modèle d'attestation, capacités d'accueil et planning des stagiaires. */
export default function ParametresStagesPage() {
  const [modele, setModele] = useState<ModeleAttestation | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [unite, setUnite] = useState({ divisionId: null as string | null, sectionId: null as string | null, celluleId: null as string | null });
  const [maximum, setMaximum] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    getModeleAttestation().then(setModele).catch((e) => setErreurChargement(messageChargement(e)));
    getPlanning().then(setPlanning).catch((e) => setErreurChargement(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  async function agir(fn: () => Promise<unknown>, ok: string) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      setInfo(ok);
      charger();
    } catch (e) {
      setErreur(messageErreur(e, 'Action impossible'));
    } finally {
      setEnCours(false);
    }
  }

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
      <ErreurChargement message={erreurChargement} />
      <Link href="/stages" className="mb-4 inline-block text-[13px] text-accent">
        ← Stagiaires
      </Link>
      <h1 className="mb-5 text-[22px] font-extrabold">Planning, capacités et modèle d’attestation</h1>
      <Erreur message={erreur} />
      {info && <div className="mb-4 rounded-md bg-sage-soft px-3.5 py-3 text-[13px] text-sage">{info}</div>}

      <section className="mb-6 rounded-lg border border-line bg-surface p-4" data-testid="modele">
        <h2 className="mb-2 text-[15px] font-bold">Modèle d’attestation</h2>
        {modele?.modele ? (
          <p className="mb-3 text-[13px]">
            Modèle actif : <strong>{modele.modele.fileName}</strong> ({modele.modele.type === 'DOCX' ? 'Word' : 'PDF à champs'}), importé le {date(modele.modele.createdAt)} par{' '}
            {modele.modele.importePar.firstName} {modele.modele.importePar.lastName} — champs utilisés : {modele.modele.champs.join(', ')}.{' '}
            <button className="text-accent underline" onClick={() => agir(() => telechargerModele(), 'Modèle téléchargé.')}>
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
            if (fichier) void agir(() => importerModeleAttestation(fichier), 'Modèle importé.');
          }}
        >
          <div>
            <Libelle htmlFor="mod-fichier">Nouveau modèle (.docx, ou .pdf à champs)</Libelle>
            <input id="mod-fichier" type="file" accept=".docx,.pdf" className="block text-[13px]" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} required />
          </div>
          <Button type="submit" variant="gold" disabled={enCours || !fichier}>
            Importer
          </Button>
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

      <section className="mb-6 rounded-lg border border-line bg-surface p-4" data-testid="capacites">
        <h2 className="mb-2 text-[15px] font-bold">Capacités d’accueil</h2>
        <p className="mb-3 text-[12.5px] text-text-muted">Nombre maximal de stagiaires simultanés ; au-delà, une période est refusée. Une période en section compte aussi pour sa division.</p>
        {planning && planning.capacites.length > 0 && (
          <ul className="mb-3 text-[13px]">
            {planning.capacites.map((c) => (
              <li key={c.uniteKey} className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-b-0">
                <span>
                  {c.libelle} : <strong>{c.maximum}</strong>
                </span>
                {planning.peutFixerCapacites && (
                  <button className="text-[12.5px] text-accent underline" onClick={() => agir(() => fixerCapacite(c.uniteKey, null), 'Limite retirée.')}>
                    Retirer la limite
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {planning?.peutFixerCapacites && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void agir(() => fixerCapacite(cle(unite), Number(maximum)), 'Capacité enregistrée.');
            }}
          >
            <ChoixUnite value={unite} onChange={setUnite} />
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Libelle htmlFor="cap-max">Maximum</Libelle>
                <input id="cap-max" type="number" min={0} max={100} className={`${SELECT_CLASS} !w-28`} value={maximum} onChange={(e) => setMaximum(e.target.value)} required />
              </div>
              <Button type="submit" disabled={enCours || !cle(unite)}>
                Fixer la capacité
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="mb-6" data-testid="planning">
        <h2 className="mb-2 text-[15px] font-bold">Planning {planning ? `du ${date(planning.debut)} au ${date(planning.fin)}` : ''}</h2>
        {parUnite.length === 0 ? (
          <p className="text-[13px] text-text-faint">Aucune période sur cette fenêtre.</p>
        ) : (
          parUnite.map(([k, u]) => (
            <div key={k} className="mb-3 rounded-lg border border-line bg-surface p-3">
              <div className="mb-1.5 text-[13.5px] font-bold">
                {u.libelle}
                {planning?.capacites.find((c) => c.uniteKey === k) && <span className="ml-2 font-normal text-text-muted">(maximum {planning.capacites.find((c) => c.uniteKey === k)!.maximum})</span>}
              </div>
              <ul className="text-[12.5px]">
                {u.periodes.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-line py-1">
                    <Link href={`/stages/${p.stageId}`} className="text-accent">
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
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { lireJournalAudit, verifierJournalAudit } from '../../../lib/api/securite';
import type { PageAudit, VerificationAudit } from '../../../lib/securite/types';
import { ACTIONS_AUDIT } from '../../../lib/securite/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

const dateHeure = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Journal d'audit (socle N2) : lecture seule, portée fixée par l'API selon l'annexe 1 (toute la
 * Direction pour le DN, la DNA et l'administrateur ; son périmètre pour un responsable ; ses propres
 * actions pour les autres). Jamais le contenu des éléments : action, objet, auteur, date.
 */
export default function JournalAuditPage() {
  const [page, setPage] = useState<PageAudit | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [numero, setNumero] = useState(1);
  const [verif, setVerif] = useState<VerificationAudit | null>(null);

  const charger = useCallback(() => {
    lireJournalAudit({ ...filtres, page: numero, taille: 50 })
      .then((p) => {
        setPage(p);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [filtres, numero]);
  useEffect(charger, [charger]);

  const filtre = (k: string, v: string) => {
    setNumero(1);
    setFiltres((f) => ({ ...f, [k]: v }));
  };
  const verifier = () => verifierJournalAudit().then(setVerif).catch((e) => setErreur(messageChargement(e)));

  if (!page) return <Chargement erreur={erreur} />;
  const nbPages = Math.max(1, Math.ceil(page.total / page.taille));

  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Traçabilité</div>
          <h1 className="text-[22px] font-extrabold">Journal d’audit</h1>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Portée : <strong>{page.portee}</strong>. Le journal est en écriture seule : personne, administrateur compris, ne peut le modifier ni l’effacer.
          </p>
        </div>
        {page.droits.peutVerifier && (
          <Button onClick={verifier}>Vérifier l’intégrité</Button>
        )}
      </div>

      {verif && (
        <div role="status" data-testid="verification-audit" className={`mb-4 rounded-md px-4 py-3 text-[13px] ${verif.intacte ? 'bg-sage-soft text-sage' : 'bg-clay-soft text-clay'}`}>
          {verif.intacte
            ? `Chaîne intacte : ${verif.lignesVerifiees} entrées scellées vérifiées${verif.nonScellees ? `, ${verif.nonScellees} en attente de scellement (moins d’une minute)` : ''}.`
            : `Chaîne rompue à l’entrée n° ${verif.rangRompu} : le journal a été altéré en dehors de l’application.`}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2.5">
        <label className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
          Du
          <input type="date" aria-label="Du" value={filtres.du ?? ''} onChange={(e) => filtre('du', e.target.value)} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px]" />
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
          au
          <input type="date" aria-label="Au" value={filtres.au ?? ''} onChange={(e) => filtre('au', e.target.value)} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px]" />
        </label>
        <select aria-label="Type d’objet" value={filtres.entityType ?? ''} onChange={(e) => filtre('entityType', e.target.value)} className="max-w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">Tous les objets</option>
          {page.typesObjets.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select aria-label="Action" value={filtres.action ?? ''} onChange={(e) => filtre('action', e.target.value)} className="rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS_AUDIT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line bg-bg text-[11.5px] uppercase tracking-wide text-text-faint">
            <tr>
              <th scope="col" className="px-3 py-2">N°</th>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Auteur</th>
              <th scope="col" className="px-3 py-2">Action</th>
              <th scope="col" className="px-3 py-2">Objet</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Scellement</span></th>
            </tr>
          </thead>
          <tbody>
            {page.entrees.map((e) => (
              <tr key={e.id} data-testid="entree-audit" className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-mono text-[12px] text-text-muted">{e.numero}</td>
                <td className="whitespace-nowrap px-3 py-2">{dateHeure(e.date)}</td>
                <td className="px-3 py-2">
                  {e.acteur ? e.acteur.nom : <span className="text-text-muted">Système</span>}
                  {e.auNomDe && <div className="text-[11.5px] text-text-muted">par intérim, au nom de {e.auNomDe.nom}</div>}
                </td>
                <td className="px-3 py-2">{e.libelle}</td>
                <td className="px-3 py-2 text-text-muted">
                  {e.objetType} <span className="font-mono text-[11px]">{e.objetId.length > 14 ? `${e.objetId.slice(0, 12)}…` : e.objetId}</span>
                </td>
                <td className="px-3 py-2 text-right">{e.scellee ? <Badge tone="sage">SCELLÉE</Badge> : <Badge tone="muted">EN ATTENTE</Badge>}</td>
              </tr>
            ))}
            {page.entrees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  Aucune entrée pour ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12.5px] text-text-muted">
        <span>{page.total} entrée(s)</span>
        {nbPages > 1 && (
          <span className="flex items-center gap-2">
            <Button className="!px-2.5 !py-1" disabled={numero <= 1} onClick={() => setNumero((n) => n - 1)}>
              Précédent
            </Button>
            Page {numero} / {nbPages}
            <Button className="!px-2.5 !py-1" disabled={numero >= nbPages} onClick={() => setNumero((n) => n + 1)}>
              Suivant
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

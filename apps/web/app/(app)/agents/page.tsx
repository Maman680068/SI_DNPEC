'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAgent, getOrganigramme, getPointsDeReprise, listerAgents } from '../../../lib/api/socle';
import type { AgentDetail, PageAgents, PointsDeReprise, UniteOrganigramme } from '../../../lib/socle/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { AgentPanneau, FenetreNouvelAgent, TON_STATUT } from '../../../components/socle/Agents';

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

/**
 * Agents (socle NIMBA, §4 et §6) — DRH et gestionnaire RH : la personne
 * physique, distincte du compte, son matricule, son unité, son cycle de vie
 * et sa fin prévue (stage, contrat). Ouverture directe par ?id= (liens des
 * alertes de fin de stage).
 */
export default function AgentsPage() {
  const [page, setPage] = useState<PageAgents | null>(null);
  const [reprise, setReprise] = useState<PointsDeReprise | null>(null);
  const [unites, setUnites] = useState<UniteOrganigramme[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtres, setFiltres] = useState<Record<string, string>>({ statut: 'EN_ACTIVITE' });
  const [numero, setNumero] = useState(1);
  const [ouvert, setOuvert] = useState<AgentDetail | null>(null);
  const [nouvel, setNouvel] = useState(false);

  const charger = useCallback(() => {
    listerAgents({ ...filtres, page: numero, taille: 50 })
      .then((p) => {
        setPage(p);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [filtres, numero]);
  useEffect(charger, [charger]);

  const chargerReprise = useCallback(() => {
    getPointsDeReprise().then(setReprise).catch(() => setReprise(null));
  }, []);
  useEffect(() => {
    chargerReprise();
    getOrganigramme().then((o) => setUnites(o.unites.filter((u) => !u.fermee))).catch(() => undefined);
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) getAgent(id).then(setOuvert).catch((e) => setErreur(messageChargement(e)));
  }, [chargerReprise]);

  const ouvrir = (id: string) => getAgent(id).then(setOuvert).catch((e) => setErreur(messageChargement(e)));
  const apresAction = (a: AgentDetail) => {
    setOuvert(a);
    charger();
    chargerReprise();
  };
  const filtre = (k: string, v: string) => {
    setNumero(1);
    setFiltres((f) => ({ ...f, [k]: v }));
  };

  if (!page) return <Chargement erreur={erreur} />;
  const nbPages = Math.max(1, Math.ceil(page.total / page.taille));
  const points = reprise
    ? [
        reprise.matriculesProvisoires > 0 && { texte: `${reprise.matriculesProvisoires} matricule(s) provisoire(s) à remplacer`, action: () => filtre('matriculeProvisoire', 'true') },
        reprise.unitesSansResponsable.length > 0 && { texte: `${reprise.unitesSansResponsable.length} unité(s) sans responsable : ${reprise.unitesSansResponsable.map((u) => u.code).join(', ')}` },
        reprise.chefsEnDouble > 0 && { texte: `${reprise.chefsEnDouble} unité(s) avec deux chefs actifs` },
        reprise.agentsDansUniteSuspendue > 0 && { texte: `${reprise.agentsDansUniteSuspendue} agent(s) rattaché(s) à une unité suspendue` },
        reprise.stagiairesSansDateDeFin > 0 && { texte: `${reprise.stagiairesSansDateDeFin} stagiaire(s) sans date de fin` },
      ].filter(Boolean) as { texte: string; action?: () => void }[]
    : [];

  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
          <h1 className="text-[22px] font-extrabold">Agents</h1>
        </div>
        {page.droits.peutCreer && (
          <Button variant="gold" onClick={() => setNouvel(true)}>
            + Nouvel agent
          </Button>
        )}
      </div>

      {points.length > 0 && (
        <section aria-label="Reprise : points à traiter" className="mb-5 rounded-md border border-gold bg-gold-soft px-4 py-3">
          <h2 className="mb-1.5 text-[13.5px] font-bold text-ink">Reprise : points à traiter</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink">
            {points.map((p) => (
              <li key={p.texte}>
                {p.texte}
                {p.action && (
                  <button type="button" onClick={p.action} className="ml-2 font-semibold underline">
                    Afficher
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2.5">
        <input
          aria-label="Rechercher un agent"
          placeholder="Nom, prénom ou matricule…"
          value={filtres.recherche ?? ''}
          onChange={(e) => filtre('recherche', e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-line bg-surface px-3 py-2 text-[13px]"
        />
        <select aria-label="Statut" value={filtres.statut ?? ''} onChange={(e) => filtre('statut', e.target.value)} className="rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">Tous les statuts</option>
          <option value="EN_ACTIVITE">En activité</option>
          <option value="SUSPENDU">Suspendus</option>
          <option value="PARTI">Partis</option>
        </select>
        <select aria-label="Unité" value={filtres.uniteId ?? ''} onChange={(e) => filtre('uniteId', e.target.value)} className="max-w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">Toutes les unités</option>
          {unites.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.libelle}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
          <input type="checkbox" checked={filtres.finProche === 'true'} onChange={(e) => filtre('finProche', e.target.checked ? 'true' : '')} />
          Fin dans 15 jours
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
          <input type="checkbox" checked={filtres.matriculeProvisoire === 'true'} onChange={(e) => filtre('matriculeProvisoire', e.target.checked ? 'true' : '')} />
          Matricule provisoire
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-line bg-bg text-[11.5px] uppercase tracking-wide text-text-faint">
            <tr>
              <th scope="col" className="px-3 py-2">Matricule</th>
              <th scope="col" className="px-3 py-2">Agent</th>
              <th scope="col" className="px-3 py-2">Unité</th>
              <th scope="col" className="px-3 py-2">Statut</th>
              <th scope="col" className="px-3 py-2">Fin prévue</th>
            </tr>
          </thead>
          <tbody>
            {page.donnees.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0 hover:bg-bg">
                <td className="px-3 py-2 font-mono text-[12px]">
                  {a.matricule}
                  {a.matriculeProvisoire && <span className="ml-1.5 text-[10.5px] font-semibold text-clay">(provisoire)</span>}
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => ouvrir(a.id)} className="text-left font-semibold text-ink hover:underline">
                    {a.prenoms} {a.nom}
                  </button>
                  {a.fonction && <div className="text-[11.5px] text-text-muted">{a.fonction}</div>}
                </td>
                <td className="px-3 py-2">{a.unite ? a.unite.code : '—'}</td>
                <td className="px-3 py-2">
                  <Badge tone={TON_STATUT[a.statut]}>{a.libelleStatut.toUpperCase()}</Badge>
                </td>
                <td className="px-3 py-2">
                  {a.dateFinPrevue ? (
                    <span className={a.finProche ? 'font-semibold text-clay' : ''}>
                      {date(a.dateFinPrevue)} {a.natureFinPrevue === 'STAGE' ? '(stage)' : '(contrat)'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {page.donnees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  Aucun agent pour ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12.5px] text-text-muted">
        <span>{page.total} agent(s)</span>
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

      {ouvert && <AgentPanneau agent={ouvert} onClose={() => setOuvert(null)} onChange={apresAction} />}
      {nouvel && (
        <FenetreNouvelAgent
          unites={unites}
          onClose={() => setNouvel(false)}
          onFait={() => {
            setNouvel(false);
            charger();
            chargerReprise();
          }}
        />
      )}
    </div>
  );
}

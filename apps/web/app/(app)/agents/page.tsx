'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAgent, getOrganigramme, getPointsDeReprise, listerAgents } from '../../../lib/api/socle';
import type { AgentDetail, PageAgents, PointsDeReprise, UniteOrganigramme } from '../../../lib/socle/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { Plus } from 'lucide-react';
import { AgentPanneau, FenetreNouvelAgent, TON_PASTILLE } from '../../../components/socle/Agents';
import { BandeCompteurs, BarreOutils, BTN_LIGNE, BTN_PRINCIPAL, EnTetePage, EtatVide, FiltreSelect, Initiales, initialesDe, LigneTableau, Pastille, Recherche, Tableau } from '../../../components/ui/Charte';

const GRILLE = 'lg:grid-cols-[minmax(0,1.4fr)_150px_110px_130px_170px_70px]';
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
  // ?matriculeProvisoire=true : lien « Voir » du panneau Alertes RH des effectifs.
  const [filtres, setFiltres] = useState<Record<string, string>>((): Record<string, string> =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('matriculeProvisoire') === 'true'
      ? { statut: 'EN_ACTIVITE', matriculeProvisoire: 'true' }
      : { statut: 'EN_ACTIVITE' },
  );
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

  if (!page)
    return (
      <div>
        <EnTetePage titre="Agents" />
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} />
      </div>
    );
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
  const bascule = (k: string, actif: boolean, libelle: string) => (
    <button
      type="button"
      aria-pressed={actif}
      onClick={() => filtre(k, actif ? '' : 'true')}
      className={`h-9 rounded-[9px] border px-2.5 text-[13px] font-semibold ${actif ? 'border-ink bg-ink-50 text-ink' : 'border-line bg-surface text-text'}`}
    >
      {libelle}
    </button>
  );

  return (
    <div>
      <EnTetePage
        titre="Agents"
        sousTitre={`${page.total} agent(s)`}
        actions={
          page.droits.peutCreer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouvel(true)}>
              <Plus aria-hidden size={17} /> Nouvel agent
            </button>
          )
        }
      />
      <ErreurChargement message={erreur} />

      {reprise && (
        <BandeCompteurs
          label="Reprise des agents"
          items={[
            { valeur: page.total, label: 'Agents affichés', sous: filtres.statut === 'EN_ACTIVITE' ? 'en activité' : 'selon les filtres' },
            { valeur: reprise.matriculesProvisoires, label: 'Matricules provisoires', sous: 'à remplacer', ton: reprise.matriculesProvisoires ? 'rouge' : 'encre', onClick: () => filtre('matriculeProvisoire', filtres.matriculeProvisoire === 'true' ? '' : 'true'), actif: filtres.matriculeProvisoire === 'true' },
            { valeur: reprise.unitesSansResponsable.length, label: 'Unités sans responsable', sous: reprise.unitesSansResponsable.map((u) => u.code).slice(0, 4).join(', ') || 'aucune', ton: reprise.unitesSansResponsable.length ? 'ambre' : 'encre' },
            { valeur: reprise.stagiairesSansDateDeFin, label: 'Stagiaires sans date de fin', sous: 'fin prévue à renseigner', ton: reprise.stagiairesSansDateDeFin ? 'ambre' : 'encre' },
          ]}
        />
      )}

      {points.length > 0 && (
        <section aria-label="Reprise : points à traiter" className="mb-3.5 rounded-[10px] border border-[#F2D58A] bg-gold-50 px-3.5 py-2.5">
          <h2 className="mb-1 text-[13.5px] font-bold text-ink-900">Reprise : points à traiter</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-text">
            {points.map((p) => (
              <li key={p.texte}>
                {p.texte}
                {p.action && (
                  <button type="button" onClick={p.action} className="ml-2 font-semibold text-ink underline">
                    Afficher
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <BarreOutils>
        <Recherche value={filtres.recherche ?? ''} onChange={(v) => filtre('recherche', v)} placeholder="Nom, prénom ou matricule…" label="Rechercher un agent" />
        <FiltreSelect
          label="Statut"
          value={filtres.statut ?? ''}
          defaut="EN_ACTIVITE"
          onChange={(v) => filtre('statut', v)}
          options={[
            { value: '', label: 'Tous les statuts' },
            { value: 'EN_ACTIVITE', label: 'Statut : en activité' },
            { value: 'SUSPENDU', label: 'Statut : suspendus' },
            { value: 'PARTI', label: 'Statut : partis' },
          ]}
        />
        <FiltreSelect
          label="Unité"
          value={filtres.uniteId ?? ''}
          defaut=""
          onChange={(v) => filtre('uniteId', v)}
          options={[{ value: '', label: 'Toutes les unités' }, ...unites.map((u) => ({ value: u.id, label: `${u.code} — ${u.libelle}` }))]}
        />
        {bascule('finProche', filtres.finProche === 'true', 'Fin dans 15 jours')}
        {bascule('matriculeProvisoire', filtres.matriculeProvisoire === 'true', 'Matricule provisoire')}
      </BarreOutils>

      <Tableau
        label="Agents"
        testid="agents"
        grille={GRILLE}
        colonnes={['Agent', 'Matricule', 'Unité', 'Statut', 'Fin prévue', <span key="a" className="sr-only">Actions</span>]}
        vide={<EtatVide texte="Aucun agent pour ces critères." action={<button type="button" className={BTN_LIGNE} onClick={() => (setNumero(1), setFiltres({}))}>Effacer les filtres</button>} />}
        pied={
          <>
            <span>{page.total} agent(s)</span>
            {nbPages > 1 && (
              <span className="flex items-center gap-2">
                <button type="button" className={`${BTN_LIGNE} disabled:opacity-50`} disabled={numero <= 1} onClick={() => setNumero((n) => n - 1)}>
                  Précédent
                </button>
                Page {numero} / {nbPages}
                <button type="button" className={`${BTN_LIGNE} disabled:opacity-50`} disabled={numero >= nbPages} onClick={() => setNumero((n) => n + 1)}>
                  Suivant
                </button>
              </span>
            )}
          </>
        }
      >
        {page.donnees.map((a) => (
          <LigneTableau key={a.id} grille={GRILLE} testid="ligne-agent" label={`${a.prenoms} ${a.nom}`} onClick={() => ouvrir(a.id)} actif={ouvert?.id === a.id}>
            <span className="flex items-center gap-2.5">
              <Initiales texte={initialesDe(a.prenoms, a.nom)} />
              <span className="min-w-0">
                <b className="block truncate font-semibold text-ink-900">
                  {a.prenoms} {a.nom}
                </b>
                {a.fonction && <small className="block truncate text-[12px] text-text-muted">{a.fonction}</small>}
              </span>
            </span>
            <span className="font-mono text-[12.5px] text-text-muted">
              {a.matricule}
              {a.matriculeProvisoire && <span className="ml-1.5 font-sans text-[11.5px] font-semibold text-clay">(provisoire)</span>}
            </span>
            <span className="text-text-muted">{a.unite ? a.unite.code : '—'}</span>
            <Pastille ton={TON_PASTILLE[a.statut]}>{a.libelleStatut}</Pastille>
            <span>
              {a.dateFinPrevue ? (
                <span className={a.finProche ? 'font-semibold text-clay' : 'text-text-muted'}>
                  {date(a.dateFinPrevue)} {a.natureFinPrevue === 'STAGE' ? '(stage)' : '(contrat)'}
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </span>
            <span className="flex lg:justify-end">
              <button type="button" className={BTN_LIGNE} aria-label={`Voir la fiche de ${a.prenoms} ${a.nom}`} onClick={(e) => (e.stopPropagation(), ouvrir(a.id))}>
                Voir
              </button>
            </span>
          </LigneTableau>
        ))}
      </Tableau>

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

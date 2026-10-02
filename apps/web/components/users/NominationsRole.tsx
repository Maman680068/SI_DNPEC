'use client';

import { useCallback, useEffect, useState } from 'react';
import { confirmerChangementRole, getChangementsRole, refuserChangementRole } from '../../lib/api/users';
import type { ChangementRoleNomination, ListeChangementsRole } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '');
const STATUT: Record<ChangementRoleNomination['statut'], { libelle: string; ton: 'gold' | 'sage' | 'clay' }> = {
  EN_ATTENTE: { libelle: 'En attente', ton: 'gold' },
  APPLIQUE: { libelle: 'Droits appliqués', ton: 'sage' },
  REFUSE: { libelle: 'Refusé', ton: 'clay' },
};

/**
 * Nominations (option A) : l'acte de nomination signé à un poste de responsabilité arrive ici en
 * changement de rôle pré-rempli ; l'administrateur le confirme (l'actuel titulaire change aussi de
 * rôle) ou le refuse avec un motif. Écarts entre fonction du dossier et rôle du compte en dessous.
 */
export function NominationsRole() {
  const [l, setL] = useState<ListeChangementsRole | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<ChangementRoleNomination | null>(null);
  const [refuser, setRefuser] = useState<ChangementRoleNomination | null>(null);
  const charger = useCallback(() => {
    getChangementsRole().then(setL).catch((x) => setErreur(messageChargement(x)));
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const enAttente = l.changements.filter((c) => c.statut === 'EN_ATTENTE');
  const traites = l.changements.filter((c) => c.statut !== 'EN_ATTENTE');
  const fait = () => {
    setConfirmer(null);
    setRefuser(null);
    charger();
  };

  return (
    <div>
      <ErreurChargement message={erreur} />
      <p className="mb-4 max-w-3xl text-[12.5px] text-text-muted">
        Un acte de nomination signé à un poste de responsabilité met à jour la fonction du dossier ; le rôle et l’unité du compte ne changent qu’après votre confirmation, le jour même.
        Motif enregistré : le numéro de l’acte.
      </p>

      <h2 className="mb-2 text-[15px] font-bold">Nominations à appliquer</h2>
      {enAttente.length === 0 ? (
        <p className="mb-6 rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucune nomination en attente.</p>
      ) : (
        <ul className="mb-6 divide-y divide-line rounded-lg border border-line bg-surface" data-testid="nominations-attente">
          {enAttente.map((c) => (
            <li key={c.id} data-testid="nomination" className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 text-[13px]">
                  <div className="text-[13.5px] font-semibold">
                    {c.agent?.nom ?? 'Compte inconnu'} → {c.poste.libelleRole}{c.poste.unite ? ` — ${c.poste.unite}` : ''}
                  </div>
                  <div className="text-[12px] text-text-muted">
                    Acte n° {c.acteNumero} · effet le {date(c.dateEffet)}{c.fonction ? ` · fonction « ${c.fonction} »` : ''}
                    {c.agent ? ` · rôle actuel : ${c.agent.libelleRole}${c.agent.unite ? ` (${c.agent.unite})` : ''}` : ''}
                  </div>
                  <div className="mt-1">
                    {c.ancienTitulaire ? (
                      <>
                        Actuel titulaire : <strong>{c.ancienTitulaire.nom}</strong> ({c.ancienTitulaire.libelleRole}) →{' '}
                        {c.ancienTitulaire.propose ? (
                          <strong>{c.ancienTitulaire.propose.libelleRole}{c.ancienTitulaire.propose.unite ? ` — ${c.ancienTitulaire.propose.unite}` : ''}</strong>
                        ) : (
                          <strong className="text-clay">rôle à choisir</strong>
                        )}
                      </>
                    ) : (
                      'Poste vacant : aucun titulaire à déplacer.'
                    )}
                  </div>
                  {c.erreur && <p className="mt-1 text-[12px] text-clay" data-testid="nomination-erreur">Dernière tentative : {c.erreur}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.droits.confirmer && <Button variant="solid" className="!px-3 !py-1 !text-[12px]" onClick={() => setConfirmer(c)}>Confirmer…</Button>}
                  {c.droits.refuser && <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => setRefuser(c)}>Refuser…</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-1 text-[15px] font-bold">Écarts entre fonction du dossier et rôle du compte</h2>
      <p className="mb-2 text-[12.5px] text-text-muted">Relevés à chaque ouverture, signalés chaque matin aux administrateurs et dans la supervision.</p>
      {l.ecarts.length === 0 ? (
        <p className="mb-6 rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucun écart : fonctions et rôles concordent.</p>
      ) : (
        <ul className="mb-6 divide-y divide-line rounded-lg border border-line bg-surface" data-testid="ecarts">
          {l.ecarts.map((e) => (
            <li key={e.userId} data-testid="ecart" className="px-4 py-2.5 text-[13px]">
              <strong>{e.nom}</strong> <span className="text-text-muted">· rôle : {l.choix.roles.find((r) => r.role === e.role)?.libelle ?? e.role} · fonction : {e.fonction ?? '—'}</span>
              <div className="text-[12.5px]">{e.motif}. <span className="text-text-muted">{e.suite}.</span></div>
            </li>
          ))}
        </ul>
      )}

      {traites.length > 0 && (
        <>
          <h2 className="mb-2 text-[15px] font-bold">Nominations traitées</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface" data-testid="nominations-traitees">
            {traites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span>
                  {c.agent?.nom ?? 'Compte inconnu'} → {c.poste.libelleRole}{c.poste.unite ? ` — ${c.poste.unite}` : ''}
                  <span className="text-text-muted"> · acte n° {c.acteNumero}{c.decidePar ? ` · ${c.decidePar}` : ''}{c.decideLe ? `, le ${date(c.decideLe)}` : ''}{c.motifRefus ? ` · motif : ${c.motifRefus}` : ''}</span>
                </span>
                <Badge tone={STATUT[c.statut].ton}>{STATUT[c.statut].libelle}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirmer && <FenetreConfirmer c={confirmer} choix={l.choix} onClose={() => setConfirmer(null)} onFait={fait} />}
      {refuser && <FenetreRefuser c={refuser} onClose={() => setRefuser(null)} onFait={fait} />}
    </div>
  );
}

function FenetreConfirmer({ c, choix, onClose, onFait }: { c: ChangementRoleNomination; choix: ListeChangementsRole['choix']; onClose: () => void; onFait: () => void }) {
  const p = c.ancienTitulaire?.propose;
  const [v, setV] = useState({ role: (p?.role ?? '') as SystemRole | '', divisionId: p?.divisionId ?? '', sectionId: p?.sectionId ?? '', celluleId: p?.celluleId ?? '', note: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const division = choix.divisions.find((d) => d.id === v.divisionId);
  return (
    <Fenetre
      titre="Confirmer la nomination"
      onClose={onClose}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Appliquer les droits"
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await confirmerChangementRole(c.id, {
            note: v.note.trim() || undefined,
            ...(c.ancienTitulaire && v.role ? { ancienTitulaire: { role: v.role, divisionId: v.divisionId || null, sectionId: v.sectionId || null, celluleId: v.celluleId || null } } : {}),
          });
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <p className="mb-3 text-[13px]">
        <strong>{c.agent?.nom}</strong> devient <strong>{c.poste.libelleRole}{c.poste.unite ? ` — ${c.poste.unite}` : ''}</strong> (acte n° {c.acteNumero}).
        Ses sessions sont fermées ; il ou elle se reconnecte avec ses nouveaux droits.
      </p>
      {c.ancienTitulaire && (
        <fieldset className="mb-3 rounded-md border border-line p-3">
          <legend className="px-1 text-[12.5px] font-semibold">Nouveau rôle de {c.ancienTitulaire.nom} ({c.ancienTitulaire.libelleRole})</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-[12.5px] font-semibold">Rôle
              <select required value={v.role} onChange={(e) => setV((x) => ({ ...x, role: e.target.value as SystemRole }))} className={champ}>
                <option value="">— Choisir —</option>
                {choix.roles.map((r) => <option key={r.role} value={r.role}>{r.libelle}</option>)}
              </select>
            </label>
            <label className="block text-[12.5px] font-semibold">Division
              <select value={v.divisionId} onChange={(e) => setV((x) => ({ ...x, divisionId: e.target.value, sectionId: '', celluleId: e.target.value ? '' : x.celluleId }))} className={champ}>
                <option value="">—</option>
                {choix.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="block text-[12.5px] font-semibold">Section
              <select value={v.sectionId} onChange={(e) => setV((x) => ({ ...x, sectionId: e.target.value }))} className={champ} disabled={!division}>
                <option value="">—</option>
                {(division?.sections ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block text-[12.5px] font-semibold">Cellule
              <select value={v.celluleId} onChange={(e) => setV((x) => ({ ...x, celluleId: e.target.value, divisionId: e.target.value ? '' : x.divisionId, sectionId: '' }))} className={champ}>
                <option value="">—</option>
                {choix.cellules.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-[12px] text-text-muted">Son rôle change d’abord (le poste est libéré), avec le même motif.</p>
        </fieldset>
      )}
      <label className="block text-[12.5px] font-semibold">
        Précision (facultative, ajoutée au motif « Acte de nomination n° {c.acteNumero} »)
        <textarea rows={2} value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} className={champ} />
      </label>
    </Fenetre>
  );
}

function FenetreRefuser({ c, onClose, onFait }: { c: ChangementRoleNomination; onClose: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <Fenetre
      titre="Refuser la nomination"
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      danger
      libelleValider="Refuser"
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await refuserChangementRole(c.id, motif);
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <p className="mb-3 text-[13px]">Le rôle de {c.agent?.nom} ne change pas ; le DRH voit le refus et son motif sur le mouvement (acte n° {c.acteNumero}).</p>
      <label className="block text-[12.5px] font-semibold">
        Motif (obligatoire)
        <textarea required minLength={5} rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} className={champ} />
      </label>
    </Fenetre>
  );
}

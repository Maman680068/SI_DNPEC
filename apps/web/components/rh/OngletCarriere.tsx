'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  annulerMouvement,
  choisirRegistreFamille,
  getFamillesActes,
  getMouvements,
  preparerActeMouvement,
  preparerMouvement,
} from '../../lib/api/rh';
import type { Familles, ListeMouvements, Mouvement, StatutMouvement, TypeMouvement } from '../../lib/rh/types';
import { LIBELLE_STATUT_MOUVEMENT, LIBELLE_TYPE_MOUVEMENT } from '../../lib/rh/types';
import { useOrg } from '../../lib/org/OrgProvider';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const TON: Record<StatutMouvement, 'accent' | 'gold' | 'sage' | 'clay' | 'muted'> = { PREPARE: 'gold', EN_ACTE: 'accent', APPLIQUE: 'sage', ANNULE: 'muted' };
const LIBELLE_CHAMP: Record<string, string> = {
  fonction: 'Fonction', echelon: 'Échelon', grade: 'Grade', categorie: 'Catégorie', divisionId: 'Division', sectionId: 'Section', celluleId: 'Cellule', dateFinPrevue: 'Fin de contrat',
};

/** Carrière et actes (A3.6) : mouvements datés, acte numéroté du Courrier, application à la signature. */
export function OngletCarriere({ userId, voirFamilles }: { userId?: string; voirFamilles: boolean }) {
  const [l, setL] = useState<ListeMouvements | null>(null);
  const [f, setF] = useState<Familles | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  const charger = useCallback(() => {
    getMouvements(userId).then(setL).catch((x) => setErreur(messageChargement(x)));
    if (voirFamilles) getFamillesActes().then(setF).catch((x) => setErreur(messageChargement(x)));
  }, [userId, voirFamilles]);
  useEffect(() => {
    charger();
  }, [charger]);
  const valeur = (cle: string, v: string | null) =>
    !v ? '—' : cle === 'divisionId' ? getDivisionName(v) ?? v : cle === 'sectionId' ? getSectionName(v) ?? v : cle === 'celluleId' ? getCelluleName(v) ?? v : v;
  const agir = (p: Promise<unknown>) => {
    setErreur(null);
    p.then(charger).catch((x) => setErreur(messageChargement(x)));
  };
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Mouvements de carrière</h2>
        {l.droits.preparer && <Button variant="solid" onClick={() => setNouveau(true)}>+ Nouveau mouvement</Button>}
      </div>
      {l.mouvements.length === 0 ? (
        <p className="mb-6 rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucun mouvement de carrière.</p>
      ) : (
        <ul className="mb-6 divide-y divide-line rounded-lg border border-line bg-surface" data-testid="mouvements">
          {l.mouvements.map((m: Mouvement) => (
            <li key={m.id} data-testid="mouvement" className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold">{LIBELLE_TYPE_MOUVEMENT[m.type]} — {m.agent}</div>
                  <div className="text-[12px] text-text-muted">
                    Effet le {new Date(m.dateEffet).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                    {m.acte?.numero ? ` · acte n° ${m.acte.numero}` : m.acte ? ' · acte en cours dans le Courrier' : ''}
                  </div>
                  <div className="mt-1 text-[12.5px]">
                    {Object.keys({ ...m.avant, ...m.apres }).map((c) => (
                      <span key={c} className="mr-3 inline-block">
                        {LIBELLE_CHAMP[c] ?? c} : {valeur(c, m.avant[c] ?? null)} → <strong>{valeur(c, m.apres[c] ?? null)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={TON[m.statut]}>{LIBELLE_STATUT_MOUVEMENT[m.statut]}</Badge>
                  {m.acte && <Link href={`/courrier?acte=${m.acte.id}`} className="text-[12.5px] font-semibold text-accent">Voir l’acte</Link>}
                  {m.droits.preparerActe && <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => agir(preparerActeMouvement(m.id))}>Préparer l’acte</Button>}
                  {m.droits.annuler && <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => agir(annulerMouvement(m.id))}>Annuler</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {f && (
        <section aria-label="Familles d’actes" data-testid="familles-actes">
          <h2 className="mb-1 text-[15px] font-bold">Familles d’actes</h2>
          <p className="mb-2.5 text-[12.5px] text-text-muted">Chaque famille a sa séquence (celle de son registre du Courrier, continue et jamais réutilisée) et son signataire.</p>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {f.familles.map((x) => (
              <li key={x.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span><strong>{x.libelle}</strong> <span className="text-text-muted">· signataire : {x.signataire}</span></span>
                {f.droits.gerer ? (
                  <select
                    aria-label={`Registre de la famille ${x.libelle}`}
                    value={x.registre?.id ?? ''}
                    onChange={(e) => agir(choisirRegistreFamille(x.code, e.target.value || null))}
                    className="rounded-md border border-line bg-surface px-2 py-1.5 text-[12.5px]"
                  >
                    <option value="">— Registre à choisir —</option>
                    {f.registresPossibles.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.libelle}</option>)}
                  </select>
                ) : (
                  <span className="text-text-muted">{x.registre ? `${x.registre.code} — ${x.registre.libelle}` : 'Registre à choisir'}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {nouveau && <FenetreMouvement liste={l} onClose={() => setNouveau(false)} onFait={() => (setNouveau(false), charger())} />}
    </div>
  );
}

function FenetreMouvement({ liste, onClose, onFait }: { liste: ListeMouvements; onClose: () => void; onFait: () => void }) {
  const { divisions, sections, cellules } = useOrg();
  const [v, setV] = useState({ userId: '', type: 'AVANCEMENT_ECHELON' as TypeMouvement, dateEffet: new Date().toISOString().slice(0, 10), motif: '', fonction: '', echelon: '', grade: '', categorie: '', divisionId: '', sectionId: '', celluleId: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const apres: Record<TypeMouvement, Record<string, string | null>> = {
    NOMINATION: { fonction: v.fonction },
    AVANCEMENT_ECHELON: { echelon: v.echelon },
    PROMOTION: { grade: v.grade, echelon: v.echelon || null, categorie: v.categorie || null },
    MUTATION: { divisionId: v.divisionId || null, sectionId: v.sectionId || null, celluleId: v.celluleId || null },
    FIN_CONTRAT: {},
  };
  return (
    <Fenetre
      titre="Nouveau mouvement de carrière"
      onClose={onClose}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Préparer le mouvement"
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await preparerMouvement({ userId: v.userId, type: v.type, dateEffet: v.dateEffet, motif: v.motif || undefined, apres: apres[v.type] });
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">
        Agent
        <select required value={v.userId} onChange={set('userId')} className={champ}>
          <option value="">— Choisir —</option>
          {liste.agents.map((a) => <option key={a.id} value={a.id}>{a.lastName} {a.firstName}</option>)}
        </select>
      </label>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[12.5px] font-semibold">
          Mouvement
          <select value={v.type} onChange={set('type')} className={champ}>
            {(Object.keys(LIBELLE_TYPE_MOUVEMENT) as TypeMouvement[]).map((t) => <option key={t} value={t}>{LIBELLE_TYPE_MOUVEMENT[t]}</option>)}
          </select>
        </label>
        <label className="block text-[12.5px] font-semibold">
          Date d’effet
          <input type="date" required value={v.dateEffet} onChange={set('dateEffet')} className={champ} />
        </label>
      </div>
      {v.type === 'NOMINATION' && <label className="mb-3 block text-[12.5px] font-semibold">Nouvelle fonction<input required value={v.fonction} onChange={set('fonction')} className={champ} /></label>}
      {(v.type === 'AVANCEMENT_ECHELON' || v.type === 'PROMOTION') && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {v.type === 'PROMOTION' && <label className="block text-[12.5px] font-semibold">Nouveau grade<input required value={v.grade} onChange={set('grade')} className={champ} /></label>}
          <label className="block text-[12.5px] font-semibold">Nouvel échelon<input required={v.type === 'AVANCEMENT_ECHELON'} value={v.echelon} onChange={set('echelon')} className={champ} /></label>
          {v.type === 'PROMOTION' && <label className="block text-[12.5px] font-semibold">Catégorie<input value={v.categorie} onChange={set('categorie')} className={champ} /></label>}
        </div>
      )}
      {v.type === 'MUTATION' && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-[12.5px] font-semibold">Division
            <select value={v.divisionId} onChange={(e) => setV((x) => ({ ...x, divisionId: e.target.value, sectionId: '', celluleId: e.target.value ? '' : x.celluleId }))} className={champ}>
              <option value="">—</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block text-[12.5px] font-semibold">Section
            <select value={v.sectionId} onChange={set('sectionId')} className={champ} disabled={!v.divisionId}>
              <option value="">—</option>
              {sections.filter((s) => s.divisionId === v.divisionId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block text-[12.5px] font-semibold">Cellule
            <select value={v.celluleId} onChange={(e) => setV((x) => ({ ...x, celluleId: e.target.value, divisionId: e.target.value ? '' : x.divisionId, sectionId: '' }))} className={champ}>
              <option value="">—</option>
              {cellules.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
      )}
      <label className="block text-[12.5px] font-semibold">
        Motif {v.type === 'FIN_CONTRAT' ? '(obligatoire)' : '(facultatif)'}
        <textarea rows={2} value={v.motif} onChange={set('motif')} className={champ} />
      </label>
      <p className="mt-2 text-[12px] text-text-muted">Le dossier n’est modifié qu’à la signature de l’acte par le DN ou la DNA.</p>
    </Fenetre>
  );
}

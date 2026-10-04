'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import { ROLE_LABEL } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { Plus } from 'lucide-react';
import { Fenetre } from '../ui/Fenetre';
import { FenetreDetail } from '../ui/FenetreDetail';
import {
  BandeCompteurs,
  BTN_DANGER_CONTOUR,
  BTN_LIGNE,
  BTN_LIGNE_PRINCIPAL,
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  CleValeur,
  Etapes,
  EtatVide,
  LigneTableau,
  Panneau,
  Pastille,
  SectionFenetre,
  type TonPastille,
} from '../ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] font-normal';
const DROITS: Record<'EN_ATTENTE' | 'APPLIQUE' | 'REFUSE', { libelle: string; ton: TonPastille }> = {
  APPLIQUE: { libelle: 'Droits appliqués', ton: 'vert' },
  EN_ATTENTE: { libelle: 'Droits en attente (administrateur)', ton: 'ambre' },
  REFUSE: { libelle: 'Droits refusés', ton: 'rouge' },
};
const TON: Record<StatutMouvement, TonPastille> = { PREPARE: 'ambre', EN_ACTE: 'bleu', APPLIQUE: 'vert', ANNULE: 'gris' };
const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_130px_170px_190px]';
const LIBELLE_CHAMP: Record<string, string> = {
  fonction: 'Fonction', role: 'Poste (droits)', echelon: 'Échelon', grade: 'Grade', categorie: 'Catégorie', divisionId: 'Division', sectionId: 'Section', celluleId: 'Cellule', dateFinPrevue: 'Fin de contrat',
};

/** Carrière et actes (A3.6) : mouvements datés, acte numéroté du Courrier, application à la signature. */
export function OngletCarriere({ userId, voirFamilles }: { userId?: string; voirFamilles: boolean }) {
  const [l, setL] = useState<ListeMouvements | null>(null);
  const [f, setF] = useState<Familles | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
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
    !v ? '—' : cle === 'role' ? ROLE_LABEL[v as SystemRole] ?? v : cle === 'divisionId' ? getDivisionName(v) ?? v : cle === 'sectionId' ? getSectionName(v) ?? v : cle === 'celluleId' ? getCelluleName(v) ?? v : v;
  const agir = (p: Promise<unknown>) => {
    setErreur(null);
    p.then(charger).catch((x) => setErreur(messageChargement(x)));
  };
  const detail = ouvert ? l?.mouvements.find((m) => m.id === ouvert) ?? null : null;
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const changements = (m: Mouvement) =>
    Object.keys({ ...m.avant, ...m.apres }).map((c) => (
      <span key={c} className="mr-3 inline-block">
        {LIBELLE_CHAMP[c] ?? c} : {valeur(c, m.avant[c] ?? null)} → <strong>{valeur(c, m.apres[c] ?? null)}</strong>
      </span>
    ));
  const actionsLigne = (m: Mouvement) => (
    <>
      {m.acte && (
        <Link href={`/courrier?acte=${m.acte.id}`} onClick={(e) => e.stopPropagation()} className={BTN_LIGNE}>
          Voir l’acte
        </Link>
      )}
      {m.droits.preparerActe && (
        <button type="button" className={BTN_LIGNE_PRINCIPAL} onClick={(e) => (e.stopPropagation(), agir(preparerActeMouvement(m.id)))}>
          Préparer l’acte
        </button>
      )}
      {m.droits.annuler && (
        <button type="button" className={BTN_LIGNE} onClick={(e) => (e.stopPropagation(), agir(annulerMouvement(m.id)))}>
          Annuler
        </button>
      )}
    </>
  );
  const enCours = l.mouvements.filter((m) => m.statut === 'PREPARE' || m.statut === 'EN_ACTE');
  return (
    <div>
      <ErreurChargement message={erreur} />
      {l.droits.preparer && (
        <BandeCompteurs
          label="Mouvements de carrière"
          items={[
            { valeur: l.mouvements.filter((m) => m.statut === 'PREPARE').length, label: 'Préparés', sous: 'acte à préparer', ton: 'ambre' },
            { valeur: l.mouvements.filter((m) => m.statut === 'EN_ACTE').length, label: 'Actes en cours', sous: 'dans le circuit du Courrier' },
            { valeur: l.mouvements.filter((m) => m.statut === 'APPLIQUE').length, label: 'Appliqués', sous: 'au dossier, à la signature', ton: 'vert' },
            { valeur: l.mouvements.filter((m) => m.droitsPoste?.statut === 'EN_ATTENTE').length, label: 'Droits en attente', sous: 'confirmation de l’administrateur', ton: 'gris' },
          ]}
        />
      )}
      <Panneau
        titre="Mouvements de carrière"
        compteur={<span className="text-[12.5px] font-semibold text-text-faint">{enCours.length ? `${enCours.length} en cours` : l.mouvements.length}</span>}
        action={
          l.droits.preparer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouveau(true)}>
              <Plus aria-hidden size={16} /> Nouveau mouvement
            </button>
          )
        }
        className="mb-4 overflow-hidden"
      >
        {l.mouvements.length === 0 ? (
          <EtatVide
            texte="Aucun mouvement de carrière."
            action={l.droits.preparer ? <button type="button" className={BTN_LIGNE} onClick={() => setNouveau(true)}>Préparer un mouvement</button> : undefined}
          />
        ) : (
          <div role="table" aria-label="Mouvements de carrière" data-testid="mouvements">
            <div role="rowgroup">
              <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-[#F7F8FB] px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE}`}>
                <span role="columnheader">Mouvement</span>
                <span role="columnheader">Effet</span>
                <span role="columnheader">Statut</span>
                <span role="columnheader"><span className="sr-only">Actions</span></span>
              </div>
            </div>
            <div role="rowgroup">
              {l.mouvements.map((m: Mouvement) => (
                <LigneTableau key={m.id} grille={GRILLE} testid="mouvement" label={`${LIBELLE_TYPE_MOUVEMENT[m.type]} — ${m.agent ?? ''}`} onClick={() => setOuvert(m.id)} actif={ouvert === m.id}>
                  <span className="block">
                    <b className="block font-semibold text-ink-900">
                      {LIBELLE_TYPE_MOUVEMENT[m.type]} — {m.agent}
                    </b>
                    <span className="block text-[12.5px] text-text">{changements(m)}</span>
                    {m.droitsPoste?.statut === 'REFUSE' && m.droitsPoste.motifRefus && (
                      <span className="block text-[12px] text-clay">Motif du refus de l’administrateur : {m.droitsPoste.motifRefus}</span>
                    )}
                  </span>
                  <span className="block text-[12.5px] text-text-muted">
                    {new Date(m.dateEffet).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
                    {m.acte?.numero ? <span className="block">acte n° {m.acte.numero}</span> : m.acte ? <span className="block">acte en cours dans le Courrier</span> : null}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <Pastille ton={TON[m.statut]}>{LIBELLE_STATUT_MOUVEMENT[m.statut]}</Pastille>
                    {m.droitsPoste && <Pastille ton={DROITS[m.droitsPoste.statut].ton} testid="droits-poste">{DROITS[m.droitsPoste.statut].libelle}</Pastille>}
                  </span>
                  <span className="flex flex-wrap gap-1.5 lg:justify-end">{actionsLigne(m)}</span>
                </LigneTableau>
              ))}
            </div>
          </div>
        )}
      </Panneau>
      {f && (
        <Panneau titre="Familles d’actes" testid="familles-actes" className="overflow-hidden">
          <p className="border-b border-line px-[18px] py-2.5 text-[12.5px] text-text-muted">Chaque famille a sa séquence (celle de son registre du Courrier, continue et jamais réutilisée) et son signataire.</p>
          <ul>
            {f.familles.map((x) => (
              <li key={x.code} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F1F6] px-[18px] py-2.5 text-[13.5px] last:border-b-0">
                <span><strong className="text-ink-900">{x.libelle}</strong> <span className="text-text-muted">· signataire : {x.signataire}</span></span>
                {f.droits.gerer ? (
                  <select
                    aria-label={`Registre de la famille ${x.libelle}`}
                    value={x.registre?.id ?? ''}
                    onChange={(e) => agir(choisirRegistreFamille(x.code, e.target.value || null))}
                    className="h-9 max-w-full rounded-[9px] border border-line bg-surface px-2.5 text-[13px]"
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
        </Panneau>
      )}
      {nouveau && <FenetreMouvement liste={l} onClose={() => setNouveau(false)} onFait={() => (setNouveau(false), charger())} />}
      {detail && (
        <FenetreDetail
          titre={`${LIBELLE_TYPE_MOUVEMENT[detail.type]} — ${detail.agent ?? ''}`}
          filAriane={['Ressources humaines', 'Carrière et actes']}
          entete={
            <Etapes
              label="Circuit du mouvement"
              etapes={['Préparé', 'Acte en cours', 'Appliqué'].map((label, n) => {
                const rang = { PREPARE: 0, EN_ACTE: 1, APPLIQUE: 2, ANNULE: -1 }[detail.statut];
                return { label, etat: n < rang || (rang === 2 && n === 2) ? ('fait' as const) : n === rang ? ('courant' as const) : ('avenir' as const) };
              })}
            />
          }
          onClose={() => setOuvert(null)}
          largeur={880}
          testid="fiche-mouvement"
          cote={
            <div>
              <div className="grid gap-2">
                {detail.droits.preparerActe && (
                  <button type="button" className={BTN_PRINCIPAL} onClick={() => agir(preparerActeMouvement(detail.id))}>
                    Préparer l’acte
                  </button>
                )}
                {detail.acte && (
                  <Link href={`/courrier?acte=${detail.acte.id}`} className={BTN_SECONDAIRE}>
                    Voir l’acte
                  </Link>
                )}
                {detail.droits.annuler && (
                  <button type="button" className={BTN_DANGER_CONTOUR} onClick={() => agir(annulerMouvement(detail.id))}>
                    Annuler le mouvement
                  </button>
                )}
                {!detail.droits.preparerActe && !detail.acte && !detail.droits.annuler && (
                  <p className="text-[12.5px] text-text-muted">Aucune action possible sur ce mouvement.</p>
                )}
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <CleValeur
                  largeur={96}
                  lignes={[
                    ['Statut', <Pastille key="s" ton={TON[detail.statut]}>{LIBELLE_STATUT_MOUVEMENT[detail.statut]}</Pastille>],
                    ['Agent', detail.agent ?? '—'],
                    ['Effet le', new Date(detail.dateEffet).toLocaleDateString('fr-FR', { timeZone: 'UTC' })],
                    ['Acte', detail.acte?.numero ? `n° ${detail.acte.numero}` : detail.acte ? 'en cours' : '—'],
                    ...(detail.appliqueLe ? ([['Appliqué le', new Date(detail.appliqueLe).toLocaleDateString('fr-FR')]] as [string, string][]) : []),
                    ...(detail.droitsPoste ? ([['Droits', <Pastille key="d" ton={DROITS[detail.droitsPoste.statut].ton}>{DROITS[detail.droitsPoste.statut].libelle}</Pastille>]] as [string, ReactNode][]) : []),
                  ]}
                />
              </div>
            </div>
          }
        >
          <SectionFenetre titre="Changements au dossier">
            <ul className="divide-y divide-[#F0F1F6] rounded-[10px] border border-line text-[13.5px]">
              {Object.keys({ ...detail.avant, ...detail.apres }).map((c) => (
                <li key={c} className="grid grid-cols-1 gap-1 px-3.5 py-2.5 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <span className="text-text-muted">{LIBELLE_CHAMP[c] ?? c}</span>
                  <span>
                    {valeur(c, detail.avant[c] ?? null)} → <strong className="text-ink-900">{valeur(c, detail.apres[c] ?? null)}</strong>
                  </span>
                </li>
              ))}
              {Object.keys({ ...detail.avant, ...detail.apres }).length === 0 && <li className="px-3.5 py-2.5 text-text-muted">Aucun champ modifié (fin de contrat).</li>}
            </ul>
          </SectionFenetre>
          {detail.motif && (
            <SectionFenetre titre="Motif">
              <p className="whitespace-pre-wrap text-[13.5px]">{detail.motif}</p>
            </SectionFenetre>
          )}
          {detail.droitsPoste?.statut === 'REFUSE' && detail.droitsPoste.motifRefus && (
            <SectionFenetre titre="Refus de l’administrateur">
              <p className="text-[13.5px] text-clay">{detail.droitsPoste.motifRefus}</p>
            </SectionFenetre>
          )}
          <p className="text-[12.5px] text-text-muted">Le dossier n’est modifié qu’à la signature de l’acte par le DN ou la DNA.</p>
        </FenetreDetail>
      )}
    </div>
  );
}

function FenetreMouvement({ liste, onClose, onFait }: { liste: ListeMouvements; onClose: () => void; onFait: () => void }) {
  const { divisions, sections, cellules } = useOrg();
  const [v, setV] = useState({ userId: '', type: 'AVANCEMENT_ECHELON' as TypeMouvement, dateEffet: new Date().toISOString().slice(0, 10), motif: '', fonction: '', poste: '', echelon: '', grade: '', categorie: '', divisionId: '', sectionId: '', celluleId: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const poste = liste.postes.find((x) => x.cle === v.poste) ?? null;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const apres: Record<TypeMouvement, Record<string, string | null>> = {
    NOMINATION: poste ? { role: poste.role, divisionId: poste.divisionId, sectionId: poste.sectionId, celluleId: poste.celluleId } : { fonction: v.fonction },
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
      {v.type === 'NOMINATION' && (
        <>
          <label className="mb-3 block text-[12.5px] font-semibold">
            Poste visé
            <select value={v.poste} onChange={set('poste')} className={champ}>
              <option value="">Autre fonction (texte libre, sans effet sur les droits)</option>
              {liste.postes.map((x) => (
                <option key={x.cle} value={x.cle}>{x.fonction}{x.titulaire ? ` (actuel : ${x.titulaire})` : ' (vacant)'}</option>
              ))}
            </select>
          </label>
          {poste ? (
            <p className="mb-3 text-[12px] text-text-muted" data-testid="poste-vise">
              Fonction au dossier : <strong>{poste.fonction}</strong>. À la signature de l’acte, l’administrateur reçoit le changement de rôle pré-rempli
              {poste.titulaire ? ` (${poste.titulaire} redevient Chargé(e) d’Études dans la même unité, sauf choix contraire de l’administrateur)` : ''} et le confirme ou le refuse ;
              l’état des droits s’affiche sur le mouvement.
            </p>
          ) : (
            <label className="mb-3 block text-[12.5px] font-semibold">Nouvelle fonction<input required value={v.fonction} onChange={set('fonction')} className={champ} /></label>
          )}
        </>
      )}
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

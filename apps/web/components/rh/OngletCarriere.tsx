'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  annulerMouvement,
  choisirRegistreFamille,
  configurerFamillesActes,
  getFamillesActes,
  getMouvements,
  preparerActeMouvement,
  preparerMouvement,
  registreAttenduFamille,
} from '../../lib/api/rh';
import type { EtatFamille, Familles, ListeMouvements, Mouvement, StatutMouvement, TypeMouvement } from '../../lib/rh/types';
import { LIBELLE_STATUT_MOUVEMENT, LIBELLE_TYPE_MOUVEMENT } from '../../lib/rh/types';
import { useOrg } from '../../lib/org/OrgProvider';
import { ROLE_LABEL } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { Plus } from 'lucide-react';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { MenuActions, type ActionMenu } from '../ui/MenuActions';
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
import { Fenetre } from '../ui/Fenetre';

const DROITS: Record<'EN_ATTENTE' | 'APPLIQUE' | 'REFUSE', { libelle: string; ton: TonPastille }> = {
  APPLIQUE: { libelle: 'Droits appliqués', ton: 'vert' },
  EN_ATTENTE: { libelle: 'Droits en attente (administrateur)', ton: 'ambre' },
  REFUSE: { libelle: 'Droits refusés', ton: 'rouge' },
};
const ETAT_FAMILLE: Record<EtatFamille, { libelle: string; ton: TonPastille }> = {
  PRETE: { libelle: '✓ Prête', ton: 'vert' },
  A_CORRIGER: { libelle: '! À corriger', ton: 'ambre' },
  BLOQUEE: { libelle: '✕ Bloquée', ton: 'rouge' },
};
const GRILLE_FAMILLES = 'lg:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_minmax(0,1.1fr)_80px_minmax(0,1.2fr)]';
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
  const [annee, setAnnee] = useState<number | ''>('');
  const [type, setType] = useState('');
  const [configurer, setConfigurer] = useState(false);
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  const charger = useCallback(() => {
    getMouvements(userId, { annee: annee || undefined, type: type || undefined }).then(setL).catch((x) => setErreur(messageChargement(x)));
    if (voirFamilles) getFamillesActes().then(setF).catch((x) => setErreur(messageChargement(x)));
  }, [userId, voirFamilles, annee, type]);
  useEffect(() => {
    charger();
  }, [charger]);
  const valeur = (cle: string, v: string | null) =>
    !v ? '—' : cle === 'role' ? ROLE_LABEL[v as SystemRole] ?? v : cle === 'divisionId' ? getDivisionName(v) ?? v : cle === 'sectionId' ? getSectionName(v) ?? v : cle === 'celluleId' ? getCelluleName(v) ?? v : v;
  const toast = useToast();
  const router = useRouter();
  const agir = (p: Promise<unknown>, titre: string, options?: { detail?: string; annuler?: () => void | Promise<void> }) => {
    p.then(() => {
      charger();
      toast.succes(titre, options);
    }).catch((x) => toast.erreur('Action impossible', messageErreur(x)));
  };
  const remettre = (p: Promise<unknown>) => p.then(charger).catch((x) => toast.erreur('Action impossible', messageErreur(x)));
  const acte = (id: string) => agir(preparerActeMouvement(id), 'Acte préparé', { detail: 'Il suit le circuit du Courrier jusqu’à la signature.' });
  const annuler = (id: string) => agir(annulerMouvement(id), 'Mouvement annulé', { detail: 'Il reste au journal, sans effet sur le dossier.' });
  const detail = ouvert ? l?.mouvements.find((m) => m.id === ouvert) ?? null : null;
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const changements = (m: Mouvement) =>
    Object.keys({ ...m.avant, ...m.apres }).map((c) => (
      <span key={c} className="mr-3 inline-block">
        {LIBELLE_CHAMP[c] ?? c} : {valeur(c, m.avant[c] ?? null)} → <strong>{valeur(c, m.apres[c] ?? null)}</strong>
      </span>
    ));
  // Une action visible (la principale), les autres dans « Plus d'actions » : lignes de même hauteur.
  const actionsLigne = (m: Mouvement) => {
    const lienActe = m.acte ? `/courrier?acte=${m.acte.id}` : null;
    const toutes: (ActionMenu & { principale?: boolean; lien?: string })[] = [
      ...(m.droits.preparerActe ? [{ label: 'Préparer l’acte', principale: true, onSelect: () => acte(m.id) }] : []),
      ...(lienActe ? [{ label: 'Voir l’acte', lien: lienActe, onSelect: () => router.push(lienActe) }] : []),
      ...(m.droits.annuler ? [{ label: 'Annuler', onSelect: () => annuler(m.id) }] : []),
    ];
    const [premiere, ...autres] = toutes;
    if (!premiere) return null;
    return (
      <>
        {premiere.lien ? (
          <Link href={premiere.lien} onClick={(e) => e.stopPropagation()} className={BTN_LIGNE}>
            {premiere.label}
          </Link>
        ) : (
          <button type="button" className={premiere.principale ? BTN_LIGNE_PRINCIPAL : BTN_LIGNE} onClick={(e) => (e.stopPropagation(), premiere.onSelect())}>
            {premiere.label}
          </button>
        )}
        <MenuActions actions={autres} />
      </>
    );
  };
  const enCours = l.mouvements.filter((m) => m.statut === 'PREPARE' || m.statut === 'EN_ACTE');
  return (
    <div>
      <ErreurChargement message={erreur} />
      {f && <PanneauFamilles f={f} onChange={setF} onConfigurer={() => setConfigurer(true)} />}
      {(l.droits.preparer || voirFamilles) && (
        <BandeCompteurs
          label="Mouvements de carrière"
          items={[
            { valeur: l.compteurs.enPreparation, label: 'En préparation', sous: 'acte à préparer', ton: 'ambre' },
            { valeur: l.compteurs.enAttenteSignature, label: 'En attente de signature', sous: 'acte dans le circuit du Courrier' },
            { valeur: l.compteurs.appliques, label: 'Signés et appliqués', sous: 'au dossier, à la signature', ton: 'vert' },
            { valeur: l.compteurs.annules, label: 'Annulés', sous: 'sans effet sur le dossier', ton: 'gris' },
          ]}
        />
      )}
      {(l.droits.preparer || voirFamilles) && (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="filtres-mouvements">
          <select aria-label="Année" value={annee} onChange={(e) => setAnnee(e.target.value ? Number(e.target.value) : '')} className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold">
            <option value="">Toutes les années</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 - i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select aria-label="Type de mouvement" value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold">
            <option value="">Tous les types</option>
            {l.types.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </select>
        </div>
      )}
      <Panneau
        titre="Mouvements de carrière"
        compteur={<span className="text-[12.5px] font-semibold text-text-faint">{enCours.length ? `${enCours.length} en cours` : l.mouvements.length}</span>}
        action={
          l.droits.preparer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouveau(true)}>
              <Plus aria-hidden size={16} /> Préparer un mouvement
            </button>
          )
        }
        className="mb-4 overflow-hidden"
      >
        {l.mouvements.length === 0 ? (
          <EtatVide
            texte={
              annee || type
                ? 'Aucun mouvement ne correspond à ces filtres.'
                : 'Aucun mouvement de carrière. Un mouvement (nomination, avancement, promotion, mutation, fin de contrat) est préparé par le DRH, porté par un acte du Courrier dans le registre de sa famille, puis appliqué au dossier à la signature.'
            }
            action={l.droits.preparer ? <button type="button" className={BTN_LIGNE} onClick={() => setNouveau(true)}>Préparer un mouvement</button> : undefined}
          />
        ) : (
          <div role="table" aria-label="Mouvements de carrière" data-testid="mouvements">
            <div role="rowgroup">
              <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-fond-doux px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE}`}>
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
      {configurer && f && (
        <Fenetre
          titre={`Configurer ${f.configuration.length} registre${f.configuration.length > 1 ? 's' : ''}`}
          onClose={() => setConfigurer(false)}
          libelleValider="Configurer"
          onSubmit={() =>
            configurerFamillesActes()
              .then((x) => {
                setF(x);
                setConfigurer(false);
                toast.succes('Familles d’actes configurées', { detail: `${x.pretes} famille${x.pretes > 1 ? 's' : ''} prête${x.pretes > 1 ? 's' : ''} sur ${x.total}.` });
              })
              .catch((x) => toast.erreur('Configuration impossible', messageErreur(x)))
          }
          pied="Registres d’actes de la Direction, signés par le DN ou la DNA ; chaque création est tracée."
        >
          <ul className="list-disc space-y-1 pl-5 text-[13.5px]" data-testid="plan-configuration">
            {f.configuration.map((c) => (
              <li key={c.code}>
                {c.creation ? 'Créer' : 'Rattacher'} le registre <b>{c.code}</b> pour « {c.famille} »
              </li>
            ))}
          </ul>
        </Fenetre>
      )}
      {nouveau && (
        <FenetreMouvement
          liste={l}
          onClose={() => setNouveau(false)}
          onFait={(m) => {
            setNouveau(false);
            charger();
            toast.succes('Mouvement préparé', {
              detail: 'Préparez ensuite l’acte du Courrier.',
              ...(m?.id ? { annuler: () => remettre(annulerMouvement(m.id)) } : {}),
            });
          }}
        />
      )}
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
                  <button type="button" className={BTN_PRINCIPAL} onClick={() => acte(detail.id)}>
                    Préparer l’acte
                  </button>
                )}
                {detail.acte && (
                  <Link href={`/courrier?acte=${detail.acte.id}`} className={BTN_SECONDAIRE}>
                    Voir l’acte
                  </Link>
                )}
                {detail.droits.annuler && (
                  <button type="button" className={BTN_DANGER_CONTOUR} onClick={() => annuler(detail.id)}>
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
            <ul className="divide-y divide-line-doux rounded-[10px] border border-line text-[13.5px]">
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

function FenetreMouvement({ liste, onClose, onFait }: { liste: ListeMouvements; onClose: () => void; onFait: (m: Mouvement) => void }) {
  const { divisions, sections, cellules } = useOrg();
  const [v, setV] = useState({ userId: '', type: 'AVANCEMENT_ECHELON' as TypeMouvement, dateEffet: new Date().toISOString().slice(0, 10), motif: '', fonction: '', poste: '', echelon: '', grade: '', categorie: '', divisionId: '', sectionId: '', celluleId: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const poste = liste.postes.find((x) => x.cle === v.poste) ?? null;
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const apres: Record<TypeMouvement, Record<string, string | null>> = {
    NOMINATION: poste ? { role: poste.role, divisionId: poste.divisionId, sectionId: poste.sectionId, celluleId: poste.celluleId } : { fonction: v.fonction },
    AVANCEMENT_ECHELON: { echelon: v.echelon },
    PROMOTION: { grade: v.grade, echelon: v.echelon || null, categorie: v.categorie || null },
    MUTATION: { divisionId: v.divisionId || null, sectionId: v.sectionId || null, celluleId: v.celluleId || null },
    FIN_CONTRAT: {},
  };
  const opt = (l: { id: string; name: string }[]) => l.map((x) => ({ value: x.id, label: x.name }));
  return (
    <FenetreFormulaire
      titre="Nouveau mouvement de carrière"
      sousTitre="Le mouvement est porté par un acte du Courrier, dans le registre de sa famille d’actes."
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Préparer le mouvement"
      pied="Le dossier n’est modifié qu’à la signature de l’acte par le DN ou la DNA."
      testid="fenetre-mouvement"
      valider={() => (v.type === 'MUTATION' && !v.divisionId && !v.celluleId ? { 'mv-division': 'Choisissez la division ou la cellule d’accueil.' } : {})}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          const m = await preparerMouvement({ userId: v.userId, type: v.type, dateEffet: v.dateEffet, motif: v.motif || undefined, apres: apres[v.type] });
          onFait(m);
        } catch (x) {
          setErreur(messageErreur(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <SelecteurPersonnes
        id="mv-agent"
        label="Agent"
        multiple={false}
        required
        messageObligatoire="Choisissez l’agent concerné."
        options={liste.agents.map((a) => ({ id: a.id, nom: `${a.firstName} ${a.lastName}` }))}
        valeurs={v.userId ? [v.userId] : []}
        onChange={(ids) => set('userId')(ids[0] ?? '')}
      />
      <ChoixSegment<TypeMouvement>
        id="mv-type"
        label="Mouvement"
        options={(Object.keys(LIBELLE_TYPE_MOUVEMENT) as TypeMouvement[]).map((t) => ({ value: t, label: LIBELLE_TYPE_MOUVEMENT[t] }))}
        value={v.type}
        onChange={set('type')}
      />
      <Grille2>
        <ChampDate id="mv-effet" label="Date d’effet" required value={v.dateEffet} onChange={set('dateEffet')} />
      </Grille2>
      {v.type === 'NOMINATION' && (
        <>
          <Liste
            id="mv-poste"
            label="Poste visé"
            value={v.poste}
            onChange={set('poste')}
            vide="Autre fonction (texte libre, sans effet sur les droits)"
            options={liste.postes.map((x) => ({ value: x.cle, label: `${x.fonction}${x.titulaire ? ` (actuel : ${x.titulaire})` : ' (vacant)'}` }))}
          />
          {poste ? (
            <p className="mb-3.5 rounded-[10px] bg-ink-50 px-3 py-2.5 text-[12.5px] text-text" data-testid="poste-vise">
              Fonction au dossier : <strong>{poste.fonction}</strong>. À la signature de l’acte, l’administrateur reçoit le changement de rôle pré-rempli
              {poste.titulaire ? ` (${poste.titulaire} redevient Chargé(e) d’Études dans la même unité, sauf choix contraire de l’administrateur)` : ''} et le confirme ou le refuse ;
              l’état des droits s’affiche sur le mouvement.
            </p>
          ) : (
            <Saisie id="mv-fonction" label="Nouvelle fonction" required value={v.fonction} onChange={set('fonction')} />
          )}
        </>
      )}
      {(v.type === 'AVANCEMENT_ECHELON' || v.type === 'PROMOTION') && (
        <Grille2>
          {v.type === 'PROMOTION' && <Saisie id="mv-grade" label="Nouveau grade" required value={v.grade} onChange={set('grade')} />}
          <Saisie id="mv-echelon" label="Nouvel échelon" required={v.type === 'AVANCEMENT_ECHELON'} facultatif={v.type === 'PROMOTION'} value={v.echelon} onChange={set('echelon')} />
          {v.type === 'PROMOTION' && <Saisie id="mv-categorie" label="Catégorie" facultatif value={v.categorie} onChange={set('categorie')} />}
        </Grille2>
      )}
      {v.type === 'MUTATION' && (
        <Grille2>
          <Liste id="mv-division" label="Division" vide="—" value={v.divisionId} options={opt(divisions)} onChange={(x) => setV((o) => ({ ...o, divisionId: x, sectionId: '', celluleId: x ? '' : o.celluleId }))} />
          <Liste id="mv-cellule" label="Ou cellule" vide="—" value={v.celluleId} options={opt(cellules)} onChange={(x) => setV((o) => ({ ...o, celluleId: x, divisionId: x ? '' : o.divisionId, sectionId: '' }))} />
          {v.divisionId && <Liste id="mv-section" label="Section" facultatif vide="—" value={v.sectionId} options={opt(sections.filter((s) => s.divisionId === v.divisionId))} onChange={set('sectionId')} />}
        </Grille2>
      )}
      <ZoneTexte
        id="mv-motif"
        label="Motif"
        facultatif={v.type !== 'FIN_CONTRAT'}
        required={v.type === 'FIN_CONTRAT'}
        messageObligatoire="Le motif est obligatoire pour une fin de contrat."
        lignes={2}
        value={v.motif}
        onChange={set('motif')}
      />
    </FenetreFormulaire>
  );
}

/** Familles d'actes (S7) : jauge, état par famille, prochain numéro (aperçu), actes de l'année, actions de l'API. */
function PanneauFamilles({ f, onChange, onConfigurer }: { f: Familles; onChange: (x: Familles) => void; onConfigurer: () => void }) {
  const toast = useToast();
  const agir = (p: Promise<Familles>, titre: string) =>
    p
      .then((x) => {
        onChange(x);
        toast.succes(titre, { detail: `${x.pretes} famille${x.pretes > 1 ? 's' : ''} prête${x.pretes > 1 ? 's' : ''} sur ${x.total}.` });
      })
      .catch((x) => toast.erreur('Action impossible', messageErreur(x)));
  return (
    <Panneau titre="Familles d’actes" testid="familles-actes" className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3">
        <div className="min-w-[220px] flex-1">
          <p className="text-[14px] font-bold text-ink-900" data-testid="jauge-familles">
            {f.pretes} famille{f.pretes > 1 ? 's' : ''} prête{f.pretes > 1 ? 's' : ''} sur {f.total}
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fond-gris" aria-hidden>
            <div className="h-full rounded-full bg-sage" style={{ width: `${f.total ? Math.round((f.pretes / f.total) * 100) : 0}%` }} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-text-muted">Sans registre, l’acte d’une famille ne peut être ni préparé ni signé. Chaque famille a sa séquence (continue, jamais réutilisée) et son signataire (DN ou DNA).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {f.droits.gerer && f.configuration.length > 0 && (
            <button type="button" className={BTN_PRINCIPAL} onClick={onConfigurer}>
              Configurer les {f.configuration.length} registre{f.configuration.length > 1 ? 's' : ''} manquant{f.configuration.length > 1 ? 's' : ''}
            </button>
          )}
          <Link href="/courrier/administration" className={BTN_SECONDAIRE}>
            Registres du Courrier
          </Link>
        </div>
      </div>
      <div role="table" aria-label="Familles d’actes">
        <div role="rowgroup">
          <div role="row" className={`hidden h-[38px] items-center gap-3 border-b border-line bg-fond-doux px-4 text-[12px] font-semibold text-text-muted lg:grid ${GRILLE_FAMILLES}`}>
            {['Famille', 'État', 'Registre', 'Prochain numéro', 'Actes de l’année', ''].map((c, i) => (
              <span key={i} role="columnheader">
                {c || <span className="sr-only">Actions</span>}
              </span>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {f.familles.map((x) => (
            <LigneTableau key={x.code} grille={GRILLE_FAMILLES} testid="famille-acte">
              <span className="block">
                <b className="block font-semibold text-ink-900">{x.libelle}</b>
                <small className="block text-[12px] text-text-muted">signataire : {x.signataire}</small>
                {x.alerte && <small className={`block text-[12px] ${x.etat === 'BLOQUEE' ? 'text-clay' : 'text-ambre'}`}>{x.alerte}</small>}
              </span>
              <Pastille ton={ETAT_FAMILLE[x.etat].ton} testid="etat-famille">
                {ETAT_FAMILLE[x.etat].libelle}
              </Pastille>
              {f.droits.gerer ? (
                <select
                  aria-label={`Registre de la famille ${x.libelle}`}
                  value={x.registre?.id ?? ''}
                  onChange={(e) => agir(choisirRegistreFamille(x.code, e.target.value || null) as Promise<Familles>, 'Registre enregistré')}
                  className="h-9 max-w-full rounded-[9px] border border-line bg-surface px-2.5 text-[13px]"
                >
                  <option value="">— Aucun registre —</option>
                  {f.registresPossibles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.libelle}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-text-muted">{x.registre ? `${x.registre.code} — ${x.registre.libelle}` : 'Aucun registre'}</span>
              )}
              <span className="block truncate font-mono text-[12.5px]" data-testid="prochain-numero">{x.prochainNumero ?? '—'}</span>
              <span className="text-[13px]">{x.actesAnnee}</span>
              <span className="flex lg:justify-end">
                {x.action && (
                  <button type="button" className={BTN_LIGNE} title={x.action.effet} onClick={() => agir(registreAttenduFamille(x.code), x.action!.libelle)}>
                    {x.action.libelle}
                  </button>
                )}
              </span>
            </LigneTableau>
          ))}
        </div>
      </div>
    </Panneau>
  );
}

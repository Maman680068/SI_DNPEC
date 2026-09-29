'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { creerUnite, fermerUnite, getHistoriqueUnite, getOrganigramme, modifierUnite } from '../../lib/api/socle';
import type { EvenementUnite, Organigramme as Donnees, TypeUnite, UniteOrganigramme } from '../../lib/socle/types';
import { LIBELLE_EVENEMENT_UNITE } from '../../lib/socle/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Choix, Fenetre, Texte } from '../ui/Fenetre';

type Action =
  | { nature: 'creer'; parent: UniteOrganigramme }
  | { nature: 'modifier'; unite: UniteOrganigramme }
  | { nature: 'fermer'; unite: UniteOrganigramme }
  | { nature: 'historique'; unite: UniteOrganigramme };

const TON_TYPE: Record<TypeUnite, 'accent' | 'gold' | 'sage' | 'muted'> = {
  DIRECTION: 'accent',
  DIVISION: 'gold',
  SECTION: 'muted',
  CELLULE: 'sage',
  INSTANCE: 'sage',
};

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR');

/**
 * Organigramme (socle NIMBA, §3) : arbre des unités, responsable, suppléant,
 * effectif, état. Création, modification et fermeture selon les droits
 * renvoyés par l'API (DRH et administrateur) — le web n'en calcule aucun.
 */
export function Organigramme() {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voirFermees, setVoirFermees] = useState(false);
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<Action | null>(null);

  const charger = useCallback(() => {
    getOrganigramme()
      .then((d) => {
        setDonnees(d);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(charger, [charger]);

  const enfants = useMemo(() => {
    const m = new Map<string | null, UniteOrganigramme[]>();
    for (const u of donnees?.unites ?? []) {
      if (u.fermee && !voirFermees) continue;
      m.set(u.parentId, [...(m.get(u.parentId) ?? []), u]);
    }
    return m;
  }, [donnees, voirFermees]);

  if (!donnees) return <Chargement erreur={erreur} />;
  const racines = enfants.get(null) ?? [];
  const nbFermees = donnees.unites.filter((u) => u.fermee).length;

  const basculer = (id: string) =>
    setReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const noeud = (u: UniteOrganigramme, niveau: number) => {
    const sous = enfants.get(u.id) ?? [];
    const replie = replies.has(u.id);
    return (
      <li key={u.id} data-testid="unite" data-code={u.code}>
        <div
          className={`mb-2 flex flex-wrap items-start gap-3 rounded-md border border-line bg-surface px-3.5 py-3 ${u.fermee ? 'opacity-60' : ''}`}
          style={{ marginLeft: `min(${Math.min(niveau, 4) * 18}px, ${Math.min(niveau, 4) * 3}vw)` }}
        >
          {sous.length > 0 ? (
            <button
              type="button"
              onClick={() => basculer(u.id)}
              aria-expanded={!replie}
              aria-label={`${replie ? 'Déplier' : 'Replier'} ${u.code}`}
              className="mt-0.5 h-6 w-6 flex-shrink-0 rounded border border-line text-[12px] text-text-muted"
            >
              {replie ? '+' : '−'}
            </button>
          ) : (
            <span className="w-6 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-[14px] font-bold text-ink">{u.code}</span>
              <span className="text-[13.5px] text-text">{u.libelle}</span>
              <Badge tone={TON_TYPE[u.type]}>{u.libelleType.toUpperCase()}</Badge>
              {u.suspendue && !u.fermee && <Badge tone="clay">SUSPENDUE</Badge>}
              {u.fermee && <Badge tone="muted">FERMÉE LE {date(u.dateFermeture!)}</Badge>}
            </div>
            <div className="mt-1 text-[12.5px] text-text-muted">
              {u.responsable ? (
                <>
                  Responsable : <strong className="text-text">{u.responsable.firstName} {u.responsable.lastName}</strong>
                </>
              ) : (
                !u.fermee && <span className="text-clay">Pas de responsable désigné</span>
              )}
              {u.suppleant && (
                <> · Suppléant : {u.suppleant.firstName} {u.suppleant.lastName} (jusqu’au {date(u.suppleant.jusquau)})</>
              )}
              {' · '}
              {u.effectif} agent{u.effectif > 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-1.5 pl-9 sm:w-auto sm:pl-0">
            {u.droits.typesEnfants.length > 0 && (
              <Button className="!px-2.5 !py-1.5 !text-[12px]" onClick={() => setAction({ nature: 'creer', parent: u })}>
                + Sous-unité
              </Button>
            )}
            {u.droits.peutModifier && (
              <Button className="!px-2.5 !py-1.5 !text-[12px]" onClick={() => setAction({ nature: 'modifier', unite: u })}>
                Modifier
              </Button>
            )}
            {u.droits.peutFermer && (
              <Button
                className="!px-2.5 !py-1.5 !text-[12px]"
                title={u.droits.fermetureBloquee ?? undefined}
                onClick={() => setAction({ nature: 'fermer', unite: u })}
              >
                Fermer
              </Button>
            )}
            <Button className="!px-2.5 !py-1.5 !text-[12px]" onClick={() => setAction({ nature: 'historique', unite: u })}>
              Historique
            </Button>
          </div>
        </div>
        {!replie && sous.length > 0 && <ul>{sous.map((e) => noeud(e, niveau + 1))}</ul>}
      </li>
    );
  };

  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-[13px] text-text-muted">
          {donnees.droits.peutGerer
            ? 'Créez une division, une section, une cellule ou une instance, renommez-la ou fermez-la. Une unité ne se ferme que lorsqu’aucun agent n’y est plus rattaché ; son historique reste consultable.'
            : 'Unités de la DNPEC, avec leur responsable et leur effectif.'}
        </p>
        {nbFermees > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
            <input type="checkbox" checked={voirFermees} onChange={(e) => setVoirFermees(e.target.checked)} />
            Afficher les unités fermées ({nbFermees})
          </label>
        )}
      </div>
      <ul aria-label="Organigramme">{racines.map((u) => noeud(u, 0))}</ul>

      {action?.nature === 'creer' && (
        <FenetreCreation parent={action.parent} onClose={() => setAction(null)} onFait={() => { setAction(null); charger(); }} />
      )}
      {action?.nature === 'modifier' && (
        <FenetreModification unite={action.unite} onClose={() => setAction(null)} onFait={() => { setAction(null); charger(); }} />
      )}
      {action?.nature === 'fermer' && (
        <FenetreFermeture unite={action.unite} onClose={() => setAction(null)} onFait={() => { setAction(null); charger(); }} />
      )}
      {action?.nature === 'historique' && <FenetreHistorique unite={action.unite} onClose={() => setAction(null)} />}
    </div>
  );
}

function useEnvoi(onFait: () => void) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoyer = async (f: () => Promise<unknown>) => {
    setEnCours(true);
    setErreur(null);
    try {
      await f();
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue');
      setEnCours(false);
    }
  };
  return { enCours, erreur, envoyer };
}

function FenetreCreation({ parent, onClose, onFait }: { parent: UniteOrganigramme; onClose: () => void; onFait: () => void }) {
  const [type, setType] = useState<TypeUnite>(parent.droits.typesEnfants[0]!.type);
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi(onFait);
  return (
    <Fenetre
      titre={`Nouvelle unité sous ${parent.code}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Créer l’unité"
      onSubmit={() => envoyer(() => creerUnite({ type, parentId: parent.id, code: code.trim().toUpperCase(), libelle: libelle.trim() }))}
    >
      <Choix label="Type" value={type} onChange={(v) => setType(v as TypeUnite)} options={parent.droits.typesEnfants.map((t) => ({ value: t.type, label: t.libelle }))} />
      <Field label="Code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={20} />
      <p className="-mt-3 mb-4 text-[11.5px] text-text-faint">Lettres majuscules, chiffres ou tirets (ex. SGOP, CSID).</p>
      <Field label="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} required maxLength={150} />
    </Fenetre>
  );
}

function FenetreModification({ unite, onClose, onFait }: { unite: UniteOrganigramme; onClose: () => void; onFait: () => void }) {
  const [code, setCode] = useState(unite.code);
  const [libelle, setLibelle] = useState(unite.libelle);
  const [type, setType] = useState<TypeUnite>(unite.type);
  const { enCours, erreur, envoyer } = useEnvoi(onFait);
  return (
    <Fenetre
      titre={`Modifier ${unite.code}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      onSubmit={() => envoyer(() => modifierUnite(unite.id, { code: code.trim().toUpperCase(), libelle: libelle.trim(), ...(type !== unite.type ? { type } : {}) }))}
    >
      <Field label="Code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={20} />
      <Field label="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} required maxLength={150} />
      {unite.droits.typesPossibles.length > 0 && (
        <Choix label="Type" value={type} onChange={(v) => setType(v as TypeUnite)} options={unite.droits.typesPossibles.map((t) => ({ value: t.type, label: t.libelle }))} />
      )}
    </Fenetre>
  );
}

function FenetreFermeture({ unite, onClose, onFait }: { unite: UniteOrganigramme; onClose: () => void; onFait: () => void }) {
  const [motif, setMotif] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi(onFait);
  return (
    <Fenetre
      titre={`Fermer ${unite.code}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      danger
      libelleValider="Fermer l’unité"
      onSubmit={() => envoyer(() => fermerUnite(unite.id, { motif: motif.trim() }))}
    >
      <p className="mb-4 text-[13px] text-text-muted">
        La fermeture est définitive et datée d’aujourd’hui. L’unité disparaît des listes de choix ; son historique et ses documents restent consultables.
      </p>
      {unite.droits.fermetureBloquee && (
        <p className="mb-4 rounded-md bg-gold-soft px-3 py-2 text-[12.5px] text-ink">
          Fermeture impossible pour l’instant : {unite.droits.fermetureBloquee}.
        </p>
      )}
      <Texte label="Motif de la fermeture" value={motif} onChange={setMotif} required />
    </Fenetre>
  );
}

function FenetreHistorique({ unite, onClose }: { unite: UniteOrganigramme; onClose: () => void }) {
  const [lignes, setLignes] = useState<EvenementUnite[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getHistoriqueUnite(unite.id).then(setLignes).catch((e) => setErreur(messageChargement(e)));
  }, [unite.id]);
  const resume = (v: Record<string, unknown> | null) =>
    v ? Object.entries(v).filter(([k]) => !['origine', 'candidats', 'parentId', 'responsableId'].includes(k)).map(([k, x]) => `${k} : ${String(x)}`).join(', ') : '';
  return (
    <Fenetre titre={`Historique de ${unite.code}`} onClose={onClose} largeur={560}>
      <ErreurChargement message={erreur} />
      {!lignes ? (
        !erreur && <p className="text-[13px] text-text-muted">Chargement…</p>
      ) : (
        <ul className="mb-2 space-y-2">
          {lignes.map((l) => (
            <li key={l.id} className="rounded-md border border-line px-3 py-2 text-[12.5px]">
              <div className="font-semibold text-text">
                {LIBELLE_EVENEMENT_UNITE[l.evenement] ?? l.evenement} — {date(l.dateEffet)}
                <span className="font-normal text-text-muted"> · {l.auteur ? `${l.auteur.firstName} ${l.auteur.lastName}` : 'Système'}</span>
              </div>
              {(l.avant || l.apres) && (
                <div className="mt-0.5 break-words text-text-muted">
                  {l.avant && resume(l.avant) && <>Avant : {resume(l.avant)}. </>}
                  {l.apres && resume(l.apres) && <>Après : {resume(l.apres)}.</>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Fenetre>
  );
}

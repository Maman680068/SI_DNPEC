'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { creerUnite, fermerUnite, getHistoriqueUnite, getOrganigramme, modifierUnite } from '../../lib/api/socle';
import type { EvenementUnite, Organigramme as Donnees, TypeUnite, UniteOrganigramme } from '../../lib/socle/types';
import { LIBELLE_EVENEMENT_UNITE } from '../../lib/socle/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { BandeCompteurs, BarreOutils, Filtres, BTN_DANGER_CONTOUR, BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, EtatVide, Pastille, Recherche, SectionFenetre } from '../ui/Charte';
import { FenetreDetail } from '../ui/FenetreDetail';
import { Fenetre, Texte } from '../ui/Fenetre';
import { ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie } from '../ui/Formulaire';
import { SqueletteListe } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';
import { MenuActions } from '../ui/MenuActions';

type Action =
  | { nature: 'creer'; parent: UniteOrganigramme }
  | { nature: 'modifier'; unite: UniteOrganigramme }
  | { nature: 'fermer'; unite: UniteOrganigramme };

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR');
const nomDe = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : null);

/**
 * Organigramme (socle NIMBA, §3) : arbre des unités, responsable, suppléant,
 * effectif, état. Création, modification et fermeture selon les droits
 * renvoyés par l'API (DRH et administrateur) — le web n'en calcule aucun.
 * Une unité s'ouvre (« Voir ») dans une fenêtre deux colonnes : historique à
 * gauche, actions et informations à droite.
 */
export function Organigramme() {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voirFermees, setVoirFermees] = useState(false);
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<Action | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const toast = useToast();

  const charger = useCallback(() => {
    getOrganigramme()
      .then((d) => {
        setDonnees(d);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(charger, [charger]);

  const q = recherche.trim().toLowerCase();
  const enfants = useMemo(() => {
    const m = new Map<string | null, UniteOrganigramme[]>();
    for (const u of donnees?.unites ?? []) {
      if (u.fermee && !voirFermees) continue;
      m.set(u.parentId, [...(m.get(u.parentId) ?? []), u]);
    }
    return m;
  }, [donnees, voirFermees]);
  // Recherche : une unité reste affichée si elle correspond ou si l'une de ses sous-unités correspond.
  const visibles = useMemo(() => {
    if (!q) return null;
    const ok = new Set<string>();
    const parcourir = (u: UniteOrganigramme): boolean => {
      const sous = (enfants.get(u.id) ?? []).map(parcourir).some(Boolean);
      const lui = `${u.code} ${u.libelle} ${nomDe(u.responsable) ?? ''}`.toLowerCase().includes(q);
      if (lui || sous) ok.add(u.id);
      return lui || sous;
    };
    (enfants.get(null) ?? []).forEach(parcourir);
    return ok;
  }, [enfants, q]);

  if (!donnees) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} lignes={8} /></>;
  const racines = (enfants.get(null) ?? []).filter((u) => !visibles || visibles.has(u.id));
  const actives = donnees.unites.filter((u) => !u.fermee);
  const nbFermees = donnees.unites.length - actives.length;
  const nb = (t: TypeUnite[]) => actives.filter((u) => t.includes(u.type)).length;
  const sansResponsable = actives.filter((u) => !u.responsable).length;
  const uniteOuverte = donnees.unites.find((u) => u.id === ouverte) ?? null;

  const basculer = (id: string) =>
    setReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const noeud = (u: UniteOrganigramme, niveau: number) => {
    const sous = (enfants.get(u.id) ?? []).filter((e) => !visibles || visibles.has(e.id));
    const replie = replies.has(u.id) && !visibles;
    return (
      <li key={u.id} data-testid="unite" data-code={u.code}>
        <div
          className={`flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-[#F0F1F6] py-2.5 pr-4 lg:items-center ${u.fermee ? 'opacity-60' : ''}`}
          style={{ paddingLeft: `calc(16px + min(${Math.min(niveau, 4) * 22}px, ${Math.min(niveau, 4) * 4}vw))` }}
        >
          {sous.length > 0 ? (
            <button
              type="button"
              onClick={() => basculer(u.id)}
              aria-expanded={!replie}
              aria-label={`${replie ? 'Déplier' : 'Replier'} ${u.code}`}
              className="grid h-6 w-6 flex-none place-items-center rounded-[7px] border border-line text-text-muted hover:bg-bg"
            >
              {replie ? <ChevronRight aria-hidden size={14} /> : <ChevronDown aria-hidden size={14} />}
            </button>
          ) : (
            <span className="w-6 flex-none" />
          )}
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-[14px] font-bold text-ink-900">{u.code}</span>
              <span className="text-[13.5px] text-text">{u.libelle}</span>
              <span className="rounded-[5px] border border-line px-1.5 py-px text-[10.5px] font-bold tracking-wide text-text-muted">{u.libelleType.toUpperCase()}</span>
              {u.suspendue && !u.fermee && <Pastille ton="rouge">Suspendue</Pastille>}
              {u.fermee && <Pastille ton="gris">{`Fermée le ${date(u.dateFermeture!)}`}</Pastille>}
            </div>
            <div className="mt-0.5 text-[12.5px] text-text-muted">
              {u.responsable ? (
                <>
                  Responsable : <strong className="font-semibold text-text">{nomDe(u.responsable)}</strong>
                </>
              ) : (
                !u.fermee && <span className="font-semibold text-clay">Pas de responsable désigné</span>
              )}
              {u.suppleant && (
                <> · Suppléant : {nomDe(u.suppleant)} (jusqu’au {date(u.suppleant.jusquau)})</>
              )}
              {' · '}
              {u.effectif} agent{u.effectif > 1 ? 's' : ''}
            </div>
          </div>
          {/* Un bouton visible (« Voir »), les autres actions dans « Plus d'actions ». */}
          <div className="flex flex-none items-center gap-1.5 pl-9 sm:pl-0">
            <button type="button" className={BTN_LIGNE} onClick={() => setOuverte(u.id)} aria-label={`Voir ${u.code} (historique)`}>
              Voir
            </button>
            <MenuActions
              libelle={`Plus d’actions pour ${u.code}`}
              actions={[
                ...(u.droits.typesEnfants.length > 0 ? [{ label: 'Ajouter une sous-unité', onSelect: () => setAction({ nature: 'creer', parent: u }) }] : []),
                ...(u.droits.peutModifier ? [{ label: 'Modifier', onSelect: () => setAction({ nature: 'modifier', unite: u }) }] : []),
                ...(u.droits.peutFermer ? [{ label: 'Fermer', danger: true, aide: u.droits.fermetureBloquee ?? undefined, onSelect: () => setAction({ nature: 'fermer', unite: u }) }] : []),
              ]}
            />
          </div>
        </div>
        {!replie && sous.length > 0 && <ul>{sous.map((e) => noeud(e, niveau + 1))}</ul>}
      </li>
    );
  };

  return (
    <div>
      <ErreurChargement message={erreur} />
      <BandeCompteurs
        label="Synthèse de l’organigramme"
        items={[
          { valeur: actives.length, label: 'Unités actives', sous: `${nb(['DIVISION'])} divisions · ${nb(['SECTION'])} sections`, testid: 'compteur-unites' },
          { valeur: nb(['CELLULE', 'INSTANCE']), label: 'Cellules et instances', sous: 'rattachées à la Direction ou à une unité', testid: 'compteur-cellules' },
          { valeur: actives.reduce((t, u) => t + u.effectif, 0), label: 'Agents rattachés', sous: 'effectif des unités actives', testid: 'compteur-effectif' },
          { valeur: sansResponsable, label: 'Sans responsable', sous: 'unités actives sans responsable désigné', ton: sansResponsable ? 'rouge' : 'encre', testid: 'compteur-sans-responsable' },
        ]}
      />
      <BarreOutils>
        <Recherche value={recherche} onChange={setRecherche} placeholder="Code, libellé, responsable…" label="Rechercher une unité" />
        {nbFermees > 0 && (
          <Filtres actifs={voirFermees ? 1 : 0} onEffacer={() => setVoirFermees(false)}>
            <label className="flex items-center gap-2 text-[13px] text-text-muted md:ml-auto md:text-[12.5px]">
              <input type="checkbox" checked={voirFermees} onChange={(e) => setVoirFermees(e.target.checked)} className="h-4 w-4 accent-ink" />
              Afficher les unités fermées ({nbFermees})
            </label>
          </Filtres>
        )}
      </BarreOutils>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {racines.length === 0 ? (
          <EtatVide texte="Aucune unité ne correspond à la recherche." action={<button type="button" className={BTN_SECONDAIRE} onClick={() => setRecherche('')}>Effacer la recherche</button>} />
        ) : (
          <ul aria-label="Organigramme" className="-mb-px">
            {racines.map((u) => noeud(u, 0))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-text-muted">
          {donnees.droits.peutGerer
            ? 'Créez une division, une section, une cellule ou une instance, renommez-la ou fermez-la. Une unité ne se ferme que lorsqu’aucun agent n’y est plus rattaché ; son historique reste consultable.'
            : 'Unités de la DNPEC, avec leur responsable et leur effectif.'}
        </p>
      </div>

      {uniteOuverte && (
        <FenetreUnite
          unite={uniteOuverte}
          parent={donnees.unites.find((x) => x.id === uniteOuverte.parentId) ?? null}
          onClose={() => setOuverte(null)}
          onAction={(a) => setAction(a)}
        />
      )}
      {action?.nature === 'creer' && (
        <FenetreCreation
          parent={action.parent}
          onClose={() => setAction(null)}
          onFait={(code) => {
            setAction(null);
            charger();
            toast.succes('Unité créée', { detail: `${code}, sous ${action.parent.code}.` });
          }}
        />
      )}
      {action?.nature === 'modifier' && (
        <FenetreModification
          unite={action.unite}
          onClose={() => setAction(null)}
          onFait={() => {
            setAction(null);
            charger();
            toast.succes('Unité modifiée', { detail: 'La modification est inscrite à l’historique.' });
          }}
        />
      )}
      {action?.nature === 'fermer' && (
        <FenetreFermeture
          unite={action.unite}
          onClose={() => setAction(null)}
          onFait={() => {
            setAction(null);
            setOuverte(null);
            charger();
            toast.succes('Unité fermée', { detail: `${action.unite.code} reste consultable dans les unités fermées.` });
          }}
        />
      )}
    </div>
  );
}

/** Fenêtre d'une unité : historique à gauche ; actions (selon les droits renvoyés) et informations à droite. */
function FenetreUnite({ unite, parent, onClose, onAction }: { unite: UniteOrganigramme; parent: UniteOrganigramme | null; onClose: () => void; onAction: (a: Action) => void }) {
  const [lignes, setLignes] = useState<EvenementUnite[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getHistoriqueUnite(unite.id).then(setLignes).catch((e) => setErreur(messageChargement(e)));
  }, [unite.id]);
  const resume = (v: Record<string, unknown> | null) =>
    v ? Object.entries(v).filter(([k]) => !['origine', 'candidats', 'parentId', 'responsableId'].includes(k)).map(([k, x]) => `${k} : ${String(x)}`).join(', ') : '';
  const gere = unite.droits.typesEnfants.length > 0 || unite.droits.peutModifier || unite.droits.peutFermer;
  return (
    <FenetreDetail
      titre={`${unite.code} — ${unite.libelle}`}
      filAriane={['Organisation', parent ? parent.code : null]}
      onClose={onClose}
      largeur={880}
      testid="fiche-unite"
      cote={
        <div>
          {gere ? (
            <div className="grid gap-2">
              {unite.droits.typesEnfants.length > 0 && (
                <button type="button" className={BTN_PRINCIPAL} onClick={() => onAction({ nature: 'creer', parent: unite })}>
                  <Plus aria-hidden size={16} /> Créer une sous-unité
                </button>
              )}
              {unite.droits.peutModifier && (
                <button type="button" className={BTN_SECONDAIRE} onClick={() => onAction({ nature: 'modifier', unite })}>
                  Modifier
                </button>
              )}
              {unite.droits.peutFermer && (
                <button type="button" className={BTN_DANGER_CONTOUR} onClick={() => onAction({ nature: 'fermer', unite })}>
                  Fermer l’unité
                </button>
              )}
              <p className="mt-1 text-[12px] text-text-muted">
                {unite.droits.fermetureBloquee ? `Fermeture impossible pour l’instant : ${unite.droits.fermetureBloquee}.` : 'Une unité fermée disparaît des listes de choix ; son historique reste consultable.'}
              </p>
            </div>
          ) : (
            <p className="text-[12.5px] text-text-muted">Lecture seule : l’organigramme est géré par le DRH et l’administrateur.</p>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <CleValeur
              largeur={96}
              lignes={[
                ['Type', unite.libelleType],
                ['Rattachée à', parent ? `${parent.code} — ${parent.libelle}` : '—'],
                ['Responsable', nomDe(unite.responsable) ?? 'Non désigné'],
                ...(unite.suppleant ? ([['Suppléant', `${nomDe(unite.suppleant)} (jusqu’au ${date(unite.suppleant.jusquau)})`]] as [string, string][]) : []),
                ['Effectif', `${unite.effectif} agent${unite.effectif > 1 ? 's' : ''}`],
                ['Créée le', date(unite.dateCreation)],
                ...(unite.fermee && unite.dateFermeture ? ([['Fermée le', date(unite.dateFermeture)]] as [string, string][]) : []),
              ]}
            />
          </div>
        </div>
      }
    >
      <SectionFenetre titre="Historique" n={lignes?.length}>
        <ErreurChargement message={erreur} />
        {!lignes ? (
          !erreur && <SqueletteListe lignes={3} colonnes={1} />
        ) : lignes.length === 0 ? (
          <p className="text-[13px] text-text-muted">Aucun événement enregistré.</p>
        ) : (
          <ol className="space-y-2" data-testid="historique-unite">
            {lignes.map((l) => (
              <li key={l.id} className="rounded-[10px] border border-line px-3 py-2 text-[12.5px]">
                <div className="font-semibold text-text">
                  {LIBELLE_EVENEMENT_UNITE[l.evenement] ?? l.evenement} — {date(l.dateEffet)}
                  <span className="font-normal text-text-muted"> · {l.auteur ? nomDe(l.auteur) : 'Système'}</span>
                </div>
                {(l.avant || l.apres) && (
                  <div className="mt-0.5 break-words text-text-muted">
                    {l.avant && resume(l.avant) && <>Avant : {resume(l.avant)}. </>}
                    {l.apres && resume(l.apres) && <>Après : {resume(l.apres)}.</>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </SectionFenetre>
      {unite.motifFermeture && (
        <SectionFenetre titre="Motif de la fermeture">
          <p className="text-[13.5px]">{unite.motifFermeture}</p>
        </SectionFenetre>
      )}
    </FenetreDetail>
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
      setErreur(messageErreur(e));
      setEnCours(false);
    }
  };
  return { enCours, erreur, envoyer };
}

const AIDE_CODE = 'Lettres majuscules, chiffres ou tirets (ex. SGOP, CSID).';

function FenetreCreation({ parent, onClose, onFait }: { parent: UniteOrganigramme; onClose: () => void; onFait: (code: string) => void }) {
  const [type, setType] = useState<TypeUnite>(parent.droits.typesEnfants[0]!.type);
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi(() => onFait(code.trim().toUpperCase()));
  const types = parent.droits.typesEnfants.map((t) => ({ value: t.type, label: t.libelle }));
  return (
    <FenetreFormulaire
      titre="Nouvelle unité"
      sousTitre={`Rattachée à ${parent.code} — ${parent.libelle}`}
      onClose={onClose}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Créer l’unité"
      pied="L’unité apparaît aussitôt dans l’organigramme et les listes de choix."
      onSubmit={() => envoyer(() => creerUnite({ type, parentId: parent.id, code: code.trim().toUpperCase(), libelle: libelle.trim() }))}
    >
      {types.length > 1 && types.length <= 5 ? (
        <ChoixSegment<TypeUnite> id="un-type" label="Type" options={types} value={type} onChange={setType} />
      ) : (
        <Liste id="un-type" label="Type" value={type} onChange={(v) => setType(v as TypeUnite)} options={types} />
      )}
      <Grille2>
        <Saisie id="un-code" label="Code" value={code} onChange={setCode} required maxLength={20} aide={AIDE_CODE} />
        <Saisie id="un-libelle" label="Libellé" value={libelle} onChange={setLibelle} required maxLength={150} />
      </Grille2>
    </FenetreFormulaire>
  );
}

function FenetreModification({ unite, onClose, onFait }: { unite: UniteOrganigramme; onClose: () => void; onFait: () => void }) {
  const [code, setCode] = useState(unite.code);
  const [libelle, setLibelle] = useState(unite.libelle);
  const [type, setType] = useState<TypeUnite>(unite.type);
  const { enCours, erreur, envoyer } = useEnvoi(onFait);
  const types = unite.droits.typesPossibles.map((t) => ({ value: t.type, label: t.libelle }));
  return (
    <FenetreFormulaire
      titre="Modifier l’unité"
      sousTitre={`${unite.code} — ${unite.libelle}`}
      onClose={onClose}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Enregistrer"
      pied="La modification est inscrite à l’historique de l’unité."
      onSubmit={() => envoyer(() => modifierUnite(unite.id, { code: code.trim().toUpperCase(), libelle: libelle.trim(), ...(type !== unite.type ? { type } : {}) }))}
    >
      <Grille2>
        <Saisie id="un-code" label="Code" value={code} onChange={setCode} required maxLength={20} aide={AIDE_CODE} />
        <Saisie id="un-libelle" label="Libellé" value={libelle} onChange={setLibelle} required maxLength={150} />
      </Grille2>
      {types.length > 0 &&
        (types.length <= 5 ? (
          <ChoixSegment<TypeUnite> id="un-type" label="Type" options={types} value={type} onChange={setType} />
        ) : (
          <Liste id="un-type" label="Type" value={type} onChange={(v) => setType(v as TypeUnite)} options={types} />
        ))}
    </FenetreFormulaire>
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
      pied="La fermeture est définitive et datée d’aujourd’hui."
      onSubmit={() => envoyer(() => fermerUnite(unite.id, { motif: motif.trim() }))}
    >
      <p className="mb-4 text-[13px] text-text">
        L’unité disparaît des listes de choix ; son historique et ses documents restent consultables.
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

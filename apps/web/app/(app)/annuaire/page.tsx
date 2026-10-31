'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, List, MessageSquare, Plus } from 'lucide-react';
import { CreateTaskModal } from '../../../components/tasks/CreateTaskModal';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getAnnuaire, getFicheAnnuaire, type Annuaire, type EtatDuJour, type FicheAnnuaire, type PersonneAnnuaireV1 } from '../../../lib/api/org';
import { motsTapes, surligner } from '../../../lib/recherche/surligner';
import { BarreOutils, BTN_SECONDAIRE, EnTetePage, EtatVide, Initiales, initialesDe, LigneTableau, Pastille, Recherche, Tableau } from '../../../components/ui/Charte';
import { FenetreDetail } from '../../../components/ui/FenetreDetail';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { SqueletteCartes } from '../../../components/ui/Squelette';

type Vue = 'unites' | 'liste';
const GRILLE = 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_120px_120px]';
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const LIBELLE_ETAT: Record<Exclude<EtatDuJour, null>, string> = { EN_CONGE: 'En congé', EN_MISSION: 'En mission' };

/** État du jour (sans motif ni type de congé) et intérim, calculés par l'API. */
function Etat({ p }: { p: { etat: EtatDuJour; supplee: string | null } }) {
  return (
    <span className="flex flex-wrap gap-1">
      {p.etat && (
        <Pastille ton={p.etat === 'EN_CONGE' ? 'ambre' : 'bleu'} testid="etat-du-jour">
          {LIBELLE_ETAT[p.etat]}
        </Pastille>
      )}
      {p.supplee && (
        <Pastille ton="encre" testid="interim">
          Intérim : supplée {p.supplee}
        </Pastille>
      )}
    </span>
  );
}

/**
 * Annuaire (S4) : vue « Par unité » par défaut — un bloc par unité (sigle, chef, nombre d'agents), le chef
 * ou le DN et la DNA en tête (fond doré, badge), cartes de personnes ; colonne des sigles (unités non vides ;
 * les autres repliées) ; fiche à droite au clic ; vue « Liste » conservée. Recherche, état du jour et
 * compteur des disponibles : calculés par l'API (`api/v1/annuaire`).
 */
export default function AnnuairePage() {
  const { user } = useAuth();
  const [a, setA] = useState<Annuaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [resultats, setResultats] = useState<string[] | null>(null);
  const [vue, setVue] = useState<Vue>('unites');
  const [choisi, setChoisi] = useState<string | null>(null);
  const [large, setLarge] = useState(true);

  useEffect(() => {
    getAnnuaire()
      .then(setA)
      .catch((err) => setErreur(messageChargement(err)));
    // Lien de la recherche transverse (socle N5) : « /annuaire?q=<nom> ».
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
    // Fiche dans une colonne à droite à partir de 1280 px, dans une fenêtre en dessous.
    const m = window.matchMedia('(min-width: 1280px)');
    setLarge(m.matches);
    const suivre = () => setLarge(m.matches);
    m.addEventListener('change', suivre);
    return () => m.removeEventListener('change', suivre);
  }, []);

  // Recherche à chaque lettre : l'API renvoie les personnes trouvées, dans l'ordre (débuts de mot d'abord).
  useEffect(() => {
    if (!query.trim()) {
      setResultats(null);
      return;
    }
    let annule = false;
    const t = setTimeout(
      () =>
        getAnnuaire(query)
          .then((r) => !annule && setResultats(r.resultats ?? []))
          .catch(() => !annule && setResultats([])),
      80,
    );
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [query]);

  const parId = useMemo(() => new Map((a?.personnes ?? []).map((p) => [p.id, p])), [a]);
  const mots = motsTapes(query);
  const garde = (id: string) => !resultats || resultats.includes(id);
  const unitesVues = (a?.unites ?? []).filter((u) => u.nombre > 0);
  const unitesVides = (a?.unites ?? []).filter((u) => u.nombre === 0);
  const blocs = unitesVues.map((u) => ({ ...u, vus: u.membres.filter(garde).map((id) => parId.get(id)!).filter(Boolean) })).filter((u) => u.vus.length > 0);
  const liste = resultats ? resultats.map((id) => parId.get(id)!).filter(Boolean) : a?.personnes ?? [];

  const message = (p: PersonneAnnuaireV1, compact = true) =>
    p.id !== user?.id && (
      <Link href={`/communication?with=${p.id}`} onClick={(e) => e.stopPropagation()} className={compact ? 'grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-line bg-surface text-ink hover:bg-bg' : `${BTN_SECONDAIRE} !h-[34px] !px-2.5 !text-[13px]`} aria-label={`Envoyer un message à ${p.prenom} ${p.nom}`} title="Message">
        <MessageSquare aria-hidden size={15} />
        {!compact && 'Message'}
      </Link>
    );

  const carte = (p: PersonneAnnuaireV1) => (
    <li key={p.id} data-testid="personne-annuaire" data-chef={p.badge ? 'oui' : undefined} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${p.badge ? 'border-gold-bord bg-gold-50' : 'border-line bg-surface'} ${choisi === p.id ? 'ring-2 ring-ink' : ''}`}>
      <Initiales texte={initialesDe(p.prenom, p.nom)} taille={42} />
      <button type="button" onClick={() => setChoisi(p.id)} className="min-w-0 flex-1 text-left" aria-label={`Voir la fiche de ${p.prenom} ${p.nom}`}>
        <b className="block text-[14px] font-bold leading-tight text-ink-900">{surligner(`${p.prenom} ${p.nom}`, mots)}</b>
        <span className="block truncate text-[12.5px] text-text-muted">
          {surligner(p.fonction, mots)}
          {p.section ? <> · {surligner(p.section, mots)}</> : null}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {p.badge && (
            <Pastille ton="encre" testid="badge-chef">
              {p.badge}
            </Pastille>
          )}
          <Etat p={p} />
        </span>
      </button>
      {message(p)}
    </li>
  );

  const fiche = choisi ? <FicheAnnuairePanneau id={choisi} onClose={() => setChoisi(null)} /> : null;

  return (
    <div>
      <EnTetePage
        titre="Annuaire"
        sousTitre={
          a ? (
            <span>
              {pluriel(a.total, 'personne')} · <b data-testid="compteur-disponibles">{pluriel(a.disponibles, 'disponible')} aujourd’hui</b>
            </span>
          ) : undefined
        }
      />
      <ErreurChargement message={erreur} />
      <BarreOutils
        droite={
          <div role="group" aria-label="Affichage" className="flex rounded-[9px] border border-line bg-surface p-[3px]">
            {(
              [
                ['unites', 'Par unité', Building2],
                ['liste', 'Liste', List],
              ] as const
            ).map(([cle, libelle, Icone]) => (
              <button key={cle} type="button" aria-pressed={vue === cle} onClick={() => setVue(cle)} className={`flex h-7 items-center gap-1.5 rounded-[6px] px-[11px] text-[13px] font-semibold ${vue === cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}>
                <Icone aria-hidden size={14} /> {libelle}
              </button>
            ))}
          </div>
        }
      >
        <Recherche value={query} onChange={setQuery} placeholder="Nom, fonction, unité, sigle…" label="Rechercher un nom, une fonction, une unité ou un sigle" />
      </BarreOutils>

      {!a ? (
        erreur ? <Chargement erreur={erreur} /> : <SqueletteCartes cartes={6} />
      ) : vue === 'liste' ? (
        <Tableau label="Annuaire" testid="annuaire" grille={GRILLE} colonnes={['Personne', 'Fonction', 'Unité', 'Aujourd’hui', <span key="a" className="sr-only">Actions</span>]} vide={<EtatVide texte="Aucune personne ne correspond." />}>
          {liste.map((p) => (
            <LigneTableau key={p.id} grille={GRILLE} testid="personne-annuaire" label={`${p.prenom} ${p.nom}`} onClick={() => setChoisi(p.id)}>
              <span className="flex items-center gap-2.5">
                <Initiales texte={initialesDe(p.prenom, p.nom)} />
                <b className="truncate font-semibold text-ink-900">{surligner(`${p.prenom} ${p.nom}`, mots)}</b>
              </span>
              <span className="block truncate">{p.fonction}</span>
              <span className="block truncate text-text-muted">{[p.sigle, p.section].filter(Boolean).join(' · ') || '—'}</span>
              <Etat p={p} />
              <span className="flex lg:justify-end">{message(p, false)}</span>
            </LigneTableau>
          ))}
        </Tableau>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-[170px_minmax(0,1fr)_320px]">
          {/* Sigles : colonne sur écran large, boutons qui défilent sur téléphone. */}
          <nav aria-label="Unités" data-testid="sigles-unites" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:sticky lg:top-3 lg:mx-0 lg:block lg:overflow-visible lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-2">
            {unitesVues.map((u) => (
              <a key={u.id} href={`#unite-${u.id}`} className="flex flex-none items-center justify-between gap-2 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-text hover:bg-bg lg:border-0 lg:bg-transparent">
                <span>{u.sigle}</span>
                <span className="text-[12px] font-normal text-text-muted">{u.nombre}</span>
              </a>
            ))}
            {unitesVides.length > 0 && (
              <details className="flex-none lg:mt-2 lg:border-t lg:border-line-doux lg:pt-2" data-testid="unites-vides">
                <summary className="flex cursor-pointer items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold text-text-muted">
                  Unités sans agent ({unitesVides.length}) <ChevronDown aria-hidden size={13} />
                </summary>
                <ul className="px-2.5 pb-1 text-[12.5px] text-text-muted">
                  {unitesVides.map((u) => (
                    <li key={u.id}>
                      {u.sigle} — {u.libelle}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </nav>
          <div className="min-w-0 space-y-4" data-testid="annuaire">
            {blocs.length === 0 && (
              <div className="rounded-xl border border-line bg-surface">
                <EtatVide texte="Aucune personne ne correspond." />
              </div>
            )}
            {blocs.map((u) => (
              <section key={u.id} id={`unite-${u.id}`} aria-label={`${u.sigle} — ${u.libelle}`} data-testid="bloc-unite" className="scroll-mt-4 rounded-xl border border-line bg-surface p-3.5">
                <h2 className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="font-heading text-[16px] font-extrabold text-ink-900">{u.sigle}</span>
                  <span className="text-[13.5px] font-semibold text-text">{u.libelle}</span>
                  <span className="text-[12.5px] text-text-muted">
                    {u.chef ? `Chef : ${u.chef}` : 'Pas de chef'} · {pluriel(u.nombre, 'agent')}
                  </span>
                </h2>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{u.vus.map(carte)}</ul>
              </section>
            ))}
          </div>
          {large && <aside className="sticky top-3" data-testid="fiche-annuaire-colonne">{fiche ?? <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-text-muted">Choisissez une personne pour voir sa fiche.</p>}</aside>}
        </div>
      )}
      {choisi && (!large || vue === 'liste') && (
        <FenetreDetail titre="Fiche de l’annuaire" onClose={() => setChoisi(null)} largeur={520} sansEntete>
          <FicheAnnuairePanneau id={choisi} onClose={() => setChoisi(null)} />
        </FenetreDetail>
      )}
    </div>
  );
}

function FicheAnnuairePanneau({ id, onClose }: { id: string; onClose: () => void }) {
  const [f, setF] = useState<FicheAnnuaire | null>(null);
  const [assigner, setAssigner] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    setF(null);
    getFicheAnnuaire(id)
      .then(setF)
      .catch((e) => setErreur(messageChargement(e)));
  }, [id]);
  if (!f) return <Chargement erreur={erreur} />;
  return (
    <div className="rounded-xl border border-line bg-surface p-4" data-testid="fiche-annuaire">
      <div className="mb-3 flex items-center gap-3">
        <Initiales texte={initialesDe(f.prenom, f.nom)} taille={48} />
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-bold text-ink-900">
            {f.prenom} {f.nom}
          </b>
          <span className="block text-[12.5px] text-text-muted">{f.fonction}</span>
        </div>
        <button type="button" onClick={onClose} className="text-[12.5px] font-semibold text-text-muted hover:text-ink">
          Fermer
        </button>
      </div>
      <Etat p={f} />
      <dl className="mt-3 space-y-2 text-[13px]">
        <div>
          <dt className="font-semibold text-text-muted">Unité</dt>
          <dd>{f.unite}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">Rend compte à</dt>
          <dd data-testid="rend-compte-a">{f.rendCompteA.length ? f.rendCompteA.join(' ou ') : '—'}</dd>
        </div>
        {f.suppleant && (
          <div>
            <dt className="font-semibold text-text-muted">Suppléant en ce moment</dt>
            <dd>{f.suppleant}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-text-muted">Équipe ({f.equipe.length})</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {f.equipe.map((e) => (
              <span key={e.id} title={e.nom}>
                <Initiales texte={initialesDe(e.nom.split(' ')[0], e.nom.split(' ').slice(1).join(' '))} taille={28} />
              </span>
            ))}
          </dd>
        </div>
      </dl>
      {f.peutEcrire && (
        <Link href={`/communication?with=${f.id}`} className={`${BTN_SECONDAIRE} mt-4 w-full justify-center`} data-testid="fiche-message">
          <MessageSquare aria-hidden size={15} /> Message
        </Link>
      )}
      {f.peutAssigner && (
        <button type="button" className={`${BTN_SECONDAIRE} mt-2 w-full justify-center`} onClick={() => setAssigner(true)}>
          <Plus aria-hidden size={15} /> Assigner une tâche
        </button>
      )}
      {assigner && <CreateTaskModal presetAssignee={{ id: f.id, firstName: f.prenom, lastName: f.nom, jobTitle: f.fonction }} onClose={() => setAssigner(false)} onCreated={() => setAssigner(false)} />}
    </div>
  );
}

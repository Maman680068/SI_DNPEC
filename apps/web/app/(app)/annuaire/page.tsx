'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, MessageSquare } from 'lucide-react';
import { useOrg } from '../../../lib/org/OrgProvider';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { ROLE_LABEL } from '../../../lib/users/types';
import { getDirectory } from '../../../lib/api/org';
import type { DirectoryUser as PersonneAnnuaire } from '../../../lib/org/types';
import { BarreOutils, BTN_SECONDAIRE, EnTetePage, EtatVide, FiltreSelect, Initiales, initialesDe, LigneTableau, Recherche, Tableau } from '../../../components/ui/Charte';
import { PersonDetailModal } from '../../../components/directory/PersonDetailModal';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

/** Unité choisie dans l'arbre (ou le menu sur téléphone) : un utilisateur est rattaché à une
 * division (et éventuellement une section) OU à une cellule, jamais aux deux (voir schema.prisma) ;
 * « direction » = personnes sans division ni cellule (DN, DNA, assistants, administrateur…). */
type Unite = { kind: 'all' } | { kind: 'direction' } | { kind: 'division'; id: string } | { kind: 'section'; id: string } | { kind: 'cellule'; id: string };
type Vue = 'cartes' | 'liste';

const encoder = (u: Unite) => (u.kind === 'all' ? '' : u.kind === 'direction' ? 'direction' : `${u.kind}:${u.id}`);
function decoder(v: string): Unite {
  if (!v) return { kind: 'all' };
  if (v === 'direction') return { kind: 'direction' };
  const [kind, id] = v.split(':');
  return { kind, id } as Unite;
}
function dansUnite(p: PersonneAnnuaire, u: Unite): boolean {
  switch (u.kind) {
    case 'all':
      return true;
    case 'direction':
      return !p.divisionId && !p.celluleId;
    case 'division':
      return p.divisionId === u.id;
    case 'section':
      return p.sectionId === u.id;
    case 'cellule':
      return p.celluleId === u.id;
  }
}

const GRILLE = 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_190px]';
const BTN_ICONE = 'grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-line bg-surface text-ink hover:bg-bg';
const fonctionDe = (p: PersonneAnnuaire) => p.jobTitle ?? ROLE_LABEL[p.role as keyof typeof ROLE_LABEL] ?? p.role;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function AnnuairePage() {
  const { divisions, sections, cellules, getDivisionName, getSectionName, getCelluleName } = useOrg();
  const { user } = useAuth();
  const [people, setPeople] = useState<PersonneAnnuaire[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [fonction, setFonction] = useState('');
  const [unite, setUnite] = useState<Unite>({ kind: 'all' });
  const [vue, setVue] = useState<Vue>('cartes');
  const [selected, setSelected] = useState<PersonneAnnuaire | null>(null);

  useEffect(() => {
    getDirectory().then(setPeople).catch((err) => setErreurChargement(messageChargement(err)));
    // Lien de la recherche transverse (socle N5) : « /annuaire?q=<nom> ».
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);

  const uniteDe = (p: PersonneAnnuaire) =>
    p.celluleId ? getCelluleName(p.celluleId) : p.sectionId ? getSectionName(p.sectionId) || getDivisionName(p.divisionId) : p.divisionId ? getDivisionName(p.divisionId) : 'Direction';

  const fonctions = useMemo(() => [...new Set((people ?? []).map(fonctionDe))].sort((a, b) => a.localeCompare(b, 'fr')), [people]);

  const q = query.trim().toLowerCase();
  const filtered = (people ?? []).filter(
    (p) =>
      dansUnite(p, unite) &&
      (!fonction || fonctionDe(p) === fonction) &&
      (!q || `${p.firstName} ${p.lastName} ${fonctionDe(p)} ${uniteDe(p)}`.toLowerCase().includes(q)),
  );

  // Arbre des unités : unités actives, effectif compté sur l'annuaire (simple décompte).
  const compte = (u: Unite) => (people ?? []).filter((p) => dansUnite(p, u)).length;
  const divisionsActives = divisions.filter((d) => d.isActive);
  const cellulesActives = cellules.filter((c) => c.isActive);
  const arbre: { unite: Unite; libelle: string; niveau: number }[] = [
    { unite: { kind: 'all' }, libelle: 'Tout le personnel', niveau: 0 },
    { unite: { kind: 'direction' }, libelle: 'Direction', niveau: 0 },
    ...divisionsActives.flatMap((d) => [
      { unite: { kind: 'division', id: d.id } as Unite, libelle: d.name, niveau: 0 },
      ...sections.filter((s) => s.isActive && s.divisionId === d.id).map((s) => ({ unite: { kind: 'section', id: s.id } as Unite, libelle: s.name, niveau: 1 })),
    ]),
    ...cellulesActives.map((c) => ({ unite: { kind: 'cellule', id: c.id } as Unite, libelle: c.name, niveau: 0 })),
  ];
  const libelleUnite = arbre.find((a) => encoder(a.unite) === encoder(unite))?.libelle ?? 'Tout le personnel';
  // Responsable de l'unité affichée (lecture seule) : chef actif de la division, de la section ou de la cellule.
  const chef = (() => {
    if (!people) return null;
    if (unite.kind === 'division') return people.find((p) => p.role === 'CHEF_DIVISION' && p.divisionId === unite.id) ?? null;
    if (unite.kind === 'section') return people.find((p) => p.role === 'CHEF_SECTION' && p.sectionId === unite.id) ?? null;
    if (unite.kind === 'cellule') {
      const id = cellules.find((c) => c.id === unite.id)?.chefId;
      return people.find((p) => p.id === id) ?? null;
    }
    return null;
  })();
  const filtreActif = unite.kind !== 'all' || !!fonction || !!query;
  const effacer = () => (setUnite({ kind: 'all' }), setFonction(''), setQuery(''));

  const actions = (p: PersonneAnnuaire, compact = false) => {
    const nom = `${p.firstName} ${p.lastName}`;
    return (
      <span className="flex flex-none items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {p.id !== user?.id && (
          <Link href={`/communication?with=${p.id}`} className={compact ? BTN_ICONE : `${BTN_SECONDAIRE} !h-[34px] !px-2.5 !text-[13px]`} aria-label={`Envoyer un message à ${nom}`} title="Message">
            <MessageSquare aria-hidden size={15} />
            {!compact && 'Message'}
          </Link>
        )}
      </span>
    );
  };

  return (
    <div>
      <EnTetePage
        titre="Annuaire"
        sousTitre={people ? `${pluriel(people.length, 'personne')} · ${pluriel(divisionsActives.length, 'division')} · ${pluriel(cellulesActives.length, 'cellule')}` : undefined}
      />
      <ErreurChargement message={erreurChargement} />

      <BarreOutils
        droite={
          <div role="group" aria-label="Affichage" className="flex rounded-[9px] border border-line bg-surface p-[3px]">
            {(
              [
                ['cartes', 'Cartes', LayoutGrid],
                ['liste', 'Liste', List],
              ] as const
            ).map(([cle, libelle, Icone]) => (
              <button
                key={cle}
                type="button"
                aria-pressed={vue === cle}
                onClick={() => setVue(cle)}
                className={`flex h-7 items-center gap-1.5 rounded-[6px] px-[11px] text-[13px] font-semibold ${vue === cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}
              >
                <Icone aria-hidden size={14} /> {libelle}
              </button>
            ))}
          </div>
        }
      >
        <Recherche value={query} onChange={setQuery} placeholder="Nom, poste, unité…" label="Rechercher un nom, un poste ou une unité" />
        <FiltreSelect label="Fonction" value={fonction} defaut="" onChange={setFonction} options={[{ value: '', label: 'Fonction : toutes' }, ...fonctions.map((f) => ({ value: f, label: f }))]} />
        <select
          aria-label="Unité"
          value={encoder(unite)}
          onChange={(e) => setUnite(decoder(e.target.value))}
          className={`h-9 w-full rounded-[9px] border px-2.5 text-[13px] font-semibold sm:w-auto sm:max-w-[260px] lg:hidden ${unite.kind !== 'all' ? 'border-ink bg-ink-50 text-ink' : 'border-line bg-surface text-text'}`}
        >
          {arbre.map((a) => (
            <option key={encoder(a.unite)} value={encoder(a.unite)}>
              {a.niveau ? '— ' : ''}
              {a.unite.kind === 'all' ? 'Unité : toutes' : a.libelle}
            </option>
          ))}
        </select>
      </BarreOutils>

      {people === null ? (
        <Chargement erreur={erreurChargement} className="py-8 text-center text-[13px] text-text-muted" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
          <nav aria-label="Unités" className="hidden rounded-xl border border-line bg-surface p-2.5 lg:block" data-testid="arbre-unites">
            <ul>
              {arbre.map((a) => {
                const on = encoder(a.unite) === encoder(unite);
                return (
                  <li key={encoder(a.unite)}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => setUnite(a.unite)}
                      className={`flex w-full items-center gap-2 rounded-[8px] py-[7px] pr-2.5 text-left text-[13.5px] ${a.niveau ? 'pl-6' : 'pl-2.5'} ${on ? 'bg-ink-50 font-bold text-ink' : 'text-text hover:bg-bg'}`}
                    >
                      <span className="min-w-0 flex-1">{a.libelle}</span>
                      <span className={`text-[12px] ${on ? 'font-bold text-ink' : 'text-text-muted'}`}>{compte(a.unite)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section aria-label={libelleUnite} className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{libelleUnite}</h2>
              {chef && (
                <span className="text-[13px] font-semibold text-text-muted">
                  Chef : {chef.firstName} {chef.lastName}
                </span>
              )}
              <span className="text-[12.5px] text-text-muted">{pluriel(filtered.length, 'personne')}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface" data-testid="annuaire">
                <EtatVide
                  texte="Aucune personne ne correspond à ces critères."
                  action={filtreActif ? <button type="button" className={BTN_SECONDAIRE} onClick={effacer}>Effacer les filtres</button> : undefined}
                />
              </div>
            ) : vue === 'cartes' ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="annuaire" aria-label="Personnes">
                {filtered.map((p) => (
                  <li key={p.id} data-testid="personne-annuaire" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                    <Initiales texte={initialesDe(p.firstName, p.lastName)} taille={44} />
                    <button type="button" onClick={() => setSelected(p)} className="min-w-0 flex-1 text-left" aria-label={`Voir la fiche de ${p.firstName} ${p.lastName}`}>
                      <b className="block text-[14px] font-bold leading-tight text-ink-900">
                        {p.firstName} {p.lastName}
                      </b>
                      <span className="block truncate text-[12.5px] text-text-muted">{fonctionDe(p)}</span>
                      <span className="block truncate text-[12.5px] text-text-muted">{uniteDe(p) || '—'}</span>
                    </button>
                    {actions(p, true)}
                  </li>
                ))}
              </ul>
            ) : (
              <Tableau
                label="Annuaire"
                testid="annuaire"
                grille={GRILLE}
                colonnes={['Personne', 'Fonction', 'Unité', <span key="a" className="sr-only">Actions</span>]}
                pied={<span>{pluriel(filtered.length, 'personne')} affichée{filtered.length > 1 ? 's' : ''}</span>}
              >
                {filtered.map((p) => (
                  <LigneTableau key={p.id} grille={GRILLE} testid="personne-annuaire" label={`${p.firstName} ${p.lastName}`} onClick={() => setSelected(p)}>
                    <span className="flex items-center gap-2.5">
                      <Initiales texte={initialesDe(p.firstName, p.lastName)} />
                      <b className="truncate font-semibold text-ink-900">
                        {p.firstName} {p.lastName}
                      </b>
                    </span>
                    <span className="block truncate">{fonctionDe(p)}</span>
                    <span className="block truncate text-text-muted">{uniteDe(p) || '—'}</span>
                    <span className="flex lg:justify-end">{actions(p)}</span>
                  </LigneTableau>
                ))}
              </Tableau>
            )}
          </section>
        </div>
      )}

      {selected && <PersonDetailModal person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

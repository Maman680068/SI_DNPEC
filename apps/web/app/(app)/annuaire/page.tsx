'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrg } from '../../../lib/org/OrgProvider';
import { getDirectory } from '../../../lib/api/org';
import type { DirectoryUser } from '../../../lib/org/types';
import { PersonCard } from '../../../components/directory/PersonCard';
import { PersonDetailModal } from '../../../components/directory/PersonDetailModal';

/** Valeur du filtre "Unité" — encode le type d'unité dans la valeur plutôt que
 * d'avoir deux menus déroulants Division/Cellule séparés : un utilisateur n'est
 * jamais rattaché aux deux à la fois (voir schema.prisma), donc deux menus
 * indépendants pourraient laisser croire à un croisement possible qui n'existe pas. */
type UnitFilter = { kind: 'all' } | { kind: 'division'; id: string } | { kind: 'section'; id: string } | { kind: 'cellule'; id: string };

function encodeUnit(unit: UnitFilter): string {
  return unit.kind === 'all' ? '' : `${unit.kind}:${unit.id}`;
}

function decodeUnit(value: string): UnitFilter {
  if (!value) return { kind: 'all' };
  const [kind, id] = value.split(':');
  return { kind, id } as UnitFilter;
}

function matchesUnit(person: DirectoryUser, unit: UnitFilter): boolean {
  switch (unit.kind) {
    case 'all':
      return true;
    case 'division':
      return person.divisionId === unit.id;
    case 'section':
      return person.sectionId === unit.id;
    case 'cellule':
      return person.celluleId === unit.id;
  }
}

export default function AnnuairePage() {
  const { divisions, sections, cellules } = useOrg();
  const [people, setPeople] = useState<DirectoryUser[] | null>(null);
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<UnitFilter>({ kind: 'all' });
  const [selected, setSelected] = useState<DirectoryUser | null>(null);

  useEffect(() => {
    getDirectory().then(setPeople);
  }, []);

  const filtered = useMemo(() => {
    if (!people) return [];
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (!matchesUnit(p, unit)) return false;
      if (!q) return true;
      const haystack = `${p.firstName} ${p.lastName} ${p.jobTitle ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [people, query, unit]);

  return (
    <div>
      <div className="mb-[22px]">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
        <h1 className="text-[22px] font-extrabold">Annuaire</h1>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un nom ou une fonction…"
          className="w-full max-w-[280px] rounded-md border border-line bg-surface px-3.5 py-2.5 text-[13px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
        />
        <select
          value={encodeUnit(unit)}
          onChange={(e) => setUnit(decodeUnit(e.target.value))}
          className="w-full max-w-[280px] rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] sm:w-auto sm:max-w-[220px]"
        >
          <option value="">Toutes les unités</option>
          <optgroup label="Divisions">
            {divisions.map((d) => (
              <option key={d.id} value={`division:${d.id}`}>
                {d.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Sections">
            {sections.map((s) => (
              <option key={s.id} value={`section:${s.id}`}>
                {divisions.find((d) => d.id === s.divisionId)?.code ?? '?'} · {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Cellules transversales">
            {cellules.map((c) => (
              <option key={c.id} value={`cellule:${c.id}`}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {people === null ? (
        <p className="py-8 text-center text-[13px] text-text-faint">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">Aucune personne ne correspond à ces critères.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} onSelect={setSelected} />
          ))}
        </div>
      )}

      {selected && <PersonDetailModal person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

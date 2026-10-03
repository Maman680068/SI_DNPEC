'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Columns3, List } from 'lucide-react';

export type TaskView = 'liste' | 'kanban' | 'calendar';

const CLE_VUE = 'dnpec.taches.vue';
const VUES: TaskView[] = ['liste', 'kanban', 'calendar'];

/** Dernière vue choisie (Liste par défaut), retenue dans le navigateur ; partagée par Mes tâches et le tableau de bord. */
export function useVueTaches(): [TaskView, (v: TaskView) => void] {
  const [vue, setVue] = useState<TaskView>('liste');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(CLE_VUE) as TaskView | null;
      if (v && VUES.includes(v)) setVue(v);
    } catch {
      // Stockage indisponible : vue par défaut.
    }
  }, []);
  function choisir(v: TaskView) {
    setVue(v);
    try {
      window.localStorage.setItem(CLE_VUE, v);
    } catch {
      // Stockage indisponible : le choix vaut pour la page seulement.
    }
  }
  return [vue, choisir];
}

/**
 * Sélecteur Liste / Kanban / Calendrier (maquettes) : `plein` = vue active en bleu nuit (Mes tâches),
 * sinon fond blanc (panneau du tableau de bord).
 */
export function ViewToggle({ value, onChange, plein = false, vues = VUES }: { value: TaskView; onChange: (view: TaskView) => void; plein?: boolean; vues?: TaskView[] }) {
  const toutes = [
    { key: 'liste', label: 'Liste', icone: List },
    { key: 'kanban', label: 'Kanban', icone: Columns3 },
    { key: 'calendar', label: 'Calendrier', icone: CalendarDays },
  ] as const;
  const options = toutes.filter((o) => vues.includes(o.key));
  return (
    <div role="group" aria-label="Affichage des tâches" className={`flex rounded-[9px] p-[3px] ${plein ? 'border border-line bg-surface' : 'bg-bg'}`}>
      {options.map(({ key, label, icone: Icone }) => {
        const actif = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(key)}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold ${
              actif ? (plein ? 'bg-ink text-white' : 'bg-surface text-ink shadow-[0_1px_2px_rgba(27,42,107,0.12)]') : 'text-text-muted hover:text-ink'
            }`}
          >
            <Icone aria-hidden size={15} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

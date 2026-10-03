'use client';

import { useMemo, useState } from 'react';
import type { Task } from '../../lib/tasks/types';
import { STATUT_LIBELLE, STATUT_PASTILLE, estEnRetard } from '../../lib/tasks/affichage';
import { Button } from '../ui/Button';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = (monthStart.getDay() + 6) % 7; // lundi = 0
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}


export function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const tasksWithDueDate = useMemo(() => tasks.filter((t): t is Task & { dueDate: string } => Boolean(t.dueDate)), [tasks]);

  function tasksForDay(day: Date): Task[] {
    return tasksWithDueDate.filter((t) => sameDay(new Date(t.dueDate), day));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>←</Button>
        <div className="font-heading text-sm font-bold capitalize">
          {cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
        <Button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>→</Button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-[11px] font-bold uppercase text-text-faint">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="bg-bg py-2 text-center">
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg border-x border-b border-line bg-line">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === cursor.getMonth();
          const dayTasks = tasksForDay(day);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[92px] p-1.5 ${isCurrentMonth ? 'bg-surface' : 'bg-bg'}`}
            >
              <div className={`mb-1 text-[11px] font-semibold ${isCurrentMonth ? 'text-text' : 'text-text-faint'}`}>
                {day.getDate()}
              </div>
              {dayTasks.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  onClick={() => onSelect(task.id)}
                  title={`${task.title} — ${estEnRetard(task) ? 'en retard' : STATUT_LIBELLE[task.status]}`}
                  className={`mb-1 flex w-full items-center gap-1 truncate rounded-[5px] px-1.5 py-0.5 text-left text-[10.5px] font-semibold hover:underline ${estEnRetard(task) ? 'bg-clay-50 text-clay' : STATUT_PASTILLE[task.status]}`}
                >
                  <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />
                  <span className="truncate">{task.title}</span>
                </button>
              ))}
              {dayTasks.length > 3 && (
                <div className="text-[10px] text-text-faint">+{dayTasks.length - 3} autres</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

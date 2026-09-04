export type TaskView = 'kanban' | 'calendar';

export function ViewToggle({ value, onChange }: { value: TaskView; onChange: (view: TaskView) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md border border-line bg-bg p-0.5">
      {(
        [
          { key: 'kanban', label: 'Kanban' },
          { key: 'calendar', label: 'Calendrier' },
        ] as const
      ).map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`rounded-[6px] px-3.5 py-1.5 text-[12.5px] font-semibold ${
            value === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import type { Task } from '../../lib/tasks/types';
import { KANBAN_COLUMNS } from '../../lib/tasks/types';
import { KanbanColumn } from './KanbanColumn';

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-4">
      {KANBAN_COLUMNS.map((column) => (
        <KanbanColumn
          key={column.status}
          label={column.label}
          tasks={tasks.filter((task) => task.status === column.status)}
        />
      ))}
    </div>
  );
}

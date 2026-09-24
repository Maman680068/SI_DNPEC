'use client';

import { useParams } from 'next/navigation';
import { MyTasksView } from '../../../../components/tasks/MyTasksView';

/** Lien direct vers une tâche (emails de notification : /tasks/:id) — « Mes
 * tâches » avec la tâche ouverte dans le tiroir. */
export default function TaskDeepLinkPage() {
  const { id } = useParams<{ id: string }>();
  return <MyTasksView initialTaskId={id} />;
}

import type { TaskDashboard } from '../../lib/tasks/types';
import { Card } from '../ui/Card';

const KPIS: { key: keyof TaskDashboard; label: string; sub: string; bar: string }[] = [
  { key: 'enCours', label: 'Tâches en cours', sub: 'sur le total de votre périmètre', bar: 'border-l-accent' },
  { key: 'enRetard', label: 'En retard', sub: 'nécessitent une relance', bar: 'border-l-clay' },
  { key: 'enAttenteValidation', label: 'En attente de validation', sub: 'à examiner', bar: 'border-l-gold' },
  { key: 'termineesCeMois', label: 'Terminées ce mois', sub: 'sur la période en cours', bar: 'border-l-sage' },
];

export function KpiRow({ dashboard }: { dashboard: TaskDashboard }) {
  return (
    <div className="mb-6.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {KPIS.map((kpi) => (
        <Card key={kpi.key} className={`border-l-[3px] p-4.5 ${kpi.bar}`}>
          <div className="mb-2 text-xs font-semibold text-text-muted">{kpi.label}</div>
          <div className="font-heading text-[26px] font-extrabold">{dashboard[kpi.key]}</div>
          <div className="mt-1 text-[11.5px] text-text-faint">{kpi.sub}</div>
        </Card>
      ))}
    </div>
  );
}

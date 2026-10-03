import Link from 'next/link';
import type { TaskDashboard } from '../../lib/tasks/types';

/**
 * Bande unique de 4 compteurs (refonte de l'interface, maquette du tableau de bord) : chaque
 * compteur ouvre « Mes tâches » sur la liste filtrée (onglet « Mon périmètre » quand la personne
 * voit d'autres tâches que les siennes).
 */
export function KpiRow({ dashboard, perimetre, chezLeChef }: { dashboard: TaskDashboard; perimetre: boolean; chezLeChef: boolean }) {
  const base = perimetre ? '/tasks?onglet=perimetre' : '/tasks?onglet=assignees';
  const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Africa/Conakry' });
  const kpis: { key: keyof TaskDashboard; label: string; sub: string; couleur: string; href: string }[] = [
    { key: 'enCours', label: 'En cours', sub: perimetre ? 'dans votre périmètre' : 'vos tâches', couleur: 'text-ink', href: `${base}&statut=EN_COURS` },
    { key: 'enRetard', label: 'En retard', sub: 'à relancer', couleur: 'text-clay', href: `${base}&echeance=retard` },
    { key: 'enAttenteValidation', label: 'En validation', sub: chezLeChef ? 'chez votre chef' : 'à examiner', couleur: 'text-ambre-vif', href: `${base}&statut=SOUMISE_VALIDATION` },
    { key: 'termineesCeMois', label: `Terminées en ${mois}`, sub: 'ce mois-ci', couleur: 'text-sage', href: '/tasks?onglet=terminees' },
  ];
  return (
    <div data-testid="bande-compteurs" className="mb-[18px] grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-4">
      {kpis.map((k, i) => (
        <Link
          key={k.key}
          href={k.href}
          className={`flex items-center gap-3.5 px-[18px] py-3.5 hover:bg-bg ${i % 2 ? '' : 'border-r'} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 1 ? 'lg:border-r' : ''} ${i === 3 ? '' : 'lg:border-r'} border-line`}
        >
          <span className={`min-w-[30px] font-heading text-[28px] font-extrabold leading-none ${k.couleur}`}>{dashboard[k.key]}</span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-text">{k.label}</span>
            <span className="block text-[12.5px] text-text-muted">{k.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

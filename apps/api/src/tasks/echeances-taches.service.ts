import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, NotificationType, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { TachesPlanifieesService } from '../socle/taches-planifiees.service';
import { chefsLesPlusProches } from '../socle/chefs-proches';

const J = 864e5;
const debutJour = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const FINIES: TaskStatus[] = [TaskStatus.TERMINEE, TaskStatus.VALIDEE];

/**
 * Alertes d'échéance des tâches (socle N5, SIG-RF-TAC) : la veille de l'échéance, notification à
 * chaque assigné ; une fois l'échéance dépassée, notification au chef le plus proche de chaque
 * assigné. Chaque alerte part une seule fois (`alerteVeilleAt`, `alerteRetardAt`). Tous les jours à
 * 7 h (heure de Conakry = UTC) ; `executer(date)` accepte une date simulée.
 */
@Injectable()
export class EcheancesTachesService {
  private readonly logger = new Logger('EcheancesTaches');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  @Cron('0 7 * * *')
  async quotidien(): Promise<void> {
    await this.taches.suivre('echeances-taches', () => this.executer(new Date())).catch((e) => this.logger.error(`Échéances des tâches : ${e instanceof Error ? e.message : e}`));
  }

  async executer(maintenant: Date): Promise<{ veilles: number; retards: number }> {
    const aujourdhui = debutJour(maintenant);
    const demain = new Date(aujourdhui.getTime() + J);
    const apresDemain = new Date(aujourdhui.getTime() + 2 * J);
    const select = { id: true, title: true, dueDate: true, assignees: { select: { user: { select: { id: true, supervisorId: true, divisionId: true, sectionId: true, celluleId: true, firstName: true, lastName: true } } } } } as const;

    const veille = await this.prisma.task.findMany({ where: { status: { notIn: FINIES }, alerteVeilleAt: null, dueDate: { gte: demain, lt: apresDemain } }, select });
    for (const t of veille) {
      const n = await this.prisma.task.updateMany({ where: { id: t.id, alerteVeilleAt: null }, data: { alerteVeilleAt: maintenant } });
      if (!n.count) continue;
      for (const a of t.assignees) {
        await this.notifications.notify(a.user.id, NotificationType.TACHE_ECHEANCE_PROCHE, 'Échéance demain', `« ${t.title} » arrive à échéance demain.`, `/tasks/${t.id}`, t.title);
      }
    }

    const retard = await this.prisma.task.findMany({ where: { status: { notIn: FINIES }, alerteRetardAt: null, dueDate: { lt: aujourdhui } }, select });
    for (const t of retard) {
      const n = await this.prisma.task.updateMany({ where: { id: t.id, alerteRetardAt: null }, data: { alerteRetardAt: maintenant } });
      if (!n.count) continue;
      const chefs = new Map<string, string[]>();
      for (const a of t.assignees) {
        for (const c of await chefsLesPlusProches(this.prisma, a.user)) chefs.set(c, [...(chefs.get(c) ?? []), `${a.user.firstName} ${a.user.lastName}`]);
      }
      for (const [chef, noms] of chefs) {
        await this.notifications.notify(chef, NotificationType.TACHE_EN_RETARD, 'Tâche en retard', `« ${t.title} » (${noms.join(', ')}) a dépassé son échéance du ${t.dueDate!.toISOString().slice(0, 10)}.`, `/tasks/${t.id}`, t.title);
      }
      await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'Task', entityId: t.id, metadata: { event: 'alerte_retard', chefs: [...chefs.keys()] } });
    }
    return { veilles: veille.length, retards: retard.length };
  }
}

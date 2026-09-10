import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { TaskConfidentiality, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { TaskFiltersDto } from '../tasks/dto/task-filters.dto';
import { AuthenticatedUser } from '../common/types/auth-user.type';

// VALIDEE/REJETEE existent dans l'enum Prisma mais ne sont jamais posés en
// pratique (validate() va directement à TERMINEE, reject() repasse à
// EN_COURS — voir TasksService) : gardés ici seulement pour l'exhaustivité
// du Record, absents de STATUS_ORDER comme des 4 colonnes du Kanban.
const STATUS_LABEL: Record<TaskStatus, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  SOUMISE_VALIDATION: 'Soumises',
  VALIDEE: 'Validée',
  REJETEE: 'Rejetée',
  TERMINEE: 'Terminées',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  URGENT: 'Urgent',
  NORMAL: 'Normal',
  FAIBLE: 'Faible',
};

const CONFIDENTIALITY_LABEL: Record<TaskConfidentiality, string> = {
  PUBLIC_INTERNE: 'Public interne',
  CONFIDENTIEL_DIVISION: 'Confidentiel',
  TRES_CONFIDENTIEL_DIRIGEANTS: 'Très confidentiel',
};

// Ordre d'affichage du tableau de répartition du PDF — même ordre que les
// colonnes du Kanban (KANBAN_COLUMNS côté frontend), pour que le résumé PDF
// corresponde visuellement à ce qui est déjà affiché à l'écran.
const STATUS_ORDER: TaskStatus[] = [
  TaskStatus.A_FAIRE,
  TaskStatus.EN_COURS,
  TaskStatus.SOUMISE_VALIDATION,
  TaskStatus.TERMINEE,
];

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR');
}

/**
 * Export/Reporting (RF-CPL-01, §4.9) — à la demande uniquement, jamais de
 * rapport périodique automatique. Génération synchrone en mémoire : au
 * volume actuel de la DNPEC (quelques centaines de tâches au plus dans le
 * périmètre d'un DN), exceljs/pdfkit produisent le fichier en une fraction
 * de seconde — pas de file d'attente ni de job en arrière-plan (même
 * raisonnement que NotificationsService pour l'envoi synchrone).
 *
 * Visibilité : délibérément AUCUNE logique de filtrage propre à ce module.
 * Les deux méthodes ci-dessous appellent TasksService.findAllVisibleTo /
 * TasksService.dashboard, déjà scopées par cascade + confidentialité —
 * un export ne peut donc jamais contenir une tâche que l'écran ne
 * montrerait pas au même utilisateur, puisque c'est exactement la même
 * requête qui alimente le tableau de bord.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  async exportTasksExcel(actor: AuthenticatedUser): Promise<Buffer> {
    const tasks = await this.tasksService.findAllVisibleTo(actor, new TaskFiltersDto());

    const assigneeIds = Array.from(new Set(tasks.flatMap((t) => t.assignees.map((a) => a.userId))));
    // Résolution des noms via UsersService.resolveBasicInfo — le même mécanisme que
    // GET /users/resolve (batché, aucun contrôle de cascade : ce sont des champs non
    // sensibles, voir UsersController.resolve) — jamais un id brut affiché à l'utilisateur.
    const users = assigneeIds.length > 0 ? await this.usersService.resolveBasicInfo(assigneeIds) : [];
    const userLabelById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const [divisions, sections, cellules] = await Promise.all([
      this.prisma.division.findMany({ select: { id: true, name: true } }),
      this.prisma.section.findMany({ select: { id: true, name: true } }),
      this.prisma.cellule.findMany({ select: { id: true, name: true } }),
    ]);
    const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));
    const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));
    const celluleNameById = new Map(cellules.map((c) => [c.id, c.name]));

    function attachmentLabel(task: { divisionId: string | null; sectionId: string | null; celluleId: string | null }): string {
      if (task.celluleId) return celluleNameById.get(task.celluleId) ?? '';
      if (task.divisionId) {
        const division = divisionNameById.get(task.divisionId) ?? '';
        const section = task.sectionId ? sectionNameById.get(task.sectionId) : null;
        return section ? `${division} · ${section}` : division;
      }
      return '';
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SI DNPEC';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Tâches');

    sheet.columns = [
      { header: 'Titre', key: 'title', width: 40 },
      { header: 'Statut', key: 'status', width: 16 },
      { header: 'Priorité', key: 'priority', width: 12 },
      { header: 'Confidentialité', key: 'confidentiality', width: 16 },
      { header: 'Échéance', key: 'dueDate', width: 14 },
      { header: 'Responsables', key: 'assignees', width: 32 },
      { header: 'Avancement', key: 'progress', width: 12 },
      { header: 'Rattachement', key: 'attachment', width: 32 },
      { header: 'Créée le', key: 'createdAt', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

    for (const task of tasks) {
      sheet.addRow({
        title: task.title,
        status: STATUS_LABEL[task.status],
        priority: PRIORITY_LABEL[task.priority],
        confidentiality: CONFIDENTIALITY_LABEL[task.confidentiality],
        dueDate: formatDate(task.dueDate),
        assignees: task.assignees.map((a) => userLabelById.get(a.userId) ?? '').filter(Boolean).join(', '),
        progress: task.progressPercent != null ? `${task.progressPercent}%` : '',
        attachment: attachmentLabel(task),
        createdAt: formatDate(task.createdAt),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportDashboardPdf(actor: AuthenticatedUser): Promise<Buffer> {
    const [dashboard, tasks] = await Promise.all([
      this.tasksService.dashboard(actor),
      this.tasksService.findAllVisibleTo(actor, new TaskFiltersDto()),
    ]);

    const countByStatus = new Map<TaskStatus, number>();
    for (const task of tasks) {
      countByStatus.set(task.status, (countByStatus.get(task.status) ?? 0) + 1);
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).font('Helvetica-Bold').text('Tableau de bord — DNPEC', { align: 'left' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Généré le ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`);
    doc.moveDown(1.5);

    const kpis: { label: string; value: number }[] = [
      { label: 'Tâches en cours', value: dashboard.enCours },
      { label: 'En retard', value: dashboard.enRetard },
      { label: 'En attente de validation', value: dashboard.enAttenteValidation },
      { label: 'Terminées ce mois', value: dashboard.termineesCeMois },
    ];

    const kpiBoxWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 30) / 2;
    const kpiBoxHeight = 70;
    const startX = doc.page.margins.left;
    const startY = doc.y;
    kpis.forEach((kpi, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + col * (kpiBoxWidth + 30);
      const y = startY + row * (kpiBoxHeight + 15);
      doc.roundedRect(x, y, kpiBoxWidth, kpiBoxHeight, 6).fillAndStroke('#F4F5F7', '#E3E6EA');
      doc
        .fillColor('#141A26')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text(String(kpi.value), x + 14, y + 12);
      doc
        .fillColor('#666666')
        .font('Helvetica')
        .fontSize(10)
        .text(kpi.label, x + 14, y + 44, { width: kpiBoxWidth - 28 });
    });
    doc.y = startY + 2 * (kpiBoxHeight + 15);
    doc.moveDown(1);

    doc.fillColor('#141A26').font('Helvetica-Bold').fontSize(13).text('Répartition par statut');
    doc.moveDown(0.5);
    for (const status of STATUS_ORDER) {
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#141A26')
        .text(`${STATUS_LABEL[status]} : ${countByStatus.get(status) ?? 0}`);
    }

    doc.end();
    return done;
  }
}

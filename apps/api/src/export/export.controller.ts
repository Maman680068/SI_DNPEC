import { Controller, Get, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ExportService } from './export.service';

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('tasks.xlsx')
  async tasksExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportService.exportTasksExcel(actor);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="taches_${timestamp()}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('dashboard.pdf')
  async dashboardPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportService.exportDashboardPdf(actor);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tableau_de_bord_${timestamp()}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}

import { Injectable } from '@nestjs/common';
import { CareerEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type OrgAttachment = {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

/**
 * Historique de carrière (niveau 2, append-only, jamais écrasé — voir
 * schema.prisma, PersonnelCareerEvent). Généré automatiquement, jamais saisi
 * à la main : pas de statut "à vérifier" ici. Deux points d'entrée dans le
 * code appellent ce service : PersonnelFilesService (grade/échelon) et
 * UsersService.updateAssignment (affectation Division/Section/Cellule) —
 * volontairement injecté dans les deux plutôt que dupliqué.
 */
@Injectable()
export class PersonnelHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** N'enregistre un événement que si le rattachement a réellement changé. */
  async recordAffectationChange(
    userId: string,
    recordedById: string,
    from: OrgAttachment,
    to: OrgAttachment,
  ): Promise<void> {
    if (from.divisionId === to.divisionId && from.sectionId === to.sectionId && from.celluleId === to.celluleId) {
      return;
    }
    const [fromLabel, toLabel] = await Promise.all([this.describeAttachment(from), this.describeAttachment(to)]);
    await this.prisma.personnelCareerEvent.create({
      data: { userId, eventType: CareerEventType.AFFECTATION, fromValue: fromLabel, toValue: toLabel, recordedById },
    });
  }

  async recordPromotion(
    userId: string,
    recordedById: string,
    fromValue: string | null,
    toValue: string | null,
  ): Promise<void> {
    if (fromValue === toValue) return;
    await this.prisma.personnelCareerEvent.create({
      data: { userId, eventType: CareerEventType.PROMOTION, fromValue, toValue, recordedById },
    });
  }

  private async describeAttachment(attachment: OrgAttachment): Promise<string> {
    if (attachment.divisionId) {
      const division = await this.prisma.division.findUnique({
        where: { id: attachment.divisionId },
        select: { name: true },
      });
      if (attachment.sectionId) {
        const section = await this.prisma.section.findUnique({
          where: { id: attachment.sectionId },
          select: { name: true },
        });
        if (section) return `${division?.name ?? '?'} / ${section.name}`;
      }
      return division?.name ?? '?';
    }
    if (attachment.celluleId) {
      const cellule = await this.prisma.cellule.findUnique({
        where: { id: attachment.celluleId },
        select: { name: true },
      });
      return cellule?.name ?? '?';
    }
    return 'Aucun rattachement';
  }
}

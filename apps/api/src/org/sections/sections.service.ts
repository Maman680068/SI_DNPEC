import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForDivision(divisionId: string) {
    await this.assertDivisionExists(divisionId);
    return this.prisma.section.findMany({ where: { divisionId }, orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) throw new NotFoundException('Section introuvable');
    return section;
  }

  async create(divisionId: string, dto: CreateSectionDto) {
    await this.assertDivisionExists(divisionId);

    const existing = await this.prisma.section.findUnique({
      where: { divisionId_code: { divisionId, code: dto.code } },
    });
    if (existing) throw new ConflictException('Ce code de section existe déjà dans cette division');

    return this.prisma.section.create({ data: { ...dto, divisionId } });
  }

  async update(id: string, dto: UpdateSectionDto) {
    await this.findOneOrThrow(id);
    return this.prisma.section.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.prisma.section.delete({ where: { id } });
  }

  private async assertDivisionExists(divisionId: string): Promise<void> {
    const division = await this.prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division introuvable');
  }
}

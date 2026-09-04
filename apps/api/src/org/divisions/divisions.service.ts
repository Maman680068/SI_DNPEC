import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';

@Injectable()
export class DivisionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.division.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const division = await this.prisma.division.findUnique({ where: { id } });
    if (!division) throw new NotFoundException('Division introuvable');
    return division;
  }

  async create(dto: CreateDivisionDto) {
    const existing = await this.prisma.division.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code de division existe déjà');
    return this.prisma.division.create({ data: dto });
  }

  async update(id: string, dto: UpdateDivisionDto) {
    await this.findOneOrThrow(id);
    return this.prisma.division.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.prisma.division.delete({ where: { id } });
  }
}

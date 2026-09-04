import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';

/** Types de congés en table plutôt qu'en enum : extensibles sans migration (§4.4). */
@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.leaveType.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!leaveType) throw new NotFoundException('Type de congé introuvable');
    return leaveType;
  }

  async create(dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code de type de congé existe déjà');
    return this.prisma.leaveType.create({ data: dto });
  }

  async update(id: string, dto: UpdateLeaveTypeDto) {
    await this.findOneOrThrow(id);
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  // Pas de suppression : l'historique des demandes/soldes référence le type
  // (RF-CNG-04 : historique complet) — un type devenu obsolète se renomme,
  // il ne disparaît pas.
}

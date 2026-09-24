import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';

/** Types de congés en table plutôt qu'en enum : extensibles sans migration (§4.4). */
@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.leaveType.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!leaveType) throw new NotFoundException('Type de congé introuvable');
    return leaveType;
  }

  async create(actor: AuthenticatedUser, dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code de type de congé existe déjà');
    const created = await this.prisma.leaveType.create({ data: dto });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'LeaveType',
      entityId: created.id,
      metadata: { code: created.code, name: created.name },
    });

    return created;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateLeaveTypeDto) {
    const before = await this.findOneOrThrow(id);
    const updated = await this.prisma.leaveType.update({ where: { id }, data: dto });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'LeaveType',
      entityId: id,
      metadata: {
        before: { code: before.code, name: before.name },
        after: { code: updated.code, name: updated.name },
      },
    });

    return updated;
  }

  // Pas de suppression : l'historique des demandes/soldes référence le type
  // (RF-CNG-04 : historique complet) — un type devenu obsolète se renomme,
  // il ne disparaît pas.
}

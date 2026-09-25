import { Body, ConflictException, Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RoleChangeService } from './role-change.service';
import { ChangerRoleDto, NommerChefCelluleDto, RetirerChefCelluleDto } from './dto/changer-role.dto';

/**
 * Changement de rôle d'un compte existant (§3.2) — administrateur système.
 * « Nommer / retirer le chef d'une cellule » (écran Organisation) passent par
 * le même mécanisme : mêmes contrôles, historique de carrière et audit.
 */
@Controller()
@Roles(SystemRole.ADMIN_SYSTEME)
export class RoleChangeController {
  constructor(
    private readonly roles: RoleChangeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('users/:id/role/apercu')
  apercu(@Param('id') id: string, @Body() dto: ChangerRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.apercu(actor, id, dto);
  }

  @Post('users/:id/role')
  changer(@Param('id') id: string, @Body() dto: ChangerRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.changer(actor, id, dto);
  }

  @Post('org/cellules/:id/chef')
  async nommerChef(@Param('id') celluleId: string, @Body() dto: NommerChefCelluleDto, @CurrentUser() actor: AuthenticatedUser) {
    const cible = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { role: true } });
    if (!cible) throw new NotFoundException('Utilisateur introuvable');
    if (cible.role === SystemRole.DN || cible.role === SystemRole.DNA || cible.role === SystemRole.CHEF_DIVISION) {
      throw new ConflictException('Un DN, une DNA ou un Chef de Division ne se nomme pas chef de cellule : changez d’abord son rôle.');
    }
    return this.roles.changer(actor, dto.userId, { role: SystemRole.CHEF_CELLULE, roleAttendu: cible.role, celluleId, motif: dto.motif });
  }

  /** Le chef quitte la fonction et reste dans la cellule avec le rôle cible
   * (par défaut Chargé d'Études) ; jamais de rétrogradation implicite. */
  @Post('org/cellules/:id/chef/retrait')
  async retirerChef(@Param('id') celluleId: string, @Body() dto: RetirerChefCelluleDto, @CurrentUser() actor: AuthenticatedUser) {
    const cellule = await this.prisma.cellule.findUnique({ where: { id: celluleId }, select: { chefId: true } });
    if (!cellule) throw new NotFoundException('Cellule introuvable');
    if (!cellule.chefId) throw new ConflictException('Cette cellule n’a pas de chef.');
    return this.roles.changer(actor, cellule.chefId, {
      role: dto.role ?? SystemRole.AGENT,
      roleAttendu: SystemRole.CHEF_CELLULE,
      celluleId,
      motif: dto.motif,
    });
  }
}

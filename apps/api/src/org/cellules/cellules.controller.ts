import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CellulesService } from './cellules.service';
import { CreateCelluleDto } from './dto/create-cellule.dto';
import { UpdateCelluleDto } from './dto/update-cellule.dto';
import { AssignChefDto } from './dto/assign-chef.dto';

@Controller('org/cellules')
export class CellulesController {
  constructor(private readonly cellulesService: CellulesService) {}

  @Get()
  findAll() {
    return this.cellulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cellulesService.findOneOrThrow(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post()
  create(@Body() dto: CreateCelluleDto) {
    return this.cellulesService.create(dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCelluleDto) {
    return this.cellulesService.update(id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cellulesService.remove(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/chef')
  assignChef(
    @Param('id') id: string,
    @Body() dto: AssignChefDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.cellulesService.assignChef(id, dto.userId, actor);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Delete(':id/chef')
  removeChef(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.cellulesService.removeChef(id, actor);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.cellulesService.suspend(id, actor);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.cellulesService.reactivate(id, actor);
  }
}

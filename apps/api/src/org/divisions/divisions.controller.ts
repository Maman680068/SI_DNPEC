import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { DivisionsService } from './divisions.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';
import { OuvertAuxStagiaires } from '../../common/decorators/ouvert-aux-stagiaires.decorator';

@Controller('org/divisions')
export class DivisionsController {
  constructor(private readonly divisionsService: DivisionsService) {}

  @OuvertAuxStagiaires()
  @Get()
  findAll() {
    return this.divisionsService.findAll();
  }

  @OuvertAuxStagiaires()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.divisionsService.findOneOrThrow(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post()
  create(@Body() dto: CreateDivisionDto) {
    return this.divisionsService.create(dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDivisionDto) {
    return this.divisionsService.update(id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.divisionsService.remove(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.divisionsService.suspend(id, actor);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.divisionsService.reactivate(id, actor);
  }
}

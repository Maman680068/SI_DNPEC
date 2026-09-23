import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Controller()
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get('org/divisions/:divisionId/sections')
  findAllForDivision(@Param('divisionId') divisionId: string) {
    return this.sectionsService.findAllForDivision(divisionId);
  }

  @Get('org/sections/:id')
  findOne(@Param('id') id: string) {
    return this.sectionsService.findOneOrThrow(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('org/divisions/:divisionId/sections')
  create(@Param('divisionId') divisionId: string, @Body() dto: CreateSectionDto) {
    return this.sectionsService.create(divisionId, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch('org/sections/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Delete('org/sections/:id')
  remove(@Param('id') id: string) {
    return this.sectionsService.remove(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('org/sections/:id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.sectionsService.suspend(id, actor);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('org/sections/:id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.sectionsService.reactivate(id, actor);
  }
}

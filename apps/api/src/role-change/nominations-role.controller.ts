import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NominationsRoleService } from './nominations-role.service';
import { ConfirmerNominationDto, RefuserNominationDto } from './dto/nomination.dto';

/** Droits des nominations signées (option A) — administrateur système, routes sous api/v1/changements-role. */
@Controller('api/v1/changements-role')
@Roles(SystemRole.ADMIN_SYSTEME)
export class NominationsRoleController {
  constructor(private readonly nominations: NominationsRoleService) {}

  @Get()
  liste(@CurrentUser() actor: AuthenticatedUser) {
    return this.nominations.liste(actor);
  }

  @Post(':id/confirmation')
  @HttpCode(200)
  confirmer(@Param('id') id: string, @Body() dto: ConfirmerNominationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.nominations.confirmer(actor, id, dto);
  }

  @Post(':id/refus')
  @HttpCode(200)
  refuser(@Param('id') id: string, @Body() dto: RefuserNominationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.nominations.refuser(actor, id, dto);
  }
}

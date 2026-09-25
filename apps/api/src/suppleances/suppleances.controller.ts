import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { SuppleancesService } from './suppleances.service';
import { CreateSuppleanceDto } from './dto/create-suppleance.dto';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';

@Controller('suppleances')
export class SuppleancesController {
  constructor(private readonly suppleancesService: SuppleancesService) {}

  @Post()
  create(@Body() dto: CreateSuppleanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.create(actor, dto);
  }

  @OuvertAuxStagiaires()
  @Get('mine')
  findMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.findMine(actor);
  }

  @Get('titulaires')
  findManageableTitulaires(@CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.findManageableTitulaires(actor);
  }

  @Get('candidats')
  findCandidates(@Query('titulaireId') titulaireId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.findCandidates(actor, titulaireId ?? '');
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.revoke(actor, id);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { FilsService } from './fils.service';
import { RechercheService } from './recherche.service';
import { MessageFilDto, NouveauFilDto, RechercheDto } from './dto/fils.dto';

/** Fils de discussion (ouverts aux stagiaires, comme la messagerie directe). */
@OuvertAuxStagiaires()
@Controller('api/v1/fils')
export class FilsController {
  constructor(private readonly fils: FilsService) {}

  @Get()
  lister(@CurrentUser() actor: AuthenticatedUser) {
    return this.fils.lister(actor);
  }

  @Get('destinataires-possibles')
  destinataires(@CurrentUser() actor: AuthenticatedUser) {
    return this.fils.destinatairesPossibles(actor);
  }

  @Post()
  creer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: NouveauFilDto) {
    return this.fils.creer(actor, dto);
  }

  @Get(':id')
  detail(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.fils.detail(actor, id);
  }

  @Post(':id/messages')
  repondre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MessageFilDto) {
    return this.fils.repondre(actor, id, dto);
  }
}

/** Recherche transverse (fermée aux stagiaires, comme les modules qu'elle interroge). */
@Controller('api/v1/recherche')
export class RechercheController {
  constructor(private readonly recherche: RechercheService) {}

  @Get()
  rechercher(@CurrentUser() actor: AuthenticatedUser, @Query() dto: RechercheDto) {
    return this.recherche.rechercher(actor, dto.q);
  }
}

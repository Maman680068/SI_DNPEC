import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NATURES_CELLULE, OrganisationVueService, RATTACHEMENTS } from './organisation-vue.service';

class RattachementCelluleDto {
  @IsOptional()
  @IsIn(RATTACHEMENTS as unknown as string[])
  rattachement?: string;

  @IsOptional()
  @IsIn(NATURES_CELLULE as unknown as string[])
  nature?: string;
}

/** Organisation (S8) : vue des trois onglets, lue par tous (hors stagiaires) ; rattachement des cellules. */
@Controller('api/v1/organisation')
export class OrganisationVueController {
  constructor(private readonly organisation: OrganisationVueService) {}

  @Get()
  vue(@CurrentUser() actor: AuthenticatedUser) {
    return this.organisation.vue(actor);
  }

  @Patch('cellules/:id')
  modifierCellule(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: RattachementCelluleDto) {
    return this.organisation.modifierCellule(actor, id, dto);
  }
}

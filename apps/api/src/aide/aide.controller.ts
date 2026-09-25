import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AideService } from './aide.service';

/** Aide en ligne : ouverte à tous, stagiaires compris (leur propre guide). */
@OuvertAuxStagiaires()
@Controller('aide')
export class AideController {
  constructor(private readonly aide: AideService) {}

  @Get('profils')
  profils(@CurrentUser() actor: AuthenticatedUser) {
    return this.aide.profils(actor);
  }
}

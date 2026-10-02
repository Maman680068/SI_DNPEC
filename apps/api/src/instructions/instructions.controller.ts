import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { InstructionsService } from './instructions.service';
import { ExecutionDto, InstructionDto, RejetDto } from './dto/instruction.dto';

/** Instructions de la Direction (socle N5) — routes sous api/v1. */
@Controller('api/v1/instructions')
export class InstructionsController {
  constructor(private readonly instructions: InstructionsService) {}

  @Get()
  liste(@CurrentUser() actor: AuthenticatedUser) {
    return this.instructions.liste(actor);
  }

  @Post()
  emettre(@CurrentUser() actor: AuthenticatedUser, @Body() dto: InstructionDto) {
    return this.instructions.emettre(actor, dto);
  }

  @Get(':id')
  lire(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.instructions.lire(actor, id);
  }

  @Post(':id/prise-en-compte')
  @HttpCode(200)
  prendreEnCompte(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.instructions.prendreEnCompte(actor, id);
  }

  @Post(':id/execution')
  @HttpCode(200)
  executer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ExecutionDto) {
    return this.instructions.executer(actor, id, dto);
  }

  @Post(':id/rejet')
  @HttpCode(200)
  rejeter(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: RejetDto) {
    return this.instructions.rejeter(actor, id, dto);
  }
}

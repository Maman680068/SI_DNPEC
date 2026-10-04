import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { ConvertDecisionDto } from './dto/convert-decision.dto';

@Controller()
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get('decisions/dashboard')
  dashboard(@CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.dashboard(actor);
  }

  /** Décisions à suivre (page Réunions) : lecture seule, même périmètre que le relevé de chaque réunion. */
  @Get('api/v1/decisions/a-suivre')
  aSuivre(@CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.aSuivre(actor);
  }

  @Get('meetings/:meetingId/decisions')
  findAllForMeeting(@Param('meetingId') meetingId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.findAllForMeeting(actor, meetingId);
  }

  @Post('meetings/:meetingId/decisions')
  create(
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.decisionsService.create(actor, meetingId, dto);
  }

  @Patch('decisions/:id')
  update(@Param('id') id: string, @Body() dto: UpdateDecisionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.update(actor, id, dto);
  }

  @Get('decisions/:id/responsables-possibles')
  responsablesPossibles(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.responsablesPossibles(actor, id);
  }

  @Post('decisions/:id/convert-to-action')
  convertToAction(
    @Param('id') id: string,
    @Body() dto: ConvertDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.decisionsService.convertToAction(actor, id, dto);
  }

  @Post('decisions/:id/close')
  close(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.close(actor, id);
  }

  @Post('decisions/:id/remind')
  remind(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.decisionsService.remind(actor, id);
  }
}

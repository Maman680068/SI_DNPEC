import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { PollsService } from './polls.service';
import { CreatePollDto } from '../dto/create-poll.dto';
import { VotePollDto } from '../dto/vote-poll.dto';

@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Post()
  create(@Body() dto: CreatePollDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.pollsService.create(actor, dto);
  }

  @Get()
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.pollsService.findAllVisibleTo(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.pollsService.findOneVisibleTo(actor, id);
  }

  @Post(':id/vote')
  vote(@Param('id') id: string, @Body() dto: VotePollDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.pollsService.vote(actor, id, dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.pollsService.close(actor, id);
  }
}

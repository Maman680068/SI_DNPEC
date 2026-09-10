import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionStatusDto } from './dto/update-suggestion-status.dto';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  create(@Body() dto: CreateSuggestionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.suggestionsService.create(actor, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.suggestionsService.findMine(actor);
  }

  @Get()
  findAllForLeadership(@CurrentUser() actor: AuthenticatedUser) {
    return this.suggestionsService.findAllForLeadership(actor);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestionStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.suggestionsService.updateStatus(actor, id, dto);
  }
}

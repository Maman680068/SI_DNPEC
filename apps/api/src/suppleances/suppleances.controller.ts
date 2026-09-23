import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { SuppleancesService } from './suppleances.service';
import { CreateSuppleanceDto } from './dto/create-suppleance.dto';

@Controller('suppleances')
export class SuppleancesController {
  constructor(private readonly suppleancesService: SuppleancesService) {}

  @Post()
  create(@Body() dto: CreateSuppleanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.create(actor, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.findMine(actor);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.suppleancesService.revoke(actor, id);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from '../dto/create-folder.dto';
import { UpdateFolderDto } from '../dto/update-folder.dto';

@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@Body() dto: CreateFolderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.foldersService.create(actor, dto);
  }

  @Get()
  findAllForDivision(@Query('divisionId') divisionId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.foldersService.findAllForDivision(actor, divisionId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFolderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.foldersService.update(actor, id, dto);
  }
}

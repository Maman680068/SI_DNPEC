import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DivisionsService } from './divisions.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';

@Controller('org/divisions')
export class DivisionsController {
  constructor(private readonly divisionsService: DivisionsService) {}

  @Get()
  findAll() {
    return this.divisionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.divisionsService.findOneOrThrow(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post()
  create(@Body() dto: CreateDivisionDto) {
    return this.divisionsService.create(dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDivisionDto) {
    return this.divisionsService.update(id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.divisionsService.remove(id);
  }
}

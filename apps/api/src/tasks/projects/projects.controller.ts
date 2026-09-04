import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { TasksService } from '../tasks.service';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
  ) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.projectsService.create(actor, dto);
  }

  @Get()
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.projectsService.findAllVisibleTo(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOneOrThrow(id);
  }

  @Get(':id/tasks')
  async findTasks(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.projectsService.findOneOrThrow(id);
    return this.tasksService.findAllVisibleTo(actor, { projectId: id });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.projectsService.update(actor, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.projectsService.remove(actor, id);
  }
}

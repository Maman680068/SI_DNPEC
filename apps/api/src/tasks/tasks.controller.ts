import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateTaskAssigneeDto } from './dto/create-task-assignee.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { ValidateTaskDto } from './dto/validate-task.dto';
import { TaskFiltersDto } from './dto/task-filters.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.create(actor, dto);
  }

  @Get()
  findAll(@Query() filters: TaskFiltersDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.findAllVisibleTo(actor, filters);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.dashboard(actor);
  }

  @Get('saved-filters')
  listSavedFilters(@CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.listSavedFilters(actor);
  }

  @Post('saved-filters')
  createSavedFilter(@Body() dto: CreateSavedFilterDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.createSavedFilter(actor, dto);
  }

  @Delete('saved-filters/:id')
  removeSavedFilter(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.removeSavedFilter(actor, id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.findOneVisibleTo(actor, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.update(actor, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.remove(actor, id);
  }

  @Post(':id/subtasks')
  createSubtask(
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.createSubtask(actor, id, dto);
  }

  @Get(':id/subtasks')
  listSubtasks(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.listSubtasks(actor, id);
  }

  @Post(':id/toggle')
  toggleSubtaskCompletion(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.toggleSubtaskCompletion(actor, id);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.start(actor, id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.submit(actor, id);
  }

  @Post(':id/validate')
  validate(
    @Param('id') id: string,
    @Body() dto: ValidateTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.validate(actor, id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectTaskDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.reject(actor, id, dto);
  }

  @Post(':id/assignees')
  addAssignee(
    @Param('id') id: string,
    @Body() dto: CreateTaskAssigneeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.addAssignee(actor, id, dto);
  }

  @Delete(':id/assignees/:userId')
  removeAssignee(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.removeAssignee(actor, id, userId);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.addComment(actor, id, dto);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.listComments(actor, id);
  }

  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.addAttachment(actor, id, dto);
  }

  @Get(':id/attachments')
  listAttachments(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.listAttachments(actor, id);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.removeAttachment(actor, id, attachmentId);
  }

  @Post(':id/generate-occurrence')
  generateOccurrence(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.generateNextOccurrence(actor, id);
  }
}

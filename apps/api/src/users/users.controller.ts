import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { ResolveUsersDto } from './dto/resolve-users.dto';
import { SearchUsersDto } from './dto/search-users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.create(dto, actor);
  }

  @Get()
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findAllVisibleTo(actor);
  }

  // Routes statiques déclarées avant ":id" pour ne pas être capturées par lui.
  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get('pending')
  findPending() {
    return this.usersService.findPendingRegistrations();
  }

  /**
   * Résolution de noms pour l'affichage (co-responsables, auteurs de
   * commentaires, mentions...), délibérément non scopée par la cascade —
   * contrairement à GET /users (gestion) — et limitée à des champs non
   * sensibles (ni email, ni rôle, ni statut de compte). Accessible à tout
   * utilisateur authentifié.
   */
  @Get('resolve')
  resolve(@Query() dto: ResolveUsersDto) {
    const ids = dto.ids.split(',').map((id) => id.trim()).filter(Boolean);
    return this.usersService.resolveBasicInfo(ids);
  }

  /**
   * Recherche par nom pour trouver un destinataire de message (RF-COM-01 :
   * la messagerie directe est volontairement sans restriction de cascade).
   * Mêmes champs non sensibles que /users/resolve, comptes actifs
   * uniquement. Accessible à tout utilisateur authentifié.
   */
  @Get('search')
  search(@Query() dto: SearchUsersDto) {
    return this.usersService.searchBasicInfo(dto.q);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findOneVisibleTo(actor, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.updateProfile(actor, id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateStatus(actor, id, dto);
  }

  @Patch(':id/assignment')
  updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateAssignment(actor, id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRegistrationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.approveRegistration(actor, id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.rejectRegistration(actor, id);
  }
}

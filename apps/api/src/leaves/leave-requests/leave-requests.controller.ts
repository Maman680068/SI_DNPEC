import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from '../dto/decide-leave-request.dto';
import { RejectLeaveRequestDto } from '../dto/reject-leave-request.dto';
import { LeaveRequestFiltersDto } from '../dto/leave-request-filters.dto';
import { AvisLeaveRequestDto } from '../dto/avis-leave-request.dto';

@Controller('leaves')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.create(actor, dto);
  }

  @Get()
  findAll(@Query() filters: LeaveRequestFiltersDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.findAllVisibleTo(actor, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.findOneVisibleTo(actor, id);
  }

  /** Certificat médical d'un congé maladie (socle N3) : déposé par l'agent, lu par lui et le DRH. */
  @Post(':id/certificat')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  deposerCertificat(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.deposerCertificat(actor, id, file);
  }

  @Get(':id/certificat')
  async lireCertificat(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    const { fileName, stream } = await this.leaveRequestsService.lireCertificat(actor, id);
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"` });
    return new StreamableFile(stream);
  }

  /** Avis du chef d'unité (socle N3, circuit A6.1). */
  @Post(':id/avis')
  avis(@Param('id') id: string, @Body() dto: AvisLeaveRequestDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.donnerAvis(actor, id, dto);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.approve(actor, id, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.reject(actor, id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.cancel(actor, id);
  }
}

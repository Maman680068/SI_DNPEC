import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { typeServi } from '../../common/storage/type-servi';
import { PiecesJointesService, TAILLE_MAX_PIECE } from './pieces-jointes.service';

class EnvoiFichierDto {
  @IsString()
  recipientId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;
}

/**
 * Pièces jointes de la messagerie (S3). Déclaré dans CollaborationModule (accès aux Archives).
 * Envoi d'un fichier et documents à citer : fermés aux stagiaires (comme le trombone aujourd'hui) ;
 * téléchargement : les deux personnes de la conversation, stagiaire compris.
 */
@Controller('api/v1/messages')
export class PiecesJointesController {
  constructor(private readonly pieces: PiecesJointesService) {}

  @Post('fichier')
  // Limite de Multer un peu au-dessus de 10 Mo : le service répond en français au-delà de 10 Mo.
  @UseInterceptors(FileInterceptor('fichier', { storage: memoryStorage(), limits: { fileSize: TAILLE_MAX_PIECE + 1024 * 1024 } }))
  envoyer(@Body() dto: EnvoiFichierDto, @UploadedFile() f: Express.Multer.File, @CurrentUser() actor: AuthenticatedUser) {
    return this.pieces.envoyerFichier(actor, dto.recipientId, dto.body, f);
  }

  @Get('avec/:userId/documents-a-citer')
  documentsACiter(@Param('userId') userId: string, @Query('q') q: string | undefined, @CurrentUser() actor: AuthenticatedUser) {
    return this.pieces.documentsACiter(actor, userId, typeof q === 'string' ? q.slice(0, 100) : undefined);
  }

  @OuvertAuxStagiaires()
  @Get(':id/piece-jointe')
  async telecharger(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { stream, nom, type } = await this.pieces.telecharger(actor, id);
    res.set({ 'Content-Type': typeServi(type), 'Content-Disposition': `attachment; filename="${encodeURIComponent(nom)}"` });
    return new StreamableFile(stream);
  }
}

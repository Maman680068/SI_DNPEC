import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { OuvertAuxStagiaires } from '../../common/decorators/ouvert-aux-stagiaires.decorator';
import { ContexteConversationService } from './contexte-conversation.service';

/**
 * Fiche de l'interlocuteur d'une conversation (lecture seule). Ouverte aux stagiaires comme la
 * messagerie, filtrée par les droits du lecteur. Déclaré dans CollaborationModule, qui importe déjà
 * TasksModule et DocumentsModule (les importer dans CommunicationModule créerait un cycle).
 */
@OuvertAuxStagiaires()
@Controller('api/v1/messages')
export class ContexteConversationController {
  constructor(private readonly contexte: ContexteConversationService) {}

  @Get('avec/:userId/contexte')
  lire(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.contexte.contexte(actor, userId);
  }
}

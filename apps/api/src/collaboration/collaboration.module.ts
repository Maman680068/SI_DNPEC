import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { TasksModule } from '../tasks/tasks.module';
import { DocumentsModule } from '../documents/documents.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { CourrierModule } from '../courrier/courrier.module';
import { FilsController, RechercheController } from './collaboration.controller';
import { FilsService } from './fils.service';
import { RechercheService } from './recherche.service';
import { ObjetsPlateformeService } from './objets-plateforme.service';
import { ContexteConversationController } from '../communication/messages/contexte-conversation.controller';
import { ContexteConversationService } from '../communication/messages/contexte-conversation.service';

/** Socle N5 : fils de discussion (renvois vers les objets de la plateforme) et recherche transverse. */
@Module({
  imports: [CommunicationModule, TasksModule, DocumentsModule, MeetingsModule, CourrierModule],
  // Fiche de l'interlocuteur d'une conversation directe (refonte, étape 6) : a besoin des tâches et des documents.
  controllers: [FilsController, RechercheController, ContexteConversationController],
  providers: [FilsService, RechercheService, ObjetsPlateformeService, ContexteConversationService],
})
export class CollaborationModule {}

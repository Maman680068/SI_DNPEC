import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { DocumentsService } from './documents.service';

/**
 * Écran « Archives & documents » (refonte de l'interface) — api/v1/documents/synthese : bandeau des
 * documents qui attendent la validation de l'acteur et compteur de l'onglet « Publiés pour toute la
 * DNPEC ». Lecture seule, même périmètre que GET /documents ; fermée aux stagiaires (comme la GED).
 */
@Controller('api/v1/documents')
export class ArchivesController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('synthese')
  synthese(@CurrentUser() actor: AuthenticatedUser) {
    return this.documents.synthese(actor);
  }
}

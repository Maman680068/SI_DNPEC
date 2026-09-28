import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/** GET /health : sonde de disponibilité (Render Health Check) — aucune logique
 * métier, juste confirmer que le processus répond. Ne touche pas la base de
 * données : Render doit distinguer "processus mort" de "base injoignable".
 * `version` : commit et branche réellement déployés (variables fournies par
 * Render ; null en local) — pour vérifier qu'une fusion est bien en ligne. */
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      version: { commit: process.env.RENDER_GIT_COMMIT ?? null, branche: process.env.RENDER_GIT_BRANCH ?? null },
    };
  }
}

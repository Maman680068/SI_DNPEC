import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/** GET /health : sonde de disponibilité (Render Health Check) — aucune logique
 * métier, juste confirmer que le processus répond. Ne touche pas la base de
 * données : Render doit distinguer "processus mort" de "base injoignable". */
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

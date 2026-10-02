import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { SupervisionService } from './socle/supervision.service';

/** GET /health : sonde de disponibilité (Render Health Check) — aucune logique
 * métier, juste confirmer que le processus répond. Ne touche pas la base de
 * données : Render doit distinguer "processus mort" de "base injoignable".
 * `version` : commit et branche réellement déployés (variables fournies par
 * Render ; null en local) — pour vérifier qu'une fusion est bien en ligne. */
@Controller()
export class AppController {
  constructor(private readonly supervision: SupervisionService) {}

  /** Sonde des dépendances (SOC-SUP-08) pour un outil de supervision externe : état de chaque
   * service seulement (aucun détail, aucune donnée). Distincte de /health, qui ne touche pas la base. */
  @Public()
  @Get('health/dependances')
  async dependances() {
    // Dépendances seulement : l'écart fonction / rôle des comptes est une donnée de gestion, pas une panne.
    const services = (await this.supervision.services()).filter((s) => s.cle !== 'fonction-role');
    const etat = services.some((s) => s.etat === 'INDISPONIBLE') ? 'INDISPONIBLE' : services.some((s) => s.etat === 'DEGRADE') ? 'DEGRADE' : 'NOMINAL';
    return { etat, services: Object.fromEntries(services.map((s) => [s.cle, s.etat])) };
  }

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      version: { commit: process.env.RENDER_GIT_COMMIT ?? null, branche: process.env.RENDER_GIT_BRANCH ?? null },
    };
  }
}

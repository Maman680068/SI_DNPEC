import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TachesPlanifieesService } from './taches-planifiees.service';

/** Durée de conservation des messages directs (cahier NIMBA, annexe 4 ; SIG-RF-COM-05). */
export const CONSERVATION_MESSAGES_ANS = 3;

/**
 * Référentiel de conservation (socle N3) : les messages directs de plus de 3 ans sont effacés
 * chaque nuit, pièces jointes comprises. Les notifications, annonces et le journal d'audit ne sont
 * pas concernés (l'audit ne s'efface jamais).
 */
@Injectable()
export class ConservationService {
  private readonly logger = new Logger('Conservation');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  @Cron('40 0 * * *')
  async purgeQuotidienne(): Promise<void> {
    await this.taches.suivre('purge-messages', () => this.purgerMessages(new Date())).catch((e) => this.logger.error(`Purge des messages : ${e instanceof Error ? e.message : e}`));
  }

  /** `maintenant` simulable pour les tests. */
  async purgerMessages(maintenant: Date): Promise<{ messages: number; piecesJointes: number }> {
    const limite = new Date(maintenant);
    limite.setUTCFullYear(limite.getUTCFullYear() - CONSERVATION_MESSAGES_ANS);
    const avecPiece = await this.prisma.directMessage.findMany({ where: { createdAt: { lt: limite }, attachmentKey: { not: null } }, select: { attachmentKey: true } });
    const { count } = await this.prisma.directMessage.deleteMany({ where: { createdAt: { lt: limite } } });
    let piecesJointes = 0;
    for (const m of avecPiece) {
      // Une pièce effacée ne bloque jamais la purge (fichier déjà absent, stockage indisponible).
      await this.storage.delete(m.attachmentKey!).then(() => piecesJointes++, () => undefined);
    }
    return { messages: count, piecesJointes };
  }
}

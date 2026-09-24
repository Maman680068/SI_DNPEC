import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getOnBehalfOfId } from '../request-context/request-context';

export interface AuditLogInput {
  /** null pour une action système sans acteur humain (ex. tâche planifiée future). */
  actorId: string | null;
  action: AuditAction;
  /** Nom du modèle métier concerné, ex. "User", "Cellule". */
  entityType: string;
  entityId: string;
  /** Détail libre de l'action (champs modifiés, valeurs avant/après...). */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Point d'entrée unique du journal d'audit (RF-SEC-04). Appel explicite
 * depuis chaque service métier sur ses actions sensibles — pas
 * d'interception automatique : le pattern posé ici (un `audit.log(...)`
 * à l'endroit précis où l'action métier a lieu) est celui que les futurs
 * modules (tâches, congés, documents) réutiliseront à l'identique.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `tx` (optionnel) : client d'une transaction interactive Prisma
   * (`prisma.$transaction(async (tx) => ...)`) — l'entrée d'audit est alors
   * écrite DANS cette transaction et disparaît avec elle en cas de rollback
   * (ex. numérotation du registre de courrier : numéro, écriture métier et
   * audit indissociables). Sans `tx`, comportement historique inchangé :
   * écriture immédiate via le client global.
   */
  async log(input: AuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        // Suppléance/intérim (§2.6) : jamais passé explicitement par
        // l'appelant — lu depuis le contexte de la requête en cours
        // (AsyncLocalStorage, posé par JwtAuthGuard). Sans acteur humain
        // (job planifié), il n'y a par définition personne "au nom de qui".
        onBehalfOfId: input.actorId ? getOnBehalfOfId() : null,
      },
    });
  }
}

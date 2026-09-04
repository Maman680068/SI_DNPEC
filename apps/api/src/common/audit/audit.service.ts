import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }
}

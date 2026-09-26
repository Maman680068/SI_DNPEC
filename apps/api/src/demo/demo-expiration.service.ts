import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DOMAINE_DEMO, DUREE_DEMO_JOURS, ENTITE_AUDIT_DEMO } from './demo.constantes';

/**
 * Expiration des comptes de démonstration : DUREE_DEMO_JOURS jours après le
 * dernier passage du script en mode « creer » (marque d'audit
 * entityType « Demo », event « demo_creee »), tout compte @demo.dnpec.test encore
 * ACTIF est SUSPENDU et ses sessions sont fermées. Vérifié chaque nuit et au
 * démarrage de l'API (un redémarrage ne fait jamais manquer l'échéance).
 */
@Injectable()
export class DemoExpirationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.executer().catch((e) => this.logger.error(`Expiration démo : ${e instanceof Error ? e.message : e}`));
  }

  @Cron('20 0 * * *')
  async quotidien() {
    await this.executer().catch((e) => this.logger.error(`Expiration démo : ${e instanceof Error ? e.message : e}`));
  }

  /** Renvoie le nombre de comptes suspendus (0 si la démo n'a pas expiré). */
  async executer(now: Date = new Date()): Promise<number> {
    const dernier = await this.prisma.auditLog.findFirst({
      where: { entityType: ENTITE_AUDIT_DEMO, metadata: { path: ['event'], equals: 'demo_creee' } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!dernier) return 0;
    const echeance = new Date(dernier.createdAt.getTime() + DUREE_DEMO_JOURS * 24 * 3600 * 1000);
    if (now < echeance) return 0;
    const comptes = await this.prisma.user.findMany({
      where: { email: { endsWith: `@${DOMAINE_DEMO}` }, status: UserStatus.ACTIF },
      select: { id: true },
    });
    if (comptes.length === 0) return 0;
    const ids = comptes.map((c) => c.id);
    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: UserStatus.SUSPENDU } }),
      this.prisma.userSession.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.auditLog.create({
        data: {
          actorId: null,
          action: AuditAction.MODIFICATION,
          entityType: ENTITE_AUDIT_DEMO,
          entityId: 'expiration',
          metadata: { event: 'demo_expiree', comptesSuspendus: ids.length, echeance: echeance.toISOString() },
        },
      }),
    ]);
    this.logger.log(`Démonstration expirée : ${ids.length} compte(s) de démonstration suspendu(s).`);
    return ids.length;
  }
}

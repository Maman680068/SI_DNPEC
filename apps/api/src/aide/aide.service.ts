import { Injectable } from '@nestjs/common';
import { SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { GestionnairesLogistiqueService } from '../logistique/gestionnaires.service';

/**
 * Profils d'aide de l'utilisateur connecté : son rôle PROPRE (jamais le rôle
 * emprunté en intérim) et ses habilitations personnelles (secrétariat
 * courrier, gestionnaire logistique). L'écran /aide n'affiche que les guides
 * de ces profils — le web ne calcule rien.
 */
@Injectable()
export class AideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gestionnaires: GestionnairesLogistiqueService,
  ) {}

  async profils(actor: AuthenticatedUser): Promise<{ profils: string[] }> {
    const moi = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { role: true } });
    const profils: string[] = [moi.role];
    if (moi.role !== SystemRole.STAGIAIRE) {
      const courrier = await this.prisma.habilitationCourrier.count({
        where: { userId: actor.id, revoqueeAt: null, registre: { isActive: true }, user: { status: UserStatus.ACTIF } },
      });
      if (courrier > 0) profils.push('SECRETARIAT_COURRIER');
      if (await this.gestionnaires.estGestionnaire({ id: actor.id })) profils.push('GESTIONNAIRE_LOGISTIQUE');
    }
    return { profils };
  }
}

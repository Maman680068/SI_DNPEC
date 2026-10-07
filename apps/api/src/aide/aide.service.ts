import { Injectable } from '@nestjs/common';
import { RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { GestionnairesLogistiqueService } from '../logistique/gestionnaires.service';
import { rolesActifs } from '../socle/roles-fonctionnels';
import { rolesModelisation } from '../modelisation/acces';

/**
 * Profils d'aide de l'utilisateur connecté : son rôle PROPRE (jamais le rôle
 * emprunté en intérim) et ses habilitations personnelles (secrétariat
 * courrier, gestionnaire logistique) ; les rôles fonctionnels DRH et gestionnaire RH
 * (socle NIMBA, jamais empruntés) ouvrent le guide DRH ; les rôles de modélisation (domaine B) ouvrent
 * les guides « Analyste » et « Responsable de modèle ». L'écran /aide n'affiche que les guides
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
      const roles = await rolesActifs(this.prisma, actor.id);
      if (!profils.includes(SystemRole.DRH) && roles.some((r) => r === RoleFonctionnel.DRH || r === RoleFonctionnel.GESTIONNAIRE_RH)) profils.push(SystemRole.DRH);
      // Domaine B : rôles de modélisation (personnels, jamais empruntés en intérim).
      const rm = await rolesModelisation(this.prisma, { id: actor.id, role: moi.role, interimForId: null });
      if (rm.analyste) profils.push('ANALYSTE_MODELE');
      if (rm.responsableDe.length || rm.suppleantDe.length) profils.push('RESPONSABLE_MODELE');
    }
    return { profils };
  }
}

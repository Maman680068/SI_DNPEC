import { ForbiddenException, Injectable } from '@nestjs/common';
import { StatutAgent, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { attributionActiveWhere, LIBELLE_ROLE_FONCTIONNEL } from '../socle/roles-fonctionnels';

/**
 * Comptes et habilitations (écran « Utilisateurs ») : pour chaque compte, ses rôles fonctionnels actifs
 * (libellés) et l'état de sa double authentification — jamais le secret ; dessous, les agents en activité
 * du socle qui n'ont pas encore de compte (« aucun compte sans agent » : le compte s'ouvre depuis l'agent).
 * Administrateur : tout, avec « Ouvrir un compte » ; DN et DNA : lecture seule ; tout autre profil : 403.
 * Rien n'est emprunté en intérim (une vue de sécurité suit l'identité réelle).
 */
@Injectable()
export class ComptesSyntheseService {
  constructor(private readonly prisma: PrismaService) {}

  async synthese(actor: AuthenticatedUser) {
    const admin = actor.role === SystemRole.ADMIN_SYSTEME;
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    if (actor.interimForId || (!admin && !direction)) throw new ForbiddenException('Les comptes et habilitations sont consultés par l’administrateur et la Direction.');
    const comptes = await this.prisma.user.findMany({
      where: { status: { not: UserStatus.EN_ATTENTE } },
      select: { id: true, twoFactorEnabled: true, attributionsRoles: { where: attributionActiveWhere(), select: { role: true } } },
    });
    const agents = await this.prisma.agent.findMany({
      where: { statut: StatutAgent.EN_ACTIVITE, compte: null },
      select: { id: true, matricule: true, nom: true, prenoms: true, fonction: true, createdAt: true, unite: { select: { code: true, libelle: true } } },
      orderBy: [{ createdAt: 'desc' }, { nom: 'asc' }],
    });
    return {
      droits: { ouvrirCompte: admin },
      comptes: comptes.map((c) => ({
        id: c.id,
        rolesFonctionnels: [...new Set(c.attributionsRoles.map((a) => a.role))].map((r) => LIBELLE_ROLE_FONCTIONNEL[r]).sort((a, b) => a.localeCompare(b, 'fr')),
        doubleAuthentification: c.twoFactorEnabled,
      })),
      agentsSansCompte: agents.map((a) => ({
        id: a.id,
        matricule: a.matricule,
        nom: a.nom,
        prenoms: a.prenoms,
        fonction: a.fonction,
        unite: a.unite ? a.unite.libelle : null,
        dateCreation: a.createdAt.toISOString().slice(0, 10),
      })),
    };
  }
}

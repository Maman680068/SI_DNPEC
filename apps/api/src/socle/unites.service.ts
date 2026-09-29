import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, RoleFonctionnel, StatutAgent, SystemRole, TypeUnite, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AutorisationService } from './autorisation.service';
import { UnitesArbreService } from './unites-arbre.service';
import { CreerUniteDto, FermerUniteDto, ModifierUniteDto } from './dto/unites.dto';

/** Libellés des types d'unité (écrans). */
export const LIBELLE_TYPE_UNITE: Record<TypeUnite, string> = {
  DIRECTION: 'Direction',
  DIVISION: 'Division',
  SECTION: 'Section',
  CELLULE: 'Cellule',
  INSTANCE: 'Instance',
};

/**
 * Parentés ouvertes en N1 : celles que les modules actuels savent exploiter
 * (chaque unité a sa ligne historique divisions / sections / cellules).
 * La structure est récursive en base ; d'autres combinaisons s'ouvriront quand
 * les modules liront l'unité de l'agent.
 */
const ENFANTS_POSSIBLES: Record<TypeUnite, TypeUnite[]> = {
  DIRECTION: [TypeUnite.DIVISION, TypeUnite.CELLULE, TypeUnite.INSTANCE],
  DIVISION: [TypeUnite.SECTION],
  SECTION: [],
  CELLULE: [],
  INSTANCE: [],
};

/**
 * Organigramme souple (socle NIMBA, §3) : création, modification, fermeture
 * datée et historisée des unités, à l'écran et sans développement. Gestion :
 * DRH et administrateur (annexe 1.2, « Unité organisationnelle CLM(T) ») ;
 * lecture par tous (L(T)).
 */
@Injectable()
export class UnitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly arbres: UnitesArbreService,
    private readonly autorisation: AutorisationService,
  ) {}

  private peutGerer(actor: AuthenticatedUser): boolean {
    return actor.rolesFonctionnels.includes(RoleFonctionnel.DRH) || (actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId);
  }

  private async exigerGestion(actor: AuthenticatedUser, action: 'C' | 'M' | 'S', uniteId?: string): Promise<void> {
    await this.autorisation.exiger(actor, {
      action,
      objet: { type: 'UniteOrganisationnelle', id: uniteId },
      rolesRequis: [RoleFonctionnel.DRH],
      positionsAcceptees: [SystemRole.ADMIN_SYSTEME],
      perimetre: 'IGNORE',
    });
  }

  /** Organigramme complet (unités ouvertes et fermées), avec les droits de l'écran. */
  async organigramme(actor: AuthenticatedUser) {
    const maintenant = new Date();
    const [unites, effectifs, suppleances] = await Promise.all([
      this.prisma.uniteOrganisationnelle.findMany({
        select: {
          id: true, code: true, libelle: true, type: true, parentId: true, dateCreation: true, dateFermeture: true,
          motifFermeture: true, responsableId: true,
          responsable: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
          division: { select: { isActive: true } },
          section: { select: { isActive: true } },
          cellule: { select: { isActive: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.agent.groupBy({ by: ['uniteId'], where: { statut: { not: StatutAgent.PARTI } }, _count: { _all: true } }),
      this.prisma.suppleance.findMany({
        where: { revokedAt: null, startDate: { lte: maintenant }, endDate: { gte: maintenant } },
        select: { titulaireId: true, endDate: true, suppleant: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    const effectifPar = new Map(effectifs.map((e) => [e.uniteId, e._count._all]));
    const suppleantDe = new Map(suppleances.map((s) => [s.titulaireId, { ...s.suppleant, jusquau: s.endDate }]));
    const gerer = this.peutGerer(actor);
    const enfantsOuverts = new Map<string, number>();
    for (const u of unites) if (u.parentId && !u.dateFermeture) enfantsOuverts.set(u.parentId, (enfantsOuverts.get(u.parentId) ?? 0) + 1);
    return {
      droits: { peutGerer: gerer },
      types: Object.values(TypeUnite).map((t) => ({ type: t, libelle: LIBELLE_TYPE_UNITE[t] })),
      unites: unites.map(({ division, section, cellule, responsableId, ...u }) => {
        const ouverte = !u.dateFermeture;
        const effectif = effectifPar.get(u.id) ?? 0;
        return {
          ...u,
          libelleType: LIBELLE_TYPE_UNITE[u.type],
          suspendue: (division ?? section ?? cellule)?.isActive === false,
          fermee: !ouverte,
          effectif,
          suppleant: responsableId ? suppleantDe.get(responsableId) ?? null : null,
          droits: {
            peutModifier: gerer && ouverte && u.type !== TypeUnite.DIRECTION,
            peutFermer: gerer && ouverte && u.type !== TypeUnite.DIRECTION,
            // Motif affiché avant le clic (le serveur revérifie à la fermeture).
            fermetureBloquee: effectif > 0
              ? `${effectif} agent(s) encore rattaché(s)`
              : (enfantsOuverts.get(u.id) ?? 0) > 0 ? 'Des sous-unités sont encore ouvertes' : null,
            typesEnfants: gerer && ouverte ? ENFANTS_POSSIBLES[u.type].map((t) => ({ type: t, libelle: LIBELLE_TYPE_UNITE[t] })) : [],
            typesPossibles: gerer && ouverte && (u.type === TypeUnite.CELLULE || u.type === TypeUnite.INSTANCE)
              ? [TypeUnite.CELLULE, TypeUnite.INSTANCE].map((t) => ({ type: t, libelle: LIBELLE_TYPE_UNITE[t] }))
              : [],
          },
        };
      }),
    };
  }

  async historique(id: string) {
    const unite = await this.prisma.uniteOrganisationnelle.findUnique({ where: { id }, select: { id: true } });
    if (!unite) throw new NotFoundException('Unité introuvable');
    return this.prisma.historiqueUnite.findMany({
      where: { uniteId: id },
      select: { id: true, evenement: true, avant: true, apres: true, dateEffet: true, auteur: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dateEffet: 'desc' },
    });
  }

  async creer(actor: AuthenticatedUser, dto: CreerUniteDto) {
    await this.exigerGestion(actor, 'C');
    const parent = await this.prisma.uniteOrganisationnelle.findUnique({ where: { id: dto.parentId } });
    if (!parent) throw new NotFoundException('Unité parente introuvable');
    if (parent.dateFermeture) throw new ConflictException('L’unité parente est fermée.');
    if (!ENFANTS_POSSIBLES[parent.type].includes(dto.type)) {
      throw new BadRequestException(`Une unité de type ${LIBELLE_TYPE_UNITE[dto.type]} ne peut pas être rattachée à une unité de type ${LIBELLE_TYPE_UNITE[parent.type]}.`);
    }
    const doublon = await this.prisma.uniteOrganisationnelle.findFirst({ where: { parentId: parent.id, code: dto.code }, select: { id: true } });
    if (doublon) throw new ConflictException('Ce code est déjà utilisé sous cette unité.');

    const cree = await this.prisma.$transaction(async (tx) => {
      // Ligne historique d'abord : les modules actuels continuent de l'utiliser.
      const lien: Prisma.UniteOrganisationnelleUncheckedCreateInput = { code: dto.code, libelle: dto.libelle, type: dto.type, parentId: parent.id };
      if (dto.type === TypeUnite.DIVISION) {
        if (await tx.division.findUnique({ where: { code: dto.code } })) throw new ConflictException('Ce code de division est déjà utilisé.');
        lien.divisionId = (await tx.division.create({ data: { code: dto.code, name: dto.libelle } })).id;
      } else if (dto.type === TypeUnite.SECTION) {
        if (!parent.divisionId) throw new ConflictException('Division parente incomplète.');
        lien.sectionId = (await tx.section.create({ data: { code: dto.code, name: dto.libelle, divisionId: parent.divisionId } })).id;
      } else {
        if (await tx.cellule.findUnique({ where: { code: dto.code } })) throw new ConflictException('Ce code de cellule ou d’instance est déjà utilisé.');
        lien.celluleId = (await tx.cellule.create({ data: { code: dto.code, name: dto.libelle } })).id;
      }
      const u = await tx.uniteOrganisationnelle.create({ data: lien });
      await tx.historiqueUnite.create({ data: { uniteId: u.id, evenement: 'CREATION', apres: { code: u.code, libelle: u.libelle, type: u.type, parentId: parent.id }, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'UniteOrganisationnelle', entityId: u.id, metadata: { code: u.code, type: u.type, parentId: parent.id } }, tx);
      return u;
    });
    this.arbres.invalider();
    return cree;
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierUniteDto) {
    await this.exigerGestion(actor, 'M', id);
    const u = await this.prisma.uniteOrganisationnelle.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Unité introuvable');
    if (u.type === TypeUnite.DIRECTION) throw new ConflictException('La Direction ne se modifie pas ici.');
    if (u.dateFermeture) throw new ConflictException('Une unité fermée ne se modifie plus.');
    if (dto.type && dto.type !== u.type) {
      const echange = [TypeUnite.CELLULE, TypeUnite.INSTANCE] as TypeUnite[];
      if (!echange.includes(u.type) || !echange.includes(dto.type)) {
        throw new BadRequestException('Seul le passage Cellule ⇄ Instance est possible.');
      }
    }
    const code = dto.code ?? u.code;
    const libelle = dto.libelle ?? u.libelle;
    const type = dto.type ?? u.type;
    if (code === u.code && libelle === u.libelle && type === u.type) return u;
    if (code !== u.code && (await this.prisma.uniteOrganisationnelle.findFirst({ where: { parentId: u.parentId, code, id: { not: id } } }))) {
      throw new ConflictException('Ce code est déjà utilisé sous cette unité.');
    }
    const maj = await this.prisma.$transaction(async (tx) => {
      if (u.divisionId) await tx.division.update({ where: { id: u.divisionId }, data: { code, name: libelle } });
      if (u.sectionId) await tx.section.update({ where: { id: u.sectionId }, data: { code, name: libelle } });
      if (u.celluleId) await tx.cellule.update({ where: { id: u.celluleId }, data: { code, name: libelle } });
      const r = await tx.uniteOrganisationnelle.update({ where: { id }, data: { code, libelle, type } });
      await tx.historiqueUnite.create({
        data: { uniteId: id, evenement: 'MODIFICATION', avant: { code: u.code, libelle: u.libelle, type: u.type }, apres: { code, libelle, type }, auteurId: actor.id },
      });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'UniteOrganisationnelle', entityId: id, metadata: { avant: { code: u.code, libelle: u.libelle, type: u.type }, apres: { code, libelle, type } } }, tx);
      return r;
    });
    this.arbres.invalider();
    return maj;
  }

  /**
   * Fermeture datée et motivée : refusée (409) s'il reste un agent en activité
   * ou suspendu, un compte actif ou en attente, ou une sous-unité ouverte.
   * La ligne historique est désactivée (plus de nouveau rattachement).
   */
  async fermer(actor: AuthenticatedUser, id: string, dto: FermerUniteDto) {
    await this.exigerGestion(actor, 'S', id);
    const u = await this.prisma.uniteOrganisationnelle.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Unité introuvable');
    if (u.type === TypeUnite.DIRECTION) throw new ConflictException('La Direction ne se ferme pas.');
    if (u.dateFermeture) throw new ConflictException('Cette unité est déjà fermée.');
    const dateEffet = dto.dateEffet ? new Date(dto.dateEffet) : new Date();
    if (dateEffet.getTime() > Date.now()) throw new BadRequestException('La date de fermeture ne peut pas être dans le futur.');
    const [enfants, agents, comptes] = await Promise.all([
      this.prisma.uniteOrganisationnelle.count({ where: { parentId: id, dateFermeture: null } }),
      this.prisma.agent.count({ where: { uniteId: id, statut: { not: StatutAgent.PARTI } } }),
      this.prisma.user.count({
        where: {
          status: { in: [UserStatus.ACTIF, UserStatus.SUSPENDU, UserStatus.EN_ATTENTE] },
          OR: [
            ...(u.divisionId ? [{ divisionId: u.divisionId }] : []),
            ...(u.sectionId ? [{ sectionId: u.sectionId }] : []),
            ...(u.celluleId ? [{ celluleId: u.celluleId }] : []),
          ],
        },
      }),
    ]);
    if (enfants > 0) throw new ConflictException(`Fermeture impossible : ${enfants} sous-unité(s) encore ouverte(s).`);
    if (agents > 0 || comptes > 0) {
      throw new ConflictException(`Fermeture impossible : ${Math.max(agents, comptes)} agent(s) encore rattaché(s). Mutez-les d’abord.`);
    }
    const maj = await this.prisma.$transaction(async (tx) => {
      if (u.divisionId) await tx.division.update({ where: { id: u.divisionId }, data: { isActive: false } });
      if (u.sectionId) await tx.section.update({ where: { id: u.sectionId }, data: { isActive: false } });
      if (u.celluleId) await tx.cellule.update({ where: { id: u.celluleId }, data: { isActive: false } });
      const r = await tx.uniteOrganisationnelle.update({
        where: { id },
        data: { dateFermeture: dateEffet, motifFermeture: dto.motif, fermeeParId: actor.id, responsableId: null },
      });
      await tx.historiqueUnite.create({ data: { uniteId: id, evenement: 'FERMETURE', apres: { motif: dto.motif }, dateEffet, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'UniteOrganisationnelle', entityId: id, metadata: { event: 'fermeture', motif: dto.motif, dateEffet } }, tx);
      return r;
    });
    this.arbres.invalider();
    return maj;
  }
}

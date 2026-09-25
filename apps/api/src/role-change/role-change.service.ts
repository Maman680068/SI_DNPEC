import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActeStatut, ArriveeStatut, AuditAction, ImputationStatut, NotificationType, Prisma, SystemRole, TaskStatus, UserStatus, VisaStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { PersonnelHistoryService } from '../personnel/personnel-history.service';
import { SessionService } from '../auth/services/session.service';
import { SUPERVISOR_ROLES, UsersService } from '../users/users.service';
import { isComparableRank } from '../suppleances/comparable-rank';
import { viseurOccupeLePoste } from '../courrier/actes.service';
import { ChangerRoleDto } from './dto/changer-role.dto';
import { ROLE_LIBELLE, RattachementRole, rattachementPourRole } from './roles';

type Cible = Prisma.UserGetPayload<{
  select: typeof CIBLE_SELECT;
}>;

const CIBLE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  jobTitle: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
  supervisorId: true,
} satisfies Prisma.UserSelect;

const PERSONNE = { id: true, firstName: true, lastName: true } satisfies Prisma.UserSelect;

/** Préparation d'un changement de rôle : tout ce que l'aperçu montre est
 * exactement ce que l'action applique (une seule implémentation). */
interface Plan {
  cible: Cible;
  apres: RattachementRole & { role: SystemRole; jobTitle: string | null };
  suppleancesARevoquer: { id: string; titulaireId: string; suppleantId: string; titulaire: string; suppleant: string; debut: Date; fin: Date }[];
  suppleancesConservees: { id: string; titulaire: string; suppleant: string }[];
  accesARevoquer: { id: string; sens: 'ouvert' | 'recu'; arriveeId: string | null; acteId: string | null }[];
  habilitations: { id: string; registre: string; uniteKey: string }[];
  imputationsEnCours: { id: string; courrierId: string; numero: string }[];
  visasDevenusObsoletes: { acteId: string; objet: string; redacteurId: string }[];
  taches: { assignees: number; creees: number };
  celluleQuittee: string | null;
  celluleNommee: string | null;
  sessionsActives: number;
}

/**
 * Changement de rôle d'un compte existant, par l'administrateur système.
 * Contrôles : rattachement exigé par le rôle, unicité (DN, DNA, chefs),
 * assistants à réaffecter, dernier administrateur. Effets, dans une seule
 * transaction : rôle et rattachement, Cellule.chefId, suppléances devenues non
 * conformes révoquées, accès délégués courrier révoqués, historique de
 * carrière, audit ; après le commit : sessions révoquées, notifications.
 */
@Injectable()
export class RoleChangeService {
  private readonly logger = new Logger(RoleChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly history: PersonnelHistoryService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  /** Aperçu : mêmes contrôles et mêmes effets que changer(), sans rien écrire. */
  async apercu(actor: AuthenticatedUser, userId: string, dto: ChangerRoleDto) {
    const plan = await this.preparer(actor, userId, dto);
    return this.presenter(plan);
  }

  async changer(actor: AuthenticatedUser, userId: string, dto: ChangerRoleDto) {
    const plan = await this.preparer(actor, userId, dto);
    const { cible, apres } = plan;
    const now = new Date();
    const libAvant = await this.libelleFonction(cible.role, cible);
    const libApres = await this.libelleFonction(apres.role, apres);

    await this.prisma.$transaction(async (tx) => {
      // Garde contre un changement concurrent : le rôle et le rattachement lus
      // par preparer() doivent être encore ceux de la base.
      const maj = await tx.user.updateMany({
        where: { id: cible.id, role: cible.role, status: UserStatus.ACTIF, divisionId: cible.divisionId, sectionId: cible.sectionId, celluleId: cible.celluleId },
        data: {
          role: apres.role,
          divisionId: apres.divisionId,
          sectionId: apres.sectionId,
          celluleId: apres.celluleId,
          supervisorId: apres.supervisorId,
          ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
        },
      });
      if (maj.count === 0) throw new ConflictException('Ce compte a été modifié entre-temps : recommencez depuis l’aperçu.');

      // Unicité revérifiée DANS la transaction, après verrouillage de l'unité
      // (deux nominations simultanées ne peuvent pas produire deux chefs).
      await this.verrouillerEtRevererifierUnicite(tx, cible.id, apres);

      if (plan.celluleQuittee) {
        await tx.cellule.updateMany({ where: { id: plan.celluleQuittee, chefId: cible.id }, data: { chefId: null } });
      }
      if (plan.celluleNommee) {
        const pose = await tx.cellule.updateMany({
          where: { id: plan.celluleNommee, OR: [{ chefId: null }, { chefId: cible.id }] },
          data: { chefId: cible.id },
        });
        if (pose.count === 0) throw new ConflictException('Cette cellule a déjà un Chef de Cellule.');
      }

      for (const s of plan.suppleancesARevoquer) {
        await tx.suppleance.updateMany({ where: { id: s.id, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } });
        await this.audit.log(
          { actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Suppleance', entityId: s.id, metadata: { event: 'revocation_changement_role', userId: cible.id } },
          tx,
        );
      }
      if (plan.accesARevoquer.length > 0) {
        await tx.accesDelegueCourrier.updateMany({
          where: { id: { in: plan.accesARevoquer.map((a) => a.id) }, revoqueAt: null },
          data: { revoqueAt: now, revoqueParId: actor.id },
        });
      }

      await this.history.recordFonctionChange(cible.id, actor.id, libAvant, libApres, tx);
      await this.history.recordAffectationChange(
        cible.id,
        actor.id,
        { divisionId: cible.divisionId, sectionId: cible.sectionId, celluleId: cible.celluleId },
        { divisionId: apres.divisionId, sectionId: apres.sectionId, celluleId: apres.celluleId },
        tx,
      );

      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.MODIFICATION,
          entityType: 'User',
          entityId: cible.id,
          metadata: {
            event: 'role_change',
            motif: dto.motif,
            avant: { role: cible.role, divisionId: cible.divisionId, sectionId: cible.sectionId, celluleId: cible.celluleId, supervisorId: cible.supervisorId, jobTitle: cible.jobTitle },
            apres: { role: apres.role, divisionId: apres.divisionId, sectionId: apres.sectionId, celluleId: apres.celluleId, supervisorId: apres.supervisorId, jobTitle: apres.jobTitle },
            effets: {
              suppleancesRevoquees: plan.suppleancesARevoquer.map((s) => s.id),
              accesRevoques: plan.accesARevoquer.map((a) => a.id),
              celluleQuittee: plan.celluleQuittee,
              celluleNommee: plan.celluleNommee,
              circuitsObsoletes: plan.visasDevenusObsoletes.map((v) => v.acteId),
              sessionsRevoquees: plan.sessionsActives,
            },
          },
        },
        tx,
      );
    });

    // Après le commit : sessions et notifications (un échec d'email ne défait rien, A7).
    await this.sessions.revokeAllSessions(cible.id);
    await this.notifier(plan, libApres);
    return { ...this.presenter(plan), applique: true };
  }

  // ------------------------------------------------------------------

  private async preparer(actor: AuthenticatedUser, userId: string, dto: ChangerRoleDto): Promise<Plan> {
    if (actor.interimForId) throw new ForbiddenException('Un changement de rôle se fait en votre nom propre, jamais en intérim.');
    if (actor.role !== SystemRole.ADMIN_SYSTEME) throw new ForbiddenException('Seul l’administrateur système change le rôle d’un compte.');
    const cible = await this.prisma.user.findUnique({ where: { id: userId }, select: CIBLE_SELECT });
    if (!cible) throw new NotFoundException('Utilisateur introuvable');
    if (cible.id === actor.id) throw new ForbiddenException('Vous ne pouvez pas changer votre propre rôle.');
    if (cible.status !== UserStatus.ACTIF) {
      throw new ConflictException('Seul un compte actif change de rôle (une inscription en attente se traite par l’approbation).');
    }
    if (dto.roleAttendu !== cible.role) {
      throw new ConflictException(`Le rôle de ce compte a changé entre-temps (il est maintenant ${ROLE_LIBELLE[cible.role]}) : recommencez.`);
    }

    const r = rattachementPourRole(dto.role, dto);
    const apres = { ...r, role: dto.role, jobTitle: dto.jobTitle ?? cible.jobTitle };
    const memeRattachement =
      r.divisionId === cible.divisionId && r.sectionId === cible.sectionId && r.celluleId === cible.celluleId && r.supervisorId === cible.supervisorId;
    if (dto.role === cible.role && memeRattachement) {
      throw new ConflictException('Aucun changement : ce compte a déjà ce rôle et ce rattachement.');
    }

    await this.users.assertOrgAttachmentValid(r);
    if (!(r.divisionId === cible.divisionId && r.sectionId === cible.sectionId && r.celluleId === cible.celluleId)) {
      await this.users.assertUnitsActiveForNewAttachment(r);
    }
    await this.users.assertNoActiveChiefConflict(dto.role, r, cible.id);

    if (cible.role === SystemRole.ADMIN_SYSTEME && dto.role !== SystemRole.ADMIN_SYSTEME) {
      const autres = await this.prisma.user.count({ where: { role: SystemRole.ADMIN_SYSTEME, status: UserStatus.ACTIF, id: { not: cible.id } } });
      if (autres === 0) throw new ConflictException('C’est le dernier administrateur système actif : nommez-en un autre avant de retirer ce rôle.');
    }

    if (!SUPERVISOR_ROLES.includes(dto.role)) {
      const assistants = await this.prisma.user.findMany({
        where: { supervisorId: cible.id, role: SystemRole.ASSISTANT_DIRECTION, status: { in: [UserStatus.ACTIF, UserStatus.SUSPENDU] } },
        select: PERSONNE,
        orderBy: { lastName: 'asc' },
      });
      if (assistants.length > 0) {
        throw new ConflictException(
          `Réaffectez d’abord ${assistants.length > 1 ? 'les assistant(e)s' : 'l’assistant(e)'} de ce compte (un ${ROLE_LIBELLE[dto.role]} ne supervise pas d’assistant) : ${assistants.map((a) => `${a.firstName} ${a.lastName}`).join(', ')}.`,
        );
      }
    }

    return { cible, apres, ...(await this.effets(cible, apres)) };
  }

  private async effets(cible: Cible, apres: Plan['apres']): Promise<Omit<Plan, 'cible' | 'apres'>> {
    const now = new Date();
    const moi = (u: { role: SystemRole; divisionId: string | null }, id: string) => (id === cible.id ? { role: apres.role, divisionId: apres.divisionId } : u);
    const nom = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

    const suppleances = await this.prisma.suppleance.findMany({
      where: { revokedAt: null, endDate: { gte: now }, OR: [{ titulaireId: cible.id }, { suppleantId: cible.id }] },
      select: {
        id: true,
        titulaireId: true,
        suppleantId: true,
        startDate: true,
        endDate: true,
        titulaire: { select: { ...PERSONNE, role: true, divisionId: true } },
        suppleant: { select: { ...PERSONNE, role: true, divisionId: true } },
      },
    });
    const suppleancesARevoquer: Plan['suppleancesARevoquer'] = [];
    const suppleancesConservees: Plan['suppleancesConservees'] = [];
    for (const s of suppleances) {
      const conforme = isComparableRank(moi(s.titulaire, s.titulaireId), moi(s.suppleant, s.suppleantId));
      const ligne = { id: s.id, titulaire: nom(s.titulaire), suppleant: nom(s.suppleant) };
      if (conforme) suppleancesConservees.push(ligne);
      else suppleancesARevoquer.push({ ...ligne, titulaireId: s.titulaireId, suppleantId: s.suppleantId, debut: s.startDate, fin: s.endDate });
    }

    const acces = await this.prisma.accesDelegueCourrier.findMany({
      where: { revoqueAt: null, OR: [{ ouvertParId: cible.id }, { beneficiaireId: cible.id }] },
      select: { id: true, ouvertParId: true, arriveeId: true, acteId: true },
    });
    const habilitations = await this.prisma.habilitationCourrier.findMany({
      where: { userId: cible.id, revoqueeAt: null },
      select: { id: true, uniteKey: true, registre: { select: { code: true } } },
    });
    const imputations = await this.prisma.imputationCourrier.findMany({
      where: { imputeAId: cible.id, statut: ImputationStatut.EN_COURS, courrier: { statut: { notIn: [ArriveeStatut.ANNULE, ArriveeStatut.CLASSE] } } },
      select: { id: true, courrier: { select: { id: true, numero: true } } },
    });

    // Visas attendus de cette personne, sur le cycle en cours d'un acte en visa :
    // lesquels ne correspondront plus à son poste après le changement ?
    const visas = await this.prisma.visaActe.findMany({
      where: { viseurAttenduId: cible.id, statut: VisaStatut.EN_ATTENTE, acte: { statut: ActeStatut.EN_VISA } },
      select: {
        niveau: true,
        cycle: true,
        acte: { select: { id: true, objet: true, cycle: true, redacteurId: true, redacteur: { select: { divisionId: true, sectionId: true, celluleId: true } } } },
      },
    });
    const visasDevenusObsoletes = visas
      .filter((v) => v.cycle === v.acte.cycle)
      .filter((v) => viseurOccupeLePoste(v.niveau, cible, v.acte.redacteur))
      .filter((v) => !viseurOccupeLePoste(v.niveau, { ...apres, status: UserStatus.ACTIF }, v.acte.redacteur))
      .map((v) => ({ acteId: v.acte.id, objet: v.acte.objet, redacteurId: v.acte.redacteurId }));

    const ouvertes = { notIn: [TaskStatus.TERMINEE, TaskStatus.VALIDEE] };
    const [assignees, creees, sessionsActives] = await Promise.all([
      this.prisma.task.count({ where: { status: ouvertes, assignees: { some: { userId: cible.id } } } }),
      this.prisma.task.count({ where: { status: ouvertes, createdById: cible.id } }),
      this.prisma.userSession.count({ where: { userId: cible.id, revokedAt: null } }),
    ]);

    const etaitChef = cible.role === SystemRole.CHEF_CELLULE && !!cible.celluleId;
    const seraChef = apres.role === SystemRole.CHEF_CELLULE && !!apres.celluleId;
    return {
      suppleancesARevoquer,
      suppleancesConservees,
      accesARevoquer: acces.map((a) => ({ id: a.id, sens: a.ouvertParId === cible.id ? 'ouvert' : 'recu', arriveeId: a.arriveeId, acteId: a.acteId })),
      habilitations: habilitations.map((h) => ({ id: h.id, registre: h.registre.code, uniteKey: h.uniteKey })),
      imputationsEnCours: imputations.map((i) => ({ id: i.id, courrierId: i.courrier.id, numero: i.courrier.numero })),
      visasDevenusObsoletes,
      taches: { assignees, creees },
      celluleQuittee: etaitChef && (!seraChef || apres.celluleId !== cible.celluleId) ? cible.celluleId : null,
      celluleNommee: seraChef && (!etaitChef || apres.celluleId !== cible.celluleId) ? apres.celluleId : null,
      sessionsActives,
    };
  }

  /** Relit l'unicité sous verrou de ligne de l'unité concernée (ou de la
   * table des utilisateurs pour DN/DNA) : sérialise deux nominations. */
  private async verrouillerEtRevererifierUnicite(tx: Prisma.TransactionClient, userId: string, a: Plan['apres']): Promise<void> {
    if (a.role === SystemRole.CHEF_DIVISION && a.divisionId) await tx.$queryRaw`SELECT id FROM divisions WHERE id = ${a.divisionId} FOR UPDATE`;
    else if (a.role === SystemRole.CHEF_SECTION && a.sectionId) await tx.$queryRaw`SELECT id FROM sections WHERE id = ${a.sectionId} FOR UPDATE`;
    else if (a.role === SystemRole.CHEF_CELLULE && a.celluleId) await tx.$queryRaw`SELECT id FROM cellules WHERE id = ${a.celluleId} FOR UPDATE`;
    else if (a.role === SystemRole.DN || a.role === SystemRole.DNA) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`role:${a.role}`}))`;
    else return;
    const where: Prisma.UserWhereInput = { role: a.role, status: UserStatus.ACTIF, id: { not: userId } };
    if (a.role === SystemRole.CHEF_DIVISION) where.divisionId = a.divisionId;
    if (a.role === SystemRole.CHEF_SECTION) where.sectionId = a.sectionId;
    if (a.role === SystemRole.CHEF_CELLULE) where.celluleId = a.celluleId;
    if ((await tx.user.count({ where })) > 0) {
      throw new ConflictException(`Ce poste (${ROLE_LIBELLE[a.role]}) vient d’être pourvu par ailleurs.`);
    }
  }

  private async libelleFonction(role: SystemRole, r: { divisionId: string | null; sectionId: string | null; celluleId: string | null }): Promise<string> {
    const unite = r.divisionId || r.celluleId ? ` — ${await this.history.describeAttachment(r)}` : '';
    return `${ROLE_LIBELLE[role]}${unite}`;
  }

  private presenter(plan: Plan) {
    const { cible, apres } = plan;
    return {
      userId: cible.id,
      avant: { role: cible.role, divisionId: cible.divisionId, sectionId: cible.sectionId, celluleId: cible.celluleId, supervisorId: cible.supervisorId, jobTitle: cible.jobTitle },
      apres,
      effets: {
        suppleancesRevoquees: plan.suppleancesARevoquer.map(({ id, titulaire, suppleant, debut, fin }) => ({ id, titulaire, suppleant, debut, fin })),
        suppleancesConservees: plan.suppleancesConservees,
        accesDeleguesRevoques: plan.accesARevoquer.length,
        habilitationsConservees: plan.habilitations,
        imputationsEnCours: plan.imputationsEnCours,
        circuitsDeVisaARecalculer: plan.visasDevenusObsoletes.map(({ acteId, objet }) => ({ acteId, objet })),
        taches: plan.taches,
        celluleQuittee: plan.celluleQuittee,
        celluleNommee: plan.celluleNommee,
        sessionsRevoquees: plan.sessionsActives,
      },
    };
  }

  private async notifier(plan: Plan, libApres: string): Promise<void> {
    const { cible } = plan;
    const nom = `${cible.firstName} ${cible.lastName}`;
    try {
      await this.notifications.notify(
        cible.id,
        NotificationType.ROLE_MODIFIE,
        'Votre rôle a changé',
        `Votre fonction est désormais : ${libApres}. Vos sessions ont été fermées : reconnectez-vous pour retrouver votre espace à jour.`,
        '/dashboard',
      );
      const drh = await this.prisma.user.findMany({ where: { role: SystemRole.DRH, status: UserStatus.ACTIF, id: { not: cible.id } }, select: { id: true } });
      await this.notifications.notifyMany(
        drh.map((d) => d.id),
        NotificationType.ROLE_MODIFIE,
        'Changement de rôle d’un agent',
        `${nom} a désormais la fonction : ${libApres}.`,
        `/personnel/${cible.id}`,
      );
      for (const s of plan.suppleancesARevoquer) {
        await this.notifications.notifyMany(
          [s.titulaireId, s.suppleantId],
          NotificationType.SUPPLEANCE_REVOQUEE,
          'Suppléance révoquée',
          `La suppléance de ${s.titulaire} par ${s.suppleant} a été révoquée : elle ne respecte plus la règle de rang comparable après un changement de rôle.`,
          '/suppleances',
        );
      }
      for (const v of plan.visasDevenusObsoletes) {
        await this.notifications.notify(
          v.redacteurId,
          NotificationType.ACTE_RENVOYE,
          'Circuit de visa à recalculer',
          'Le viseur attendu a changé de fonction : resoumettez l’acte pour recalculer le circuit de visa.',
          `/courrier?acte=${v.acteId}`,
        );
      }
    } catch (e) {
      // notify() journalise déjà les échecs d'email ; toute autre erreur ne doit
      // pas masquer un changement de rôle déjà enregistré.
      this.logger.error(`Notifications du changement de rôle de ${cible.id} : ${(e as Error).message}`);
    }
  }
}

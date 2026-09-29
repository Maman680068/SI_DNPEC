import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AuditAction,
  NotificationType,
  Prisma,
  RoleFonctionnel,
  StageStatut,
  StatutAgent,
  SystemRole,
  TaskStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AutorisationService } from './autorisation.service';
import { UnitesArbreService } from './unites-arbre.service';
import { ReprisesN1Service } from './reprise-n1.service';
import { ParametresService } from './parametres.service';
import { TachesPlanifieesService } from './taches-planifiees.service';
import { detenteursWhere } from './roles-fonctionnels';
import {
  CreerAgentDto,
  DepartDto,
  ListerAgentsDto,
  ModifierAgentDto,
  MotifDto,
  ProlongerDto,
  ReactiverDto,
} from './dto/agents.dto';

const STATUTS_TACHE_OUVERTS: TaskStatus[] = [TaskStatus.A_FAIRE, TaskStatus.EN_COURS, TaskStatus.SOUMISE_VALIDATION, TaskStatus.REJETEE];
const JOUR = 86_400_000;

export const LIBELLE_STATUT_AGENT: Record<StatutAgent, string> = {
  EN_ACTIVITE: 'En activité',
  SUSPENDU: 'Suspendu',
  PARTI: 'Parti',
};

const AGENT_SELECT = {
  id: true,
  matricule: true,
  matriculeProvisoire: true,
  nom: true,
  prenoms: true,
  genre: true,
  fonction: true,
  statut: true,
  dateFinPrevue: true,
  natureFinPrevue: true,
  alerteJ15At: true,
  alerteJ3At: true,
  finConfirmeeAt: true,
  dateDepart: true,
  motifDepart: true,
  createdAt: true,
  unite: { select: { id: true, code: true, libelle: true, type: true, dateFermeture: true } },
  compte: { select: { id: true, email: true, status: true, role: true } },
} satisfies Prisma.AgentSelect;

type AgentLu = Prisma.AgentGetPayload<{ select: typeof AGENT_SELECT }>;

/** Date du jour (UTC, sans heure) — les fins prévues sont des dates. */
function jourUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function dateFr(d: Date): string {
  return new Date(d).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

/**
 * Agents (socle NIMBA, §4 et §6) : la personne physique, distincte du compte
 * et qui survit au départ. Cycle de vie décidé par le DRH seul (annexe 2.2) :
 * En activité ⇄ Suspendu → Parti ; réactivation possible. Le départ désactive
 * le compte et transfère les tâches en cours au responsable de l'unité. Fin de
 * stage ou de contrat : alertes au DRH à J-15 puis J-3, décision du DRH
 * (prolonger ou confirmer), sinon passage automatique à « Parti » à l'échéance.
 */
/** Motif posé par le déclencheur de la base (socle N2) sur l'agent qu'il crée d'office. */
export const MOTIF_AGENT_CREE_PAR_LA_BASE = 'Compte sans agent : agent créé par la base';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger('Agents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly autorisation: AutorisationService,
    private readonly arbres: UnitesArbreService,
    private readonly reprise: ReprisesN1Service,
    private readonly parametres: ParametresService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  private estDrh(actor: AuthenticatedUser): boolean {
    return actor.rolesFonctionnels.includes(RoleFonctionnel.DRH);
  }
  private estAdmin(actor: AuthenticatedUser): boolean {
    return actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId;
  }

  private async exigerDrh(actor: AuthenticatedUser, action: 'C' | 'M' | 'V', agentId?: string): Promise<void> {
    await this.autorisation.exiger(actor, {
      action,
      objet: { type: 'Agent', id: agentId },
      rolesRequis: [RoleFonctionnel.DRH],
      perimetre: 'IGNORE',
    });
  }

  /** Actions possibles sur un agent, calculées ici (le web n'en calcule aucune). */
  private actions(actor: AuthenticatedUser, a: AgentLu): string[] {
    if (!this.estDrh(actor) || a.compte?.id === actor.id) return [];
    const out: string[] = ['MODIFIER'];
    if (a.statut === StatutAgent.EN_ACTIVITE) out.push('SUSPENDRE', 'DEPART');
    if (a.statut === StatutAgent.SUSPENDU) out.push('REACTIVER', 'DEPART');
    if (a.statut === StatutAgent.PARTI) out.push('REACTIVER');
    if (a.statut !== StatutAgent.PARTI && a.dateFinPrevue) {
      out.push('PROLONGER');
      if (!a.finConfirmeeAt) out.push('CONFIRMER_FIN');
    }
    return out;
  }

  private vue(actor: AuthenticatedUser, a: AgentLu, maintenant = new Date()) {
    const joursAvantFin = a.dateFinPrevue ? Math.round((jourUtc(a.dateFinPrevue) - jourUtc(maintenant)) / JOUR) : null;
    return {
      ...a,
      libelleStatut: LIBELLE_STATUT_AGENT[a.statut],
      joursAvantFin,
      finProche: joursAvantFin !== null && a.statut !== StatutAgent.PARTI && joursAvantFin <= 15,
      actions: this.actions(actor, a),
    };
  }

  // ---------------------------------------------------------------- lecture

  async lister(actor: AuthenticatedUser, f: ListerAgentsDto) {
    const rh = this.estDrh(actor) || actor.rolesFonctionnels.includes(RoleFonctionnel.GESTIONNAIRE_RH);
    // L'administrateur ne lit que les agents SANS compte (identité, unité) : il
    // en a besoin pour créer un compte (§13.5), jamais le reste du dossier.
    const adminCreation = this.estAdmin(actor) && f.sansCompte === 'true';
    if (!rh && !adminCreation) {
      throw new ForbiddenException({ message: 'Liste des agents réservée au DRH et au gestionnaire RH.', etape: 'ROLE', objetType: 'Agent' });
    }
    const maintenant = new Date();
    const where: Prisma.AgentWhereInput = {
      ...(f.statut ? { statut: f.statut as StatutAgent } : {}),
      ...(f.uniteId ? { uniteId: f.uniteId } : {}),
      ...(f.matriculeProvisoire === 'true' ? { matriculeProvisoire: true } : {}),
      ...(f.sansCompte === 'true' ? { compte: null, statut: StatutAgent.EN_ACTIVITE } : {}),
      ...(f.finProche === 'true' ? { statut: { not: StatutAgent.PARTI }, dateFinPrevue: { lte: new Date(maintenant.getTime() + 15 * JOUR) } } : {}),
      ...(f.recherche
        ? {
            OR: [
              { nom: { contains: f.recherche, mode: 'insensitive' } },
              { prenoms: { contains: f.recherche, mode: 'insensitive' } },
              { matricule: { contains: f.recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const page = f.page ?? 1;
    const taille = f.taille ?? 50;
    const [total, lignes] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({ where, select: AGENT_SELECT, orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }], skip: (page - 1) * taille, take: taille }),
    ]);
    return {
      droits: { peutCreer: this.estDrh(actor), peutGerer: this.estDrh(actor) },
      donnees: adminCreation
        ? lignes.map((a) => ({ id: a.id, matricule: a.matricule, nom: a.nom, prenoms: a.prenoms, fonction: a.fonction, unite: a.unite }))
        : lignes.map((a) => this.vue(actor, a, maintenant)),
      page,
      taille,
      total,
    };
  }

  async detail(actor: AuthenticatedUser, id: string) {
    const rh = this.estDrh(actor) || actor.rolesFonctionnels.includes(RoleFonctionnel.GESTIONNAIRE_RH);
    const a = await this.prisma.agent.findUnique({ where: { id }, select: AGENT_SELECT });
    if (!a) throw new NotFoundException('Agent introuvable');
    // L'agent lui-même consulte sa fiche (droit d'accès à ses données, SOC-DCP-04).
    if (!rh && a.compte?.id !== actor.id) {
      throw new ForbiddenException({ message: 'Fiche agent réservée au DRH, au gestionnaire RH et à l’agent lui-même.', etape: 'ROLE', objetType: 'Agent', objetId: id });
    }
    const mouvements = await this.prisma.mouvementAgent.findMany({
      where: { agentId: id },
      select: { id: true, type: true, avant: true, apres: true, motif: true, dateEffet: true, auteur: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dateEffet: 'desc' },
    });
    const arbre = await this.arbres.arbre();
    const chemin = a.unite ? this.arbres.ascendants(arbre, a.unite.id).map((u) => u.code).reverse() : [];
    return { ...this.vue(actor, a), cheminUnite: chemin, mouvements };
  }

  /** Points de reprise à traiter (calculés en direct : ils disparaissent quand la cause disparaît). */
  async pointsDeReprise(actor: AuthenticatedUser) {
    await this.exigerDrh(actor, 'M');
    const [provisoires, unites, stagiairesSansFin] = await Promise.all([
      this.prisma.agent.count({ where: { matriculeProvisoire: true, statut: { not: StatutAgent.PARTI } } }),
      this.prisma.uniteOrganisationnelle.findMany({
        where: { dateFermeture: null, responsableId: null },
        select: { id: true, code: true, libelle: true, type: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.agent.count({ where: { statut: { not: StatutAgent.PARTI }, dateFinPrevue: null, compte: { role: SystemRole.STAGIAIRE } } }),
    ]);
    const chefsParDivision = await this.prisma.user.groupBy({ by: ['divisionId'], where: { role: SystemRole.CHEF_DIVISION, status: UserStatus.ACTIF, divisionId: { not: null } }, _count: { _all: true } });
    const chefsParSection = await this.prisma.user.groupBy({ by: ['sectionId'], where: { role: SystemRole.CHEF_SECTION, status: UserStatus.ACTIF, sectionId: { not: null } }, _count: { _all: true } });
    const doublons = chefsParDivision.filter((c) => c._count._all > 1).length + chefsParSection.filter((c) => c._count._all > 1).length;
    const suspendues = await this.prisma.agent.count({
      where: {
        statut: { not: StatutAgent.PARTI },
        unite: { OR: [{ division: { isActive: false } }, { section: { isActive: false } }, { cellule: { isActive: false } }] },
      },
    });
    return {
      matriculesProvisoires: provisoires,
      unitesSansResponsable: unites.filter((u) => u.type !== 'DIRECTION'),
      chefsEnDouble: doublons,
      agentsDansUniteSuspendue: suspendues,
      stagiairesSansDateDeFin: stagiairesSansFin,
    };
  }

  // ---------------------------------------------------------------- écriture

  /**
   * « Aucun compte sans agent » (§4) : à la création d'un compte ou à
   * l'approbation d'une inscription, rattache l'agent choisi (agent en activité
   * SANS compte — rapprochement) ou crée l'agent du compte (matricule donné,
   * sinon provisoire). Puis l'unité de l'agent suit le rattachement du compte.
   */
  async verifierRattachement(opts: { agentId?: string; matricule?: string }): Promise<void> {
    if (opts.agentId) {
      const a = await this.prisma.agent.findUnique({ where: { id: opts.agentId }, select: { statut: true, compte: { select: { id: true } } } });
      if (!a) throw new NotFoundException('Agent introuvable');
      if (a.compte) throw new ConflictException('Cet agent a déjà un compte.');
      if (a.statut !== StatutAgent.EN_ACTIVITE) throw new ConflictException('Seul un agent en activité peut recevoir un compte.');
    } else if (opts.matricule && (await this.prisma.agent.findUnique({ where: { matricule: opts.matricule }, select: { id: true } }))) {
      throw new ConflictException('Ce matricule est déjà attribué : choisissez l’agent existant.');
    }
  }

  async rattacherCompte(userId: string, opts: { agentId?: string; matricule?: string }, auteurId: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, jobTitle: true, agentId: true } });
    if (!u) return;
    if (u.agentId) {
      // Socle N2 : la base donne d'office un agent provisoire à tout compte actif (aucun compte sans
      // agent). S'il vient d'être créé ainsi, il cède la place à l'agent choisi ou reçoit le matricule.
      await this.remplacerAgentProvisoire(userId, u.agentId, opts, auteurId);
      await this.reprise.synchroniserCompte(userId);
      return;
    }
    if (opts.agentId) {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: userId }, data: { agentId: opts.agentId } }),
        this.prisma.mouvementAgent.create({ data: { agentId: opts.agentId, type: 'COMPTE', apres: { compteId: userId }, motif: 'Compte rattaché', auteurId } }),
      ]);
    } else {
      await this.prisma.$transaction(async (tx) => {
        const matricule = opts.matricule ?? (await this.reprise.matriculeProvisoire(tx));
        const a = await tx.agent.create({
          data: { matricule, matriculeProvisoire: !opts.matricule, nom: u.lastName, prenoms: u.firstName, fonction: u.jobTitle },
        });
        await tx.user.update({ where: { id: userId }, data: { agentId: a.id } });
        await tx.mouvementAgent.create({ data: { agentId: a.id, type: 'ENTREE', apres: { matricule, compteId: userId }, auteurId } });
      });
    }
    await this.reprise.synchroniserCompte(userId);
  }

  private async remplacerAgentProvisoire(userId: string, agentId: string, opts: { agentId?: string; matricule?: string }, auteurId: string): Promise<void> {
    if (!opts.agentId && !opts.matricule) return;
    const mouvements = await this.prisma.mouvementAgent.findMany({ where: { agentId }, select: { motif: true } });
    const creeParLaBase = mouvements.length === 1 && mouvements[0]!.motif === MOTIF_AGENT_CREE_PAR_LA_BASE;
    if (!creeParLaBase || opts.agentId === agentId) return;
    await this.prisma.$transaction(async (tx) => {
      if (opts.agentId) {
        await tx.user.update({ where: { id: userId }, data: { agentId: opts.agentId } });
        await tx.mouvementAgent.create({ data: { agentId: opts.agentId, type: 'COMPTE', apres: { compteId: userId }, motif: 'Compte rattaché', auteurId } });
        await tx.mouvementAgent.deleteMany({ where: { agentId } });
        await tx.agent.delete({ where: { id: agentId } });
      } else if (opts.matricule) {
        await tx.agent.update({ where: { id: agentId }, data: { matricule: opts.matricule, matriculeProvisoire: false } });
        await tx.mouvementAgent.create({ data: { agentId, type: 'MATRICULE', apres: { matricule: opts.matricule }, motif: 'Matricule donné à la création du compte', auteurId } });
      }
    });
  }

  async creer(actor: AuthenticatedUser, dto: CreerAgentDto) {
    await this.exigerDrh(actor, 'C');
    const unite = await this.prisma.uniteOrganisationnelle.findUnique({ where: { id: dto.uniteId }, select: { dateFermeture: true } });
    if (!unite) throw new NotFoundException('Unité introuvable');
    if (unite.dateFermeture) throw new ConflictException('Cette unité est fermée.');
    if (dto.dateFinPrevue && !dto.natureFinPrevue) throw new BadRequestException('Précisez s’il s’agit d’une fin de stage ou de contrat.');
    const cree = await this.prisma.$transaction(async (tx) => {
      const matricule = dto.matricule ?? (await this.reprise.matriculeProvisoire(tx));
      if (dto.matricule && (await tx.agent.findUnique({ where: { matricule } }))) throw new ConflictException('Ce matricule est déjà attribué.');
      const a = await tx.agent.create({
        data: {
          matricule, matriculeProvisoire: !dto.matricule, nom: dto.nom, prenoms: dto.prenoms, genre: dto.genre,
          uniteId: dto.uniteId, fonction: dto.fonction,
          dateFinPrevue: dto.dateFinPrevue ? new Date(dto.dateFinPrevue) : null, natureFinPrevue: dto.natureFinPrevue ?? null,
        },
        select: AGENT_SELECT,
      });
      await tx.mouvementAgent.create({ data: { agentId: a.id, type: 'ENTREE', apres: { matricule, uniteId: dto.uniteId }, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Agent', entityId: a.id, metadata: { matricule } }, tx);
      return a;
    });
    return this.vue(actor, cree);
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierAgentDto) {
    await this.exigerDrh(actor, 'M', id);
    const a = await this.prisma.agent.findUnique({ where: { id }, select: AGENT_SELECT });
    if (!a) throw new NotFoundException('Agent introuvable');
    if (a.compte?.id === actor.id) throw new ForbiddenException({ message: 'Vous ne pouvez pas modifier votre propre fiche agent.', etape: 'PERIMETRE', objetType: 'Agent', objetId: id });
    if (dto.dateFinPrevue && a.natureFinPrevue === 'STAGE' && dto.natureFinPrevue !== 'CONTRAT') {
      throw new BadRequestException('La fin d’un stage se prolonge par l’action « Prolonger le stage ».');
    }
    const data: Prisma.AgentUpdateInput = {};
    const avant: Record<string, unknown> = {};
    const apres: Record<string, unknown> = {};
    const champ = (k: 'nom' | 'prenoms' | 'genre' | 'fonction', v: string | undefined) => {
      if (v !== undefined && v !== a[k]) {
        data[k] = v;
        avant[k] = a[k];
        apres[k] = v;
      }
    };
    champ('nom', dto.nom);
    champ('prenoms', dto.prenoms);
    champ('genre', dto.genre);
    champ('fonction', dto.fonction);
    if (dto.matricule && dto.matricule !== a.matricule) {
      const pris = await this.prisma.agent.findUnique({ where: { matricule: dto.matricule }, select: { id: true } });
      if (pris) throw new ConflictException('Ce matricule est déjà attribué à un autre agent.');
      data.matricule = dto.matricule;
      data.matriculeProvisoire = false;
      avant.matricule = a.matricule;
      apres.matricule = dto.matricule;
    }
    if (dto.dateFinPrevue !== undefined) {
      const d = new Date(dto.dateFinPrevue);
      data.dateFinPrevue = d;
      data.natureFinPrevue = dto.natureFinPrevue ?? a.natureFinPrevue ?? 'CONTRAT';
      data.alerteJ15At = null;
      data.alerteJ3At = null;
      data.finConfirmeeAt = null;
      avant.dateFinPrevue = a.dateFinPrevue;
      apres.dateFinPrevue = d;
    }
    if (Object.keys(apres).length === 0) return this.vue(actor, a);
    const maj = await this.prisma.$transaction(async (tx) => {
      const r = await tx.agent.update({ where: { id }, data, select: AGENT_SELECT });
      await tx.mouvementAgent.create({ data: { agentId: id, type: apres.matricule ? 'MATRICULE' : 'IDENTITE', avant: avant as Prisma.InputJsonValue, apres: apres as Prisma.InputJsonValue, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Agent', entityId: id, metadata: { avant, apres } as Prisma.InputJsonValue }, tx);
      return r;
    });
    return this.vue(actor, maj);
  }

  private async chargerPourTransition(actor: AuthenticatedUser | null, id: string): Promise<AgentLu> {
    const a = await this.prisma.agent.findUnique({ where: { id }, select: AGENT_SELECT });
    if (!a) throw new NotFoundException('Agent introuvable');
    if (actor && a.compte?.id === actor.id) {
      throw new ForbiddenException({ message: 'Vous ne pouvez pas changer votre propre situation.', etape: 'PERIMETRE', objetType: 'Agent', objetId: id });
    }
    return a;
  }

  async suspendre(actor: AuthenticatedUser, id: string, dto: MotifDto) {
    await this.exigerDrh(actor, 'V', id);
    const a = await this.chargerPourTransition(actor, id);
    if (a.statut !== StatutAgent.EN_ACTIVITE) throw new ConflictException(`Transition impossible : l’agent est « ${LIBELLE_STATUT_AGENT[a.statut]} ».`);
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id }, data: { statut: StatutAgent.SUSPENDU } });
      if (a.compte && a.compte.status === UserStatus.ACTIF) {
        await tx.user.update({ where: { id: a.compte.id }, data: { status: UserStatus.SUSPENDU } });
        await tx.userSession.deleteMany({ where: { userId: a.compte.id } });
      }
      await tx.mouvementAgent.create({ data: { agentId: id, type: 'SUSPENSION', avant: { statut: a.statut }, apres: { statut: StatutAgent.SUSPENDU }, motif: dto.motif, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Agent', entityId: id, metadata: { event: 'suspension', motif: dto.motif } }, tx);
    });
    return this.detail(actor, id);
  }

  async reactiver(actor: AuthenticatedUser, id: string, dto: ReactiverDto) {
    await this.exigerDrh(actor, 'V', id);
    const a = await this.chargerPourTransition(actor, id);
    if (a.statut === StatutAgent.EN_ACTIVITE) throw new ConflictException('L’agent est déjà en activité.');
    const aujourdhui = jourUtc(new Date());
    const nouvelleFin = dto.nouvelleDateFin ? new Date(dto.nouvelleDateFin) : null;
    if (nouvelleFin && jourUtc(nouvelleFin) < aujourdhui) throw new BadRequestException('La nouvelle date de fin est déjà passée.');
    if (!nouvelleFin && a.dateFinPrevue && jourUtc(a.dateFinPrevue) < aujourdhui) {
      throw new BadRequestException('La fin prévue est passée : indiquez une nouvelle date de fin, sinon l’agent repartirait aussitôt.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id },
        data: {
          statut: StatutAgent.EN_ACTIVITE, dateDepart: null, motifDepart: null,
          ...(nouvelleFin ? { dateFinPrevue: nouvelleFin, alerteJ15At: null, alerteJ3At: null, finConfirmeeAt: null } : {}),
        },
      });
      if (a.compte && (a.compte.status === UserStatus.SUSPENDU || a.compte.status === UserStatus.SUPPRIME)) {
        await tx.user.update({ where: { id: a.compte.id }, data: { status: UserStatus.ACTIF } });
      }
      await tx.mouvementAgent.create({
        data: { agentId: id, type: 'REACTIVATION', avant: { statut: a.statut }, apres: { statut: StatutAgent.EN_ACTIVITE, ...(nouvelleFin ? { dateFinPrevue: nouvelleFin } : {}) }, motif: dto.motif, auteurId: actor.id },
      });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Agent', entityId: id, metadata: { event: 'reactivation', motif: dto.motif } }, tx);
    });
    return this.detail(actor, id);
  }

  async depart(actor: AuthenticatedUser, id: string, dto: DepartDto) {
    await this.exigerDrh(actor, 'V', id);
    const a = await this.chargerPourTransition(actor, id);
    if (a.statut === StatutAgent.PARTI) throw new ConflictException('L’agent est déjà parti.');
    const date = new Date(dto.dateDepart);
    if (jourUtc(date) > jourUtc(new Date())) throw new BadRequestException('La date de départ ne peut pas être dans le futur : utilisez la fin prévue.');
    await this.enregistrerDepart(a, date, dto.motif, actor.id);
    return this.detail(actor, id);
  }

  /**
   * Départ (DRH, ou système à l'échéance d'une fin prévue) : compte désactivé et
   * sessions fermées ; tâches en cours transférées au responsable de l'unité ;
   * suppléances en cours révoquées ; rôles fonctionnels et habilitations
   * historiques retirés ; dossier conservé. Tout dans une transaction.
   */
  private async enregistrerDepart(a: AgentLu, date: Date, motif: string, auteurId: string | null): Promise<void> {
    const maintenant = new Date();
    const compteId = a.compte?.id ?? null;
    const transfert = await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id: a.id }, data: { statut: StatutAgent.PARTI, dateDepart: date, motifDepart: motif } });
      let transfert: { destinataireId: string | null; taches: string[] } = { destinataireId: null, taches: [] };
      if (compteId) {
        await tx.user.update({ where: { id: compteId }, data: { status: UserStatus.SUPPRIME } });
        await tx.userSession.deleteMany({ where: { userId: compteId } });
        transfert = await this.transfererTaches(tx, a, compteId, auteurId);
        await tx.suppleance.updateMany({
          where: { revokedAt: null, endDate: { gte: maintenant }, OR: [{ titulaireId: compteId }, { suppleantId: compteId }] },
          data: { revokedAt: maintenant, revokedById: auteurId },
        });
        await tx.attributionRole.updateMany({ where: { userId: compteId, retireLe: null }, data: { retireLe: maintenant, retireParId: auteurId, motifRetrait: 'Départ de l’agent' } });
        await tx.habilitationCourrier.updateMany({ where: { userId: compteId, revoqueeAt: null }, data: { revoqueeAt: maintenant, revoqueeParId: auteurId ?? compteId } });
        await tx.habilitationLogistique.updateMany({ where: { userId: compteId, revoqueeAt: null }, data: { revoqueeAt: maintenant, revoqueeParId: auteurId ?? compteId } });
      }
      await tx.mouvementAgent.create({
        data: { agentId: a.id, type: 'DEPART', avant: { statut: a.statut }, apres: { statut: StatutAgent.PARTI, tachesTransferees: transfert.taches.length }, motif, dateEffet: date, auteurId },
      });
      await this.audit.log({ actorId: auteurId, action: AuditAction.MODIFICATION, entityType: 'Agent', entityId: a.id, metadata: { event: 'depart', motif, date, tachesTransferees: transfert.taches, destinataire: transfert.destinataireId } }, tx);
      return transfert;
    });

    // Après le commit : responsable d'unité recalculé (poste vacant) et notifications.
    const vacants = compteId
      ? await this.prisma.uniteOrganisationnelle.findMany({ where: { responsableId: compteId, dateFermeture: null }, select: { code: true, libelle: true } })
      : [];
    await this.reprise.synchroniserCompte(compteId ?? undefined);
    const nom = `${a.prenoms} ${a.nom}`;
    if (transfert.destinataireId && transfert.taches.length) {
      await this.notifications.notify(
        transfert.destinataireId,
        NotificationType.TACHE_ASSIGNEE,
        'Tâches transférées',
        `${transfert.taches.length} tâche(s) en cours de ${nom} vous ont été transférées après son départ.`,
        '/tasks',
      );
    }
    const drh = await this.idsDrh();
    if (vacants.length) {
      await this.notifications.notifyMany(
        drh,
        NotificationType.DOSSIER_ERREUR_SIGNALEE,
        'Poste de responsable vacant',
        `Après le départ de ${nom}, ${vacants.map((v) => `${v.code} (${v.libelle})`).join(', ')} n’a plus de responsable.`,
        '/organisation',
        undefined,
        { libelleBouton: 'Voir l’organigramme' },
      );
    }
  }

  /**
   * Tâches ouvertes dont le partant est responsable ou co-responsable : confiées
   * au responsable actif le plus proche (unité, puis unités parentes), à défaut
   * au DN. Même rôle sur la tâche ; tracé tâche par tâche.
   */
  private async transfererTaches(tx: Prisma.TransactionClient, a: AgentLu, compteId: string, auteurId: string | null) {
    const arbre = await this.arbres.arbre();
    let destinataireId: string | null = null;
    if (a.unite) {
      for (const u of this.arbres.ascendants(arbre, a.unite.id)) {
        if (u.responsableId && u.responsableId !== compteId) {
          const actif = await tx.user.findFirst({ where: { id: u.responsableId, status: UserStatus.ACTIF }, select: { id: true } });
          if (actif) {
            destinataireId = actif.id;
            break;
          }
        }
      }
    }
    if (!destinataireId) {
      const dn = await tx.user.findFirst({ where: { role: SystemRole.DN, status: UserStatus.ACTIF, id: { not: compteId } }, select: { id: true }, orderBy: { createdAt: 'asc' } });
      destinataireId = dn?.id ?? null;
    }
    if (!destinataireId) return { destinataireId: null, taches: [] as string[] };
    const affectations = await tx.taskAssignee.findMany({
      where: { userId: compteId, task: { status: { in: STATUTS_TACHE_OUVERTS } } },
      select: { id: true, taskId: true, roleOnTask: true },
    });
    const taches: string[] = [];
    for (const aff of affectations) {
      const deja = await tx.taskAssignee.findUnique({ where: { taskId_userId: { taskId: aff.taskId, userId: destinataireId } }, select: { id: true } });
      if (deja) await tx.taskAssignee.delete({ where: { id: aff.id } });
      else await tx.taskAssignee.update({ where: { id: aff.id }, data: { userId: destinataireId, assignedAt: new Date() } });
      taches.push(aff.taskId);
      await this.audit.log({ actorId: auteurId, action: AuditAction.MODIFICATION, entityType: 'Task', entityId: aff.taskId, metadata: { event: 'transfert_depart', de: compteId, vers: destinataireId } }, tx);
    }
    return { destinataireId, taches };
  }

  // ---------------------------------------------------------------- fins prévues (stage, contrat)

  async prolonger(actor: AuthenticatedUser, id: string, dto: ProlongerDto) {
    await this.exigerDrh(actor, 'V', id);
    const a = await this.chargerPourTransition(actor, id);
    if (a.statut === StatutAgent.PARTI) throw new ConflictException('L’agent est parti : réactivez-le avec une nouvelle date de fin.');
    if (!a.dateFinPrevue) throw new ConflictException('Aucune fin prévue à prolonger.');
    const nouvelle = new Date(dto.nouvelleDateFin);
    if (jourUtc(nouvelle) <= jourUtc(a.dateFinPrevue) || jourUtc(nouvelle) < jourUtc(new Date())) {
      throw new BadRequestException('La nouvelle date de fin doit suivre la fin prévue actuelle.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id }, data: { dateFinPrevue: nouvelle, alerteJ15At: null, alerteJ3At: null, finConfirmeeAt: null } });
      // Stagiaire : le stage en cours suit la nouvelle date (le module Stages en reste la référence).
      if (a.natureFinPrevue === 'STAGE' && a.compte) {
        const stage = await tx.stage.findFirst({ where: { stagiaireId: a.compte.id, statut: { in: [StageStatut.PREVU, StageStatut.EN_COURS] } }, orderBy: { dateFin: 'desc' }, select: { id: true, dateFin: true } });
        if (stage) {
          await tx.stage.update({ where: { id: stage.id }, data: { dateFin: nouvelle } });
          await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Stage', entityId: stage.id, metadata: { event: 'prolongation', avant: stage.dateFin, apres: nouvelle, motif: dto.motif } }, tx);
        }
      }
      await tx.mouvementAgent.create({ data: { agentId: id, type: 'PROLONGATION', avant: { dateFinPrevue: a.dateFinPrevue }, apres: { dateFinPrevue: nouvelle }, motif: dto.motif, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Agent', entityId: id, metadata: { event: 'prolongation', avant: a.dateFinPrevue, apres: nouvelle, motif: dto.motif } }, tx);
    });
    return this.detail(actor, id);
  }

  /** Le DRH confirme la fin : plus de rappel, passage à « Parti » à l'échéance. */
  async confirmerFin(actor: AuthenticatedUser, id: string) {
    await this.exigerDrh(actor, 'V', id);
    const a = await this.chargerPourTransition(actor, id);
    if (a.statut === StatutAgent.PARTI || !a.dateFinPrevue) throw new ConflictException('Aucune fin prévue à confirmer.');
    if (a.finConfirmeeAt) throw new ConflictException('La fin est déjà confirmée.');
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id }, data: { finConfirmeeAt: new Date() } });
      await tx.mouvementAgent.create({ data: { agentId: id, type: 'FIN_CONFIRMEE', apres: { dateFinPrevue: a.dateFinPrevue }, auteurId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'Agent', entityId: id, metadata: { event: 'fin_confirmee', dateFinPrevue: a.dateFinPrevue } }, tx);
    });
    return this.detail(actor, id);
  }

  private async idsDrh(): Promise<string[]> {
    return (await this.prisma.user.findMany({ where: detenteursWhere(RoleFonctionnel.DRH), select: { id: true } })).map((u) => u.id);
  }

  @Cron('15 0 * * *')
  async executerQuotidien(): Promise<void> {
    try {
      await this.taches.suivre('fins-prevues', () => this.executer(new Date()));
    } catch (e) {
      this.logger.error(`Fins prévues : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Fins prévues (appelable avec une date simulée, comme les autres jobs) :
   * - J-15 : alerte au DRH (une fois) ;
   * - J-3 : rappel au DRH, sauf fin déjà confirmée ;
   * - lendemain de la date de fin (la date de fin est le dernier jour) : passage
   *   automatique à « Parti », compte désactivé, notification au DRH le jour même.
   * Idempotent : chaque étape n'agit qu'une fois (horodatages sur l'agent).
   */
  async executer(maintenant: Date) {
    const bilan = { alertesJ15: 0, rappelsJ3: 0, departs: 0 };
    // Première alerte : paramètre (socle N2, 15 jours par défaut) ; le rappel reste à J-3.
    const joursAlerte = await this.parametres.valeur('finPrevue.alerteJours');
    const aujourdhui = jourUtc(maintenant);
    const agents = await this.prisma.agent.findMany({
      where: { statut: { not: StatutAgent.PARTI }, dateFinPrevue: { not: null } },
      select: AGENT_SELECT,
    });
    const drh = await this.idsDrh();
    for (const a of agents) {
      const fin = jourUtc(a.dateFinPrevue!);
      const jours = Math.round((fin - aujourdhui) / JOUR);
      const nom = `${a.prenoms} ${a.nom}`;
      const stage = a.natureFinPrevue === 'STAGE';
      const quoi = stage ? 'Fin de stage' : 'Fin de contrat';
      const lien = `/agents?id=${a.id}`;
      const type = stage ? NotificationType.STAGE_ALERTE : NotificationType.DOSSIER_ERREUR_SIGNALEE;
      if (aujourdhui > fin) {
        const motif = `${quoi} au ${dateFr(a.dateFinPrevue!)}${a.finConfirmeeAt ? ' (confirmée par le DRH)' : ' (sans décision du DRH)'}`;
        await this.enregistrerDepart(a, new Date(maintenant), motif, null);
        await this.notifications.notifyMany(drh, type, `${nom} est passé(e) « Parti »`, `${motif} : compte désactivé automatiquement. Le dossier, l’évaluation et l’attestation sont conservés ; vous pouvez réactiver l’agent.`, lien, nom, { libelleBouton: 'Voir l’agent' });
        bilan.departs++;
        continue;
      }
      if (jours <= 3 && !a.alerteJ3At && !a.finConfirmeeAt) {
        await this.prisma.agent.update({ where: { id: a.id }, data: { alerteJ3At: maintenant, alerteJ15At: a.alerteJ15At ?? maintenant } });
        await this.notifications.notifyMany(drh, type, `Rappel : ${quoi.toLowerCase()} de ${nom} le ${dateFr(a.dateFinPrevue!)}`, `Sans décision de votre part, ${nom} passera « Parti » et son compte sera désactivé à l’échéance. Vous pouvez prolonger ${stage ? 'le stage' : 'le contrat'} ou confirmer la fin.`, lien, nom, { libelleBouton: stage ? 'Décider de la fin du stage' : 'Décider de la fin du contrat' });
        bilan.rappelsJ3++;
        continue;
      }
      if (jours <= joursAlerte && !a.alerteJ15At) {
        await this.prisma.agent.update({ where: { id: a.id }, data: { alerteJ15At: maintenant } });
        await this.notifications.notifyMany(drh, type, `${quoi} de ${nom} le ${dateFr(a.dateFinPrevue!)}`, `Dans ${jours} jour(s). Vous pouvez prolonger ${stage ? 'le stage' : 'le contrat'} (nouvelle date, motif) ou confirmer la fin. Sans décision, le passage à « Parti » sera automatique à l’échéance.`, lien, nom, { libelleBouton: stage ? 'Décider de la fin du stage' : 'Décider de la fin du contrat' });
        bilan.alertesJ15++;
      }
    }
    return bilan;
  }
}

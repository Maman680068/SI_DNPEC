import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  RoleFonctionnel,
  StageStatut,
  StatutAgent,
  SystemRole,
  TypeUnite,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { Arbre, UnitesArbreService } from './unites-arbre.service';

/** Codes et identités stables de la reprise (jamais recréés s'ils ont été fermés). */
export const CODE_DIRECTION = 'DNPEC';
export const LIBELLE_DIRECTION = 'Direction Nationale des Prévisions Économiques et de la Conjoncture';
export const CODE_SECRETARIAT = 'SECDIR';
export const LIBELLE_SECRETARIAT = 'Secrétariat de direction';
/** Marque de la reprise initiale des rôles (journal d'audit, entityType Parametrage). */
const MARQUE_REPRISE_INITIALE = 'reprise-n1-roles';
const EVENEMENT_REPRISE_INITIALE = 'REPRISE_INITIALE';

export interface RapportReprise {
  unitesCreees: number;
  unitesSynchronisees: number;
  responsablesMisAJour: number;
  agentsCrees: number;
  agentsMutes: number;
  attributionsCreees: number;
  attributionsRetirees: number;
}

type Client = Prisma.TransactionClient | PrismaService;

/**
 * Reprise des données existantes vers le socle NIMBA (lot N1) — IDEMPOTENTE :
 * - au démarrage de l'API (reprise initiale, puis rattrapage de tout ce qu'une
 *   version précédente de l'API aurait écrit pendant un retour arrière) ;
 * - après un changement de rôle ou de rattachement (synchroniserCompte).
 *
 * En N1, les tables historiques restent la source des modules : divisions,
 * sections, cellules (unités), users.role + rattachement (position, unité de
 * l'agent, responsable d'unité), habilitations courrier et logistique (rôles
 * AGENT_COURRIER et GESTIONNAIRE_LOGISTIQUE). Cette reprise en tient le reflet.
 * Seules les données propres à N1 (agents : statut, matricule, fin prévue ;
 * fermeture et historique des unités ; autres rôles fonctionnels) sont
 * décidées dans le nouveau référentiel.
 */
@Injectable()
export class ReprisesN1Service implements OnApplicationBootstrap {
  private readonly logger = new Logger('RepriseN1');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly arbres: UnitesArbreService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const r = await this.reconcilier();
      this.logger.log(`Reprise N1 : ${JSON.stringify(r)}`);
    } catch (e) {
      // Ne bloque jamais le démarrage : l'API reste utilisable, l'écart est
      // rattrapé au prochain démarrage ou à la prochaine synchronisation.
      this.logger.error(`Reprise N1 en échec : ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    }
  }

  async reconcilier(): Promise<RapportReprise> {
    const r: RapportReprise = {
      unitesCreees: 0, unitesSynchronisees: 0, responsablesMisAJour: 0, agentsCrees: 0,
      agentsMutes: 0, attributionsCreees: 0, attributionsRetirees: 0,
    };
    await this.reconcilierUnites(r);
    await this.reconcilierResponsables(r);
    await this.reconcilierAgents(r);
    await this.reconcilierRoles(r);
    this.arbres.invalider();
    if (Object.values(r).some((n) => n > 0)) {
      await this.audit.log({
        actorId: null,
        action: AuditAction.MODIFICATION,
        entityType: 'Parametrage',
        entityId: 'reprise-n1',
        metadata: { event: 'reprise_n1', ...r } as unknown as Prisma.InputJsonValue,
      });
    }
    return r;
  }

  /**
   * Après une écriture historique ponctuelle (changement de rôle, rattachement,
   * approbation, import, création de stagiaire) : agent du compte, son unité,
   * responsables d'unité. Léger, sans reprise des rôles.
   */
  async synchroniserCompte(userId?: string): Promise<void> {
    const r = { unitesCreees: 0, unitesSynchronisees: 0, responsablesMisAJour: 0, agentsCrees: 0, agentsMutes: 0, attributionsCreees: 0, attributionsRetirees: 0 };
    await this.reconcilierUnites(r);
    await this.reconcilierResponsables(r);
    await this.reconcilierAgents(r, userId);
    this.arbres.invalider();
  }

  // ---------------------------------------------------------------- unités

  private async historique(tx: Client, uniteId: string, evenement: string, avant: unknown, apres: unknown): Promise<void> {
    await tx.historiqueUnite.create({
      data: {
        uniteId,
        evenement,
        avant: (avant ?? undefined) as Prisma.InputJsonValue | undefined,
        apres: (apres ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async reconcilierUnites(r: RapportReprise): Promise<void> {
    // Direction (racine unique).
    let direction = await this.prisma.uniteOrganisationnelle.findFirst({ where: { type: TypeUnite.DIRECTION, parentId: null } });
    if (!direction) {
      direction = await this.prisma.uniteOrganisationnelle.create({
        data: { code: CODE_DIRECTION, libelle: LIBELLE_DIRECTION, type: TypeUnite.DIRECTION },
      });
      await this.historique(this.prisma, direction.id, 'CREATION', null, { code: CODE_DIRECTION, origine: 'reprise' });
      r.unitesCreees++;
    }

    // Secrétariat de direction : créé une seule fois (jamais recréé s'il a été fermé).
    const secretariat = await this.prisma.cellule.findUnique({ where: { code: CODE_SECRETARIAT } });
    if (!secretariat) {
      await this.prisma.cellule.create({ data: { code: CODE_SECRETARIAT, name: LIBELLE_SECRETARIAT } });
    }

    const [divisions, sections, cellules, unites] = await Promise.all([
      this.prisma.division.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.section.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.cellule.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.uniteOrganisationnelle.findMany(),
    ]);
    const parDivision = new Map(unites.filter((u) => u.divisionId).map((u) => [u.divisionId!, u]));
    const parSection = new Map(unites.filter((u) => u.sectionId).map((u) => [u.sectionId!, u]));
    const parCellule = new Map(unites.filter((u) => u.celluleId).map((u) => [u.celluleId!, u]));

    const synchroniser = async (u: { id: string; code: string; libelle: string; parentId: string | null }, code: string, libelle: string, parentId: string | null) => {
      if (u.code === code && u.libelle === libelle && u.parentId === parentId) return;
      await this.prisma.uniteOrganisationnelle.update({ where: { id: u.id }, data: { code, libelle, parentId } });
      await this.historique(this.prisma, u.id, 'MODIFICATION', { code: u.code, libelle: u.libelle, parentId: u.parentId }, { code, libelle, parentId, origine: 'synchronisation' });
      r.unitesSynchronisees++;
    };

    for (const d of divisions) {
      const u = parDivision.get(d.id);
      if (u) {
        await synchroniser(u, d.code, d.name, direction.id);
        continue;
      }
      const cree = await this.prisma.uniteOrganisationnelle.create({
        data: { code: d.code, libelle: d.name, type: TypeUnite.DIVISION, parentId: direction.id, divisionId: d.id, dateCreation: d.createdAt },
      });
      parDivision.set(d.id, cree);
      await this.historique(this.prisma, cree.id, 'CREATION', null, { code: d.code, origine: 'reprise' });
      r.unitesCreees++;
    }
    for (const s of sections) {
      const parent = parDivision.get(s.divisionId);
      if (!parent) continue;
      const u = parSection.get(s.id);
      if (u) {
        await synchroniser(u, s.code, s.name, parent.id);
        continue;
      }
      const cree = await this.prisma.uniteOrganisationnelle.create({
        data: { code: s.code, libelle: s.name, type: TypeUnite.SECTION, parentId: parent.id, sectionId: s.id, dateCreation: s.createdAt },
      });
      await this.historique(this.prisma, cree.id, 'CREATION', null, { code: s.code, origine: 'reprise' });
      r.unitesCreees++;
    }
    for (const c of cellules) {
      const u = parCellule.get(c.id);
      if (u) {
        await synchroniser(u, c.code, c.name, direction.id);
        continue;
      }
      const cree = await this.prisma.uniteOrganisationnelle.create({
        data: { code: c.code, libelle: c.name, type: TypeUnite.CELLULE, parentId: direction.id, celluleId: c.id, dateCreation: c.createdAt },
      });
      await this.historique(this.prisma, cree.id, 'CREATION', null, { code: c.code, origine: 'reprise' });
      r.unitesCreees++;
    }
    this.arbres.invalider();
  }

  /**
   * Responsable d'unité = reflet de la nomination actuelle (changement de rôle) :
   * chef de division ou de section actif (rôle + rattachement), chef de cellule
   * (Cellule.chefId), DN pour la Direction. Deux candidats : poste laissé vide
   * et signalé dans les points de reprise, jamais tranché au hasard.
   */
  private async reconcilierResponsables(r: RapportReprise): Promise<void> {
    const [unites, chefs, cellules] = await Promise.all([
      this.prisma.uniteOrganisationnelle.findMany({ where: { dateFermeture: null } }),
      this.prisma.user.findMany({
        where: { status: UserStatus.ACTIF, role: { in: [SystemRole.DN, SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION] } },
        select: { id: true, role: true, divisionId: true, sectionId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cellule.findMany({ select: { id: true, chef: { select: { id: true, status: true } } } }),
    ]);
    const chefCellule = new Map(cellules.map((c) => [c.id, c.chef?.status === UserStatus.ACTIF ? c.chef.id : null]));
    for (const u of unites) {
      let candidats: string[] = [];
      if (u.type === TypeUnite.DIRECTION) candidats = chefs.filter((c) => c.role === SystemRole.DN).slice(0, 1).map((c) => c.id);
      else if (u.divisionId) candidats = chefs.filter((c) => c.role === SystemRole.CHEF_DIVISION && c.divisionId === u.divisionId).map((c) => c.id);
      else if (u.sectionId) candidats = chefs.filter((c) => c.role === SystemRole.CHEF_SECTION && c.sectionId === u.sectionId).map((c) => c.id);
      else if (u.celluleId) candidats = chefCellule.get(u.celluleId) ? [chefCellule.get(u.celluleId)!] : [];
      const attendu = candidats.length === 1 ? candidats[0] : null;
      if (attendu === u.responsableId) continue;
      await this.prisma.uniteOrganisationnelle.update({ where: { id: u.id }, data: { responsableId: attendu } });
      await this.historique(this.prisma, u.id, 'RESPONSABLE', { responsableId: u.responsableId }, { responsableId: attendu, candidats: candidats.length });
      r.responsablesMisAJour++;
    }
  }

  // ---------------------------------------------------------------- agents

  /** Unité d'un compte d'après sa position et son rattachement historiques. */
  uniteDuCompte(
    arbre: Arbre,
    u: { role: SystemRole; divisionId: string | null; sectionId: string | null; celluleId: string | null; supervisor: { role: SystemRole; celluleId: string | null } | null },
  ): string | null {
    const direct = this.arbres.uniteDuRattachement(arbre, u);
    if (direct) return direct.id;
    if (u.role === SystemRole.ASSISTANT_DIRECTION && u.supervisor) {
      if (u.supervisor.role === SystemRole.CHEF_CELLULE && u.supervisor.celluleId) {
        return arbre.parCellule.get(u.supervisor.celluleId)?.id ?? null;
      }
      const secretariat = [...arbre.parCellule.values()].find((c) => c.code === CODE_SECRETARIAT);
      if (secretariat && !secretariat.dateFermeture) return secretariat.id;
    }
    return arbre.direction?.id ?? null;
  }

  async matriculeProvisoire(tx: Client): Promise<string> {
    const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('matricule_provisoire_seq') AS n`;
    return `P-${String(rows[0]!.n).padStart(6, '0')}`;
  }

  private async finStageEnCours(stagiaireId: string): Promise<Date | null> {
    const s = await this.prisma.stage.findFirst({
      where: { stagiaireId, statut: { in: [StageStatut.PREVU, StageStatut.EN_COURS] } },
      orderBy: { dateFin: 'desc' },
      select: { dateFin: true },
    });
    return s?.dateFin ?? null;
  }

  private async reconcilierAgents(r: RapportReprise, seulementUserId?: string): Promise<void> {
    const arbre = await (this.arbres.invalider(), this.arbres.arbre());
    const comptes = await this.prisma.user.findMany({
      where: { status: { not: UserStatus.EN_ATTENTE }, ...(seulementUserId ? { id: seulementUserId } : {}) },
      select: {
        id: true, firstName: true, lastName: true, jobTitle: true, role: true, status: true, updatedAt: true,
        divisionId: true, sectionId: true, celluleId: true, agentId: true,
        supervisor: { select: { role: true, celluleId: true } },
        agent: { select: { id: true, uniteId: true, statut: true, dateFinPrevue: true, natureFinPrevue: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const c of comptes) {
      const uniteId = this.uniteDuCompte(arbre, c);
      if (!c.agent) {
        const statut = c.status === UserStatus.ACTIF ? StatutAgent.EN_ACTIVITE : c.status === UserStatus.SUSPENDU ? StatutAgent.SUSPENDU : StatutAgent.PARTI;
        const finStage = c.role === SystemRole.STAGIAIRE ? await this.finStageEnCours(c.id) : null;
        await this.prisma.$transaction(async (tx) => {
          const matricule = await this.matriculeProvisoire(tx);
          const agent = await tx.agent.create({
            data: {
              matricule, matriculeProvisoire: true, nom: c.lastName, prenoms: c.firstName, fonction: c.jobTitle,
              uniteId, statut,
              ...(finStage ? { dateFinPrevue: finStage, natureFinPrevue: 'STAGE' } : {}),
              ...(statut === StatutAgent.PARTI ? { dateDepart: c.updatedAt, motifDepart: 'Reprise : compte désactivé avant N1' } : {}),
            },
          });
          // SQL direct : le lien vers l'agent ne doit pas toucher users.updatedAt (données d'avant N1 intactes).
          await tx.$executeRaw`UPDATE "users" SET "agentId" = ${agent.id} WHERE "id" = ${c.id}`;
          await tx.mouvementAgent.create({ data: { agentId: agent.id, type: 'ENTREE', apres: { matricule, uniteId, statut }, motif: 'Reprise automatique (socle NIMBA, lot N1)' } });
        });
        r.agentsCrees++;
        continue;
      }
      // Agent existant : l'unité suit le rattachement historique (source des modules en N1).
      if (c.agent.uniteId !== uniteId) {
        await this.prisma.$transaction([
          this.prisma.agent.update({ where: { id: c.agent.id }, data: { uniteId } }),
          this.prisma.mouvementAgent.create({ data: { agentId: c.agent.id, type: 'MUTATION', avant: { uniteId: c.agent.uniteId }, apres: { uniteId }, motif: 'Changement de rattachement' } }),
        ]);
        r.agentsMutes++;
      }
      // Stagiaire : la fin prévue suit le stage en cours (module Stages), sauf fin fixée autrement.
      if (c.role === SystemRole.STAGIAIRE && (c.agent.natureFinPrevue ?? 'STAGE') === 'STAGE' && c.agent.statut !== StatutAgent.PARTI) {
        const finStage = await this.finStageEnCours(c.id);
        if (finStage && c.agent.dateFinPrevue?.getTime() !== finStage.getTime()) {
          await this.prisma.agent.update({
            where: { id: c.agent.id },
            data: { dateFinPrevue: finStage, natureFinPrevue: 'STAGE', alerteJ15At: null, alerteJ3At: null, finConfirmeeAt: null },
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------- rôles

  private async reconcilierRoles(r: RapportReprise): Promise<void> {
    // Habilitations historiques → reflet exact (création et retrait), à chaque démarrage.
    const habsCourrier = await this.prisma.habilitationCourrier.findMany({
      select: { id: true, userId: true, registreId: true, uniteKey: true, createdAt: true, accordeeParId: true, revoqueeAt: true, revoqueeParId: true },
    });
    const refletsCourrier = new Map(
      (await this.prisma.attributionRole.findMany({ where: { habilitationCourrierId: { not: null } }, select: { id: true, habilitationCourrierId: true, retireLe: true } })).map((a) => [a.habilitationCourrierId!, a]),
    );
    for (const h of habsCourrier) {
      const a = refletsCourrier.get(h.id);
      if (!a) {
        await this.prisma.attributionRole.create({
          data: {
            userId: h.userId, role: RoleFonctionnel.AGENT_COURRIER, registreId: h.registreId, uniteKey: h.uniteKey,
            dateDebut: h.createdAt, attribueParId: h.accordeeParId, retireLe: h.revoqueeAt, retireParId: h.revoqueeParId,
            motif: 'Habilitation courrier', habilitationCourrierId: h.id,
          },
        });
        r.attributionsCreees++;
      } else if (h.revoqueeAt && !a.retireLe) {
        await this.prisma.attributionRole.update({ where: { id: a.id }, data: { retireLe: h.revoqueeAt, retireParId: h.revoqueeParId, motifRetrait: 'Habilitation courrier révoquée' } });
        r.attributionsRetirees++;
      }
    }
    const habsLog = await this.prisma.habilitationLogistique.findMany({
      select: { id: true, userId: true, createdAt: true, accordeeParId: true, revoqueeAt: true, revoqueeParId: true },
    });
    const refletsLog = new Map(
      (await this.prisma.attributionRole.findMany({ where: { habilitationLogistiqueId: { not: null } }, select: { id: true, habilitationLogistiqueId: true, retireLe: true } })).map((a) => [a.habilitationLogistiqueId!, a]),
    );
    for (const h of habsLog) {
      const a = refletsLog.get(h.id);
      if (!a) {
        await this.prisma.attributionRole.create({
          data: {
            userId: h.userId, role: RoleFonctionnel.GESTIONNAIRE_LOGISTIQUE, dateDebut: h.createdAt, attribueParId: h.accordeeParId,
            retireLe: h.revoqueeAt, retireParId: h.revoqueeParId, motif: 'Gestionnaire logistique', habilitationLogistiqueId: h.id,
          },
        });
        r.attributionsCreees++;
      } else if (h.revoqueeAt && !a.retireLe) {
        await this.prisma.attributionRole.update({ where: { id: a.id }, data: { retireLe: h.revoqueeAt, retireParId: h.revoqueeParId, motifRetrait: 'Habilitation logistique révoquée' } });
        r.attributionsRetirees++;
      }
    }

    // Position DRH ou Assistant sans aucune attribution correspondante (jamais,
    // même retirée) : rôle déduit une fois — y compris pour un compte passé DRH
    // par une version précédente de l'API pendant un retour arrière.
    for (const [position, role] of [
      [SystemRole.DRH, RoleFonctionnel.DRH],
      [SystemRole.ASSISTANT_DIRECTION, RoleFonctionnel.ASSISTANT],
    ] as const) {
      const sans = await this.prisma.user.findMany({
        where: { role: position, status: { not: UserStatus.EN_ATTENTE }, attributionsRoles: { none: { role } } },
        select: { id: true },
      });
      for (const u of sans) {
        await this.prisma.attributionRole.create({ data: { userId: u.id, role, motif: 'Reprise automatique (position actuelle)' } });
        r.attributionsCreees++;
      }
    }

    // Reprise INITIALE seulement (décision validée) : DN et DNA → Validateur ;
    // chef de la cellule SAF → Chef SAF ; tuteurs des stages en cours → Encadreur.
    // Marque : un événement de l'historique de la Direction (table N1), et non le journal d'audit, pour
    // qu'après un retour arrière (n1_down.sql) puis une ré-application la reprise initiale soit refaite.
    const direction = await this.prisma.uniteOrganisationnelle.findFirst({ where: { type: TypeUnite.DIRECTION }, select: { id: true } });
    if (!direction) return;
    const dejaFaite = await this.prisma.historiqueUnite.findFirst({ where: { uniteId: direction.id, evenement: EVENEMENT_REPRISE_INITIALE }, select: { id: true } });
    if (dejaFaite) return;
    const dirigeants = await this.prisma.user.findMany({
      where: { role: { in: [SystemRole.DN, SystemRole.DNA] }, status: UserStatus.ACTIF, attributionsRoles: { none: { role: RoleFonctionnel.VALIDATEUR } } },
      select: { id: true },
    });
    const saf = await this.prisma.cellule.findUnique({ where: { code: 'SAF' }, select: { chef: { select: { id: true, status: true } } } });
    const tuteurs = await this.prisma.periodeStage.findMany({
      where: { tuteurId: { not: null }, stage: { statut: { in: [StageStatut.PREVU, StageStatut.EN_COURS] } } },
      select: { tuteurId: true },
      distinct: ['tuteurId'],
    });
    const aCreer: { userId: string; role: RoleFonctionnel }[] = [
      ...dirigeants.map((u) => ({ userId: u.id, role: RoleFonctionnel.VALIDATEUR })),
      ...(saf?.chef?.status === UserStatus.ACTIF ? [{ userId: saf.chef.id, role: RoleFonctionnel.CHEF_SAF }] : []),
      ...tuteurs.map((t) => ({ userId: t.tuteurId!, role: RoleFonctionnel.ENCADREUR_STAGE })),
    ];
    for (const a of aCreer) {
      const existe = await this.prisma.attributionRole.findFirst({ where: { userId: a.userId, role: a.role }, select: { id: true } });
      if (existe) continue;
      await this.prisma.attributionRole.create({ data: { ...a, motif: 'Reprise initiale (socle NIMBA, lot N1)' } });
      r.attributionsCreees++;
    }
    await this.historique(this.prisma, direction.id, EVENEMENT_REPRISE_INITIALE, null, { roles: aCreer.map((a) => a.role) });
    await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'Parametrage', entityId: MARQUE_REPRISE_INITIALE, metadata: { event: 'reprise_initiale_roles', nombre: aCreer.length } });
  }
}
